import { authenticateRequest, requireTenant } from '../../_lib/auth.js';
import { json, options } from '../../_lib/http.js';
import { canSync, SYNC_TYPES } from '../../_lib/syncPolicy.js';
import { canAccessBranch } from '../../../src/services/branchAccess.js';

export const onRequestOptions = options;
export async function onRequestGet({ request, env }) {
  const auth = await authenticateRequest(request, env);
  if (auth.error) return auth.error;
  const url = new URL(request.url);
  const accessError = requireTenant(auth, url.searchParams.get('tenantId'));
  if (accessError) return accessError;
  const since = Number(url.searchParams.get('cursor') || 0);
  const limit = Math.min(Math.max(1, Number.parseInt(url.searchParams.get('limit') || '500', 10) || 500), 1000);
  if (!Number.isSafeInteger(since) || since < 0) return json({ success: false, error: 'Invalid cursor' }, 400);
  const maxRows = limit + 100;
  const { results } = await env.DB.prepare('SELECT * FROM sync_events_v2 WHERE tenant_id = ? AND sequence > ? ORDER BY sequence LIMIT ?')
    .bind(auth.principal.tenantId, since, maxRows).all();
  let count = Math.min(limit, results.length);
  while (count < results.length && results[count - 1]?.group_id && results[count - 1].group_id === results[count].group_id) count++;
  // An authoritative restore is a synchronization barrier. Deliver all older
  // events and the restore together, then leave newer events for the next pull.
  const restoreIndex = results.slice(0, count).findIndex(row => row.entity_type === 'restore_snapshot');
  if (restoreIndex >= 0) count = restoreIndex + 1;
  const page = results.slice(0, count);
  const visible = page.filter(row => canSync(auth.principal, row.entity_type) &&
    (auth.principal.branchIds?.includes('all') || (row.branch_id && canAccessBranch(auth.principal, row.branch_id))));
  const events = visible.map(row => ({
    id: row.id, tenantId: row.tenant_id, branchId: row.branch_id, sequence: row.sequence, groupId: row.group_id,
    entityType: row.entity_type, entityId: row.entity_id, action: row.action,
    payload: JSON.parse(row.payload_json), conflictPolicyVersion: row.conflict_policy_version,
    preconditions: row.preconditions_json ? JSON.parse(row.preconditions_json) : null,
    clientTimestamp: row.client_timestamp, serverTimestamp: row.server_timestamp
  }));
  const fullTenantVisibility = auth.principal.branchIds?.includes('all') &&
    SYNC_TYPES.every(type => canSync(auth.principal, type));
  const hasMore = results.length > count || results.length === maxRows;
  let conflictHeads;
  if (!hasMore) {
    const heads=await env.DB.prepare('SELECT conflict_key,last_event_id FROM sync_conflict_heads WHERE tenant_id = ? ORDER BY conflict_key')
      .bind(auth.principal.tenantId).all();
    conflictHeads=Object.fromEntries(heads.results.map(row=>[row.conflict_key,row.last_event_id]));
  }
  return json({ success: true, events, count: events.length, nextCursor: page.at(-1)?.sequence || since,
    hasMore, fullTenantVisibility, ...(conflictHeads ? {conflictHeads} : {}) });
}
