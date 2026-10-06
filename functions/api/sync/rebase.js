import { authenticateRequest, requireTenant } from '../../_lib/auth.js';
import { badRequest, json, options, readJson } from '../../_lib/http.js';
import { canSync, validateTenantPayload } from '../../_lib/syncPolicy.js';
import { canAccessBranch } from '../../../src/services/branchAccess.js';
import { conflictKeysForEvent } from '../../../src/services/syncConflictPolicy.js';
import { isIndependentSale, isIndependentSalesQueue } from '../../../src/services/independentSales.js';

export const onRequestOptions = options;
const conflict = () => json({ success: false, error: 'Automatic reconciliation is not safe for this history' }, 409);
const decode = row => ({ id: row.id, tenantId: row.tenant_id, branchId: row.branch_id,
  sequence: row.sequence, groupId: row.group_id, entityType: row.entity_type,
  entityId: row.entity_id, action: row.action, payload: JSON.parse(row.payload_json),
  conflictPolicyVersion: row.conflict_policy_version, preconditions: JSON.parse(row.preconditions_json),
  clientTimestamp: row.client_timestamp, serverTimestamp: row.server_timestamp });

// Read-only proposal. Acceptance still goes through push and the original D1
// causal trigger, so another writer invalidates a stale proposal safely.
export async function onRequestPost({ request, env }) {
  const auth = await authenticateRequest(request, env);
  if (auth.error) return auth.error;
  try {
    const { tenantId, cursor, events } = await readJson(request);
    const denied = requireTenant(auth, tenantId);
    if (denied) return denied;
    if (!Number.isSafeInteger(cursor) || cursor < 0 || !isIndependentSalesQueue(events) || events.length > 100)
      return badRequest('Unsupported reconciliation');
    for (const event of events) {
      if (event.tenantId !== tenantId || !canSync(auth.principal, 'invoice', 'create') ||
          !canAccessBranch(auth.principal, event.branchId)) return json({ success: false, error: 'Access denied' }, 403);
      validateTenantPayload(event.payload, tenantId);
      const keys = conflictKeysForEvent(event).sort();
      if (!event.preconditions || JSON.stringify(Object.keys(event.preconditions).sort()) !== JSON.stringify(keys) ||
          Object.values(event.preconditions).some(value => value !== null && (typeof value !== 'string' || !value)))
        return badRequest('Invalid preconditions');
    }
    const domains = ['domain:inventory', 'domain:customers', 'domain:liquidity'];
    // D1 batch provides one sequential transaction for history and heads.
    const [history, heads, collisions, latest, ...baseline] = await env.DB.batch([
      env.DB.prepare('SELECT * FROM sync_events_v2 WHERE tenant_id=? AND sequence>? ORDER BY sequence LIMIT 1001').bind(tenantId, cursor),
      env.DB.prepare('SELECT conflict_key,last_event_id FROM sync_conflict_heads WHERE tenant_id=?').bind(tenantId),
      env.DB.prepare(`SELECT * FROM sync_events_v2 WHERE tenant_id=? AND
        (id IN (SELECT value FROM json_each(?)) OR (entity_type='invoice' AND entity_id IN (SELECT value FROM json_each(?))))`)
        .bind(tenantId, JSON.stringify(events.map(event => event.id)), JSON.stringify(events.map(event => event.entityId))),
      env.DB.prepare('SELECT COALESCE(MAX(sequence),0) AS sequence FROM sync_events_v2 WHERE tenant_id=?').bind(tenantId),
      ...domains.map(key => env.DB.prepare(`SELECT id FROM sync_events_v2 WHERE tenant_id=? AND sequence<=?
        AND EXISTS(SELECT 1 FROM json_each(preconditions_json) WHERE key=?) ORDER BY sequence DESC LIMIT 1`).bind(tenantId, cursor, key))
    ]);
    if (history.results.length > 1000 || cursor > latest.results[0].sequence) return conflict();
    const remote = history.results.map(decode);
    if (!remote.every(isIndependentSale)) return conflict();
    const previous = Object.fromEntries(domains.map((key, index) => [key, baseline[index].results[0]?.id ?? null]));
    const remoteIds = new Set(remote.map(event => event.id));
    const acceptedIds = [];
    for (const event of events) {
      const existing = collisions.results.filter(row => row.id === event.id || row.entity_id === event.entityId);
      if (existing.length) {
        if (existing.length !== 1) return conflict();
        const row = existing[0];
        if (row.id !== event.id || row.entity_id !== event.entityId || row.entity_type !== 'invoice' || row.action !== 'create' ||
            row.branch_id !== event.branchId || row.payload_json !== JSON.stringify(event.payload) ||
            row.group_id !== (event.groupId || null) || row.preconditions_json !== JSON.stringify(event.preconditions)) return conflict();
        acceptedIds.push(event.id);
      }
      for (const key of domains) {
        const predecessor = event.preconditions[key];
        if (predecessor !== previous[key] && !remoteIds.has(predecessor)) return conflict();
        previous[key] = event.id;
      }
      if (event.preconditions[`record:invoice:${event.entityId}`] !== null) return conflict();
    }
    return json({ success: true, protocol: 'independent-sales-v1', acceptedIds,
      nextCursor: latest.results[0].sequence,
      events: remote.filter(event => canSync(auth.principal, 'invoice') && canAccessBranch(auth.principal, event.branchId)),
      conflictHeads: Object.fromEntries(heads.results.map(row => [row.conflict_key, row.last_event_id])) });
  } catch { return badRequest('Invalid reconciliation request'); }
}
