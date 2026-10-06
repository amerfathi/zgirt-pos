import { authenticateRequest, requireTenant } from '../../_lib/auth.js';
import { badRequest, json, options, readJson } from '../../_lib/http.js';
import { canSync, validateTenantPayload } from '../../_lib/syncPolicy.js';
import { conflictKeysForEvent } from '../../../src/services/syncConflictPolicy.js';
import { canAccessBranch } from '../../../src/services/branchAccess.js';
import { resolutionStatements } from '../../_lib/reviewResolution.js';
import { readLegacyProductProof } from '../../_lib/legacyProductReference.js';
import { assertInvoiceVoidPayload, assertInvoiceUpdatePayload } from '../../../src/services/invoiceMutationPolicy.js';

export const onRequestOptions = options;
export async function onRequestPost({ request, env, reviewCommit = null }) {
  const auth = await authenticateRequest(request, env);
  if (auth.error) return auth.error;
  try {
    const { tenantId, branchId, events } = await readJson(request);
    const accessError = requireTenant(auth, tenantId);
    if (accessError) return accessError;
    if(reviewCommit&&(auth.principal.type!=='tenant'||!['company_owner','super_admin'].includes(auth.principal.role)||
      reviewCommit.tenantId!==tenantId||reviewCommit.actorId!==auth.principal.id))return json({success:false,error:'Owner resolution denied'},403);
    if (!Array.isArray(events) || events.length < 1 || events.length > 100) return badRequest('events must contain 1-100 mutations');
    const closed=await env.DB.prepare(`SELECT 1 FROM sync_review_originals
      WHERE tenant_id=? AND event_id IN(SELECT value FROM json_each(?)) LIMIT 1`)
      .bind(tenantId,JSON.stringify(events.map(event=>event?.id))).first();
    if(closed)return json({success:false,error:'Source resolved by company owner; recover reviewed checkpoint'},409);
    if(events.some(event=>event?.entityType==='cash_shift'||event?.payload?.cashShiftId))return json({success:false,error:'Cash shifts are not enabled'},503);
    const now = Date.now();
    const statements = [];
    const creatingBranches = new Set();
    const entityBranches = new Map();
    const knownEntityBranch = async (type, id) => {
      const key = `${type}:${id}`;
      if (entityBranches.has(key)) return entityBranches.get(key);
      const row = await env.DB.prepare('SELECT branch_id FROM sync_events_v2 WHERE tenant_id = ? AND entity_type = ? AND entity_id = ? ORDER BY sequence LIMIT 1')
        .bind(tenantId, type, id).first();
      let result = row ? row.branch_id : undefined;
      if(type==='product'&&result===null){
        const revision=await env.DB.prepare('SELECT COALESCE(MAX(sequence),0) cursor FROM sync_events_v2 WHERE tenant_id=?').bind(tenantId).first();
        const proof=await readLegacyProductProof(env,tenantId,id,revision.cursor);
        if(proof)result=proof.branchId;
      }
      entityBranches.set(key, result);
      return result;
    };
    const groupCounts = new Map();
    for (const event of events) if (typeof event?.groupId === 'string')
      groupCounts.set(event.groupId, (groupCounts.get(event.groupId) || 0) + 1);
    const closedGroups = new Set();
    let previousGroup = null;
    for (const event of events) {
      const group = event?.groupId || null;
      if (group !== previousGroup) {
        if (previousGroup) closedGroups.add(previousGroup);
        if (group && closedGroups.has(group)) return badRequest('Commit group events must be contiguous');
        previousGroup = group;
      }
    }
    const seenGroups = new Set();
    for (const event of events) {
      if (!event || typeof event.id !== 'string' || event.id.length > 128 || !event.id ||
          typeof event.entityId !== 'string' || !event.entityId || event.entityId.length > 128 ||
          !['create','update','delete','void','reverse'].includes(event.action) ||
          !event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) return badRequest('Invalid event');
      if (event.groupId !== undefined && (typeof event.groupId !== 'string' || !/^[a-f0-9-]{36}$/.test(event.groupId))) return badRequest('Invalid commit group');
      const requiredConflictKeys=conflictKeysForEvent(event).sort();
      const suppliedConflictKeys=event.preconditions && typeof event.preconditions === 'object' && !Array.isArray(event.preconditions)
        ? Object.keys(event.preconditions).sort() : [];
      if (event.conflictPolicyVersion !== 1 || JSON.stringify(requiredConflictKeys) !== JSON.stringify(suppliedConflictKeys) ||
          Object.values(event.preconditions || {}).some(value=>value !== null && (typeof value !== 'string' || !value || value.length>128)))
        return badRequest('Missing or invalid conflict preconditions');
      if (!canSync(auth.principal, event.entityType, event.action)) return json({ success: false, error: 'Operation not permitted' }, 403);
      if (event.tenantId && event.tenantId !== tenantId) return json({ success: false, error: 'Event tenant mismatch' }, 403);
      validateTenantPayload(event.payload, tenantId);
      if (event.payload.id && event.payload.id !== event.entityId) return badRequest('Entity ID mismatch');
      if(event.entityType==='invoice' && event.action==='void')assertInvoiceVoidPayload(event.payload);
      if(event.entityType==='invoice' && event.action==='update')assertInvoiceUpdatePayload(event.payload);
      const branch = event.branchId ?? branchId ?? null;
      if (branch === 'all') return badRequest('Aggregate branch view is read-only');
      const tenantWideEvent = ['branch', 'stock_transfer', 'restore_snapshot', 'settings'].includes(event.entityType);
      if (!tenantWideEvent && !branch) return badRequest('Financial mutations require an explicit branch');
      if (!tenantWideEvent && event.action === 'create' && event.payload.branchId !== branch)
        return badRequest('Created financial record must belong to the selected branch');
      if (!canAccessBranch(auth.principal, branch)) return json({ success: false, error: 'Branch access denied' }, 403);
      if (!['branch', 'stock_transfer', 'restore_snapshot', 'settings'].includes(event.entityType)) {
        const existingBranch = await knownEntityBranch(event.entityType, event.entityId);
        if (existingBranch !== undefined && existingBranch !== branch)
          return json({ success: false, error: 'Entity belongs to another branch' }, 403);
        entityBranches.set(`${event.entityType}:${event.entityId}`, branch);
        if (branch) {
          const p = event.payload;
          const references = [];
          const ref = (type, id) => { if (typeof id === 'string' && id && id !== 'walk_in') references.push([type, id]); };
          if (event.entityType === 'invoice') {
            ref('customer', p.customerId);
            for (const item of p.items || []) ref('product', item.productId);
          } else if (event.entityType === 'purchase') { ref('supplier', p.supplierId); ref('product', p.productId); }
          else if (event.entityType === 'customer_payment') ref('customer', p.customerId);
          else if (event.entityType === 'supplier_payment') ref('supplier', p.supplierId);
          else if (event.entityType === 'worker_transaction') ref('worker', p.workerId);
          else if (event.entityType === 'sales_return') ref('invoice', p.invoiceId);
          else if (event.entityType === 'purchase_return') ref('purchase', p.purchaseId);
          else if (event.entityType === 'partner_drawing') ref('partner', p.partnerId);
          else if (event.entityType === 'profit_distribution')
            for (const share of p.shares || []) ref('partner', share.partnerId);
          else if (event.entityType === 'damaged_item') ref('product', p.productId);
          if (references.length > 100) return badRequest('Too many entity references');
          for (const [type, id] of references) {
            const referenceBranch = await knownEntityBranch(type, id);
            if (referenceBranch !== undefined && referenceBranch !== branch)
              return json({ success: false, error: 'Related record belongs to another branch' }, 403);
          }
        }
      }
      if (event.entityType === 'branch') {
        if (branch || !['create', 'update'].includes(event.action) || event.payload.tenantId !== tenantId) return badRequest('Invalid branch event');
      } else if (event.entityType === 'stock_transfer') {
        const p=event.payload;
        if (branch || event.action !== 'create' || p.fromBranchId === p.toBranchId ||
            !Number.isFinite(Number(p.quantityKg)) || Number(p.quantityKg) <= 0) return badRequest('Invalid stock transfer');
        for (const id of [p.fromBranchId,p.toBranchId]) {
          if (typeof id !== 'string' || (!creatingBranches.has(id) &&
              !await env.DB.prepare('SELECT id FROM branches WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first())) return badRequest('Unknown transfer branch');
        }
      } else {
        if (event.payload.branchId && event.payload.branchId !== branch) return badRequest('Payload branch mismatch');
        if (branch && branch !== 'all' && !creatingBranches.has(branch) &&
            !await env.DB.prepare('SELECT id FROM branches WHERE id = ? AND tenant_id = ?').bind(branch, tenantId).first()) return badRequest('Unknown branch');
      }
      const payload = JSON.stringify(event.payload);
      const preconditions = JSON.stringify(event.preconditions);
      if (new TextEncoder().encode(payload).length > 5 * 1024 * 1024) return badRequest('Event payload is oversized');
      const groupId = event.groupId || null;
      // Duplicate IDs with altered content are conflicts, not successful retries.
      const old = await env.DB.prepare('SELECT * FROM sync_events_v2 WHERE tenant_id = ? AND id = ?').bind(tenantId, event.id).first();
      if (old && (old.entity_type !== event.entityType || old.entity_id !== event.entityId || old.action !== event.action || old.payload_json !== payload || old.branch_id !== branch || old.group_id !== groupId || old.conflict_policy_version !== 1 || old.preconditions_json !== preconditions)) return json({ success: false, error: 'Idempotency conflict' }, 409);
      if (groupId) {
        const registered = await env.DB.prepare('SELECT event_count FROM sync_commit_groups WHERE tenant_id = ? AND group_id = ?').bind(tenantId, groupId).first();
        if (registered && (!old || registered.event_count !== groupCounts.get(groupId)))
          return json({ success: false, error: 'Commit group already closed' }, 409);
        if (!registered && !seenGroups.has(groupId)) statements.push(env.DB.prepare(
          'INSERT INTO sync_commit_groups (tenant_id, group_id, event_count) VALUES (?, ?, ?)'
        ).bind(tenantId, groupId, groupCounts.get(groupId)));
        seenGroups.add(groupId);
      }
      if (!old && event.entityType === 'branch') {
        const p = event.payload;
        {
          if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 150 ||
              (p.code && (typeof p.code !== 'string' || p.code.length > 32)) ||
              !['active', 'inactive'].includes(p.status)) return badRequest('Invalid branch details');
          if (event.action === 'update' && !creatingBranches.has(event.entityId) &&
              !await env.DB.prepare('SELECT id FROM branches WHERE id = ? AND tenant_id = ?').bind(event.entityId, tenantId).first()) return badRequest('Unknown branch');
          if (event.action === 'create') {
            creatingBranches.add(event.entityId);
            const existingBranch = await env.DB.prepare('SELECT * FROM branches WHERE id = ?').bind(event.entityId).first();
            if (existingBranch) {
              // A tenant's main branch is provisioned before its first login.
              // Its first client may register the identical create event, but
              // never overwrite or claim a branch belonging to another tenant.
              if (existingBranch.tenant_id !== tenantId || existingBranch.name !== p.name.trim() ||
                  (existingBranch.code || '') !== (p.code || '') ||
                  (existingBranch.phone || '') !== (p.phone || '') ||
                  (existingBranch.address || '') !== (p.address || '') ||
                  (existingBranch.manager_name || '') !== (p.managerName || '') ||
                  Boolean(existingBranch.is_main) !== Boolean(p.isMain) ||
                  existingBranch.status !== (p.status || 'active')) return json({ success: false, error: 'Branch create conflict' }, 409);
            } else {
              statements.push(env.DB.prepare(`INSERT INTO branches
              (id, tenant_id, name, code, phone, address, manager_name, is_main, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
              .bind(event.entityId, tenantId, p.name.trim(), p.code || null, p.phone || null,
                p.address || null, p.managerName || null, p.isMain ? 1 : 0, p.status || 'active'));
            }
          }
          else statements.push(env.DB.prepare(`UPDATE branches SET name = ?, code = ?, phone = ?, address = ?, manager_name = ?,
            is_main = ?, status = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`)
            .bind(p.name.trim(), p.code || null, p.phone || null, p.address || null,
              p.managerName || null, p.isMain ? 1 : 0, p.status || 'active', event.entityId, tenantId));
        }
      }
      statements.push(env.DB.prepare(`INSERT INTO sync_events_v2
        (id, tenant_id, branch_id, entity_type, entity_id, action, payload_json, client_timestamp, server_timestamp, group_id, conflict_policy_version, preconditions_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(tenant_id, id) DO NOTHING`)
        .bind(event.id, auth.principal.tenantId, branch, event.entityType, event.entityId, event.action, payload, Number(event.timestamp) || now, now, groupId, 1, preconditions));
    }
    if(reviewCommit){const [claim,finish]=resolutionStatements(env,reviewCommit);statements.unshift(claim);statements.push(finish);}
    await env.DB.batch(statements);
    return json({ success: true, acceptedIds: events.map(event => event.id), syncedCount: events.length });
  } catch (error) {
    if(String(error?.message).includes('SYNC_REVIEW_STALE'))return json({success:false,error:'Review changed; refresh before deciding'},409);
    if (String(error?.message).includes('SYNC_IDEMPOTENCY_CONFLICT')) return json({ success: false, error: 'Idempotency conflict' }, 409);
    if (String(error?.message).includes('SYNC_CAUSAL_CONFLICT')) return json({ success: false, error: 'Stale multi-device mutation; synchronize and resolve the conflict' }, 409);
    if (String(error?.message).includes('sync_commit_groups')) return json({ success: false, error: 'Commit group conflict' }, 409);
    return badRequest('Invalid sync request');
  }
}
