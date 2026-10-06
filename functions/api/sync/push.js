import { authenticateRequest, requireTenant } from '../../_lib/auth.js';
import { badRequest, json, options, readJson } from '../../_lib/http.js';
import { canSync, validateTenantPayload } from '../../_lib/syncPolicy.js';
import { conflictKeysForEvent } from '../../../src/services/syncConflictPolicy.js';
import { canAccessBranch } from '../../../src/services/branchAccess.js';
import { cashMovementFromRecord } from '../../../src/services/cashMovement.js';
import { accountingDate } from '../../../src/services/cashShiftEngine.js';
import { resolutionStatements } from '../../_lib/reviewResolution.js';
import { readLegacyProductProof } from '../../_lib/legacyProductReference.js';
import { cashReplayEntry } from '../../_lib/cashReplay.js';
import { assertInvoiceVoidPayload, assertInvoiceUpdatePayload } from '../../../src/services/invoiceMutationPolicy.js';

export const onRequestOptions = options;
const cashRecordTypes=new Set(['invoice','customer_payment','expense','purchase','supplier_payment',
  'worker_transaction','partner_drawing','profit_distribution','sales_return','purchase_return']);
export async function onRequestPost({ request, env, reviewCommit = null, cashReplay = null }) {
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
    if (env.CASH_SHIFTS_ENABLED !== 'true' && events.some(event => event?.entityType === 'cash_shift' || event?.payload?.cashShiftId))
      return json({ success: false, error: 'Cash shifts are not enabled' }, 503);
    const now = Date.now();
    const statements = [];
    const creatingBranches = new Set();
    const entityBranches = new Map();
    const pendingCashCreates = new Map();
    const pendingCashReversals = new Set();
    const replayShifts = new Map();
    const pendingCashDeltas = new Map();
    const managedCashBranches=new Map();
    const cashShiftById = async id => {
      if (replayShifts.has(id)) return replayShifts.get(id);
      const shift = await env.DB.prepare('SELECT * FROM cash_shifts WHERE id = ? AND tenant_id = ?')
        .bind(id, tenantId).first();
      if (shift) replayShifts.set(id, shift);
      return shift;
    };
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
      const replay = cashReplay ? cashReplayEntry(cashReplay, event) : null;
      if (!replay && (event?.entityType==='cash_shift' || event?.payload?.cashShiftId))
        return json({success:false,error:'Cash sources require signed drawer replay'},403);
      const principal = replay?.principal ?? auth.principal;
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
      if (!canSync(principal, event.entityType, event.action)) return json({ success: false, error: 'Operation not permitted' }, 403);
      if (event.tenantId && event.tenantId !== tenantId) return json({ success: false, error: 'Event tenant mismatch' }, 403);
      validateTenantPayload(event.payload, tenantId);
      if (event.payload.id && event.payload.id !== event.entityId) return badRequest('Entity ID mismatch');
      if(event.entityType==='invoice' && event.action==='void')assertInvoiceVoidPayload(event.payload);
      if(event.entityType==='invoice' && event.action==='update')assertInvoiceUpdatePayload(event.payload);
      const branch = event.branchId ?? branchId ?? null;
      // A branch with an assigned drawer writer cannot bypass cash control by
      // simply omitting cashShiftId. Unenrolled branches retain legacy behavior.
      if(env.CASH_SHIFTS_ENABLED==='true'&&branch&&['create','update'].includes(event.action)&&cashRecordTypes.has(event.entityType)&&
          !event.payload.cashShiftId) {
        if(!managedCashBranches.has(branch))managedCashBranches.set(branch,Boolean(await env.DB.prepare(`SELECT 1 FROM cash_drawer_writers w
          JOIN cash_drawers d ON d.id=w.drawer_id AND d.tenant_id=w.tenant_id
          WHERE w.tenant_id=? AND d.branch_id=? AND d.status='active' LIMIT 1`).bind(tenantId,branch).first()));
        if(managedCashBranches.get(branch)) {
          if(event.action==='update'&&(event.entityType!=='invoice'||Object.keys(event.payload).some(key=>
            !['id','tenantId','branchId','notes'].includes(key))))
            return json({success:false,error:'Financial edits require audited drawer reconciliation'},403);
          if(event.action==='create'&&cashMovementFromRecord(event.entityType,event.payload)!==0)
            return json({success:false,error:'Cash movement requires a signed open drawer shift'},403);
        }
      }
      if (event.entityType === 'settings' && event.payload.timeZone !== undefined) {
        if (branch || principal.type !== 'tenant' || !['company_owner', 'super_admin'].includes(principal.role))
          return json({ success: false, error: 'Only the company owner can change its timezone' }, 403);
        if (typeof event.payload.timeZone !== 'string' || !event.payload.timeZone.trim()) return badRequest('Invalid timezone');
        try { accountingDate(new Date(now).toISOString(), event.payload.timeZone); }
        catch { return badRequest('Invalid timezone'); }
      }
      if (branch === 'all') return badRequest('Aggregate branch view is read-only');
      const tenantWideEvent = ['branch', 'stock_transfer', 'restore_snapshot', 'settings'].includes(event.entityType);
      if (!tenantWideEvent && !branch) return badRequest('Financial mutations require an explicit branch');
      if (!tenantWideEvent && event.action === 'create' && event.payload.branchId !== branch)
        return badRequest('Created financial record must belong to the selected branch');
      if (!canAccessBranch(principal, branch)) return json({ success: false, error: 'Branch access denied' }, 403);
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
      } else if (event.entityType === 'cash_shift') {
        const p = event.payload;
        if (!['create', 'update'].includes(event.action)) return badRequest('Unsupported cash shift action');
        for (const field of ['tenantId', 'branchId', 'drawerId', 'actorId', 'offlineDeviceId', 'timeZone', 'accountingDate', 'openedAt'])
          if (typeof p?.[field] !== 'string' || !p[field]) return badRequest('Invalid cash shift');
        if (!Number.isFinite(Number(p.openingCash)) || Number(p.openingCash) < 0) return badRequest('Invalid opening cash');
        if (p.tenantId !== tenantId) return json({ success: false, error: 'Cash shift tenant mismatch' }, 403);
        if (p.actorId !== principal.id) return json({ success: false, error: 'Cash shift belongs to another cashier' }, 403);
        if (replay && (p.offlineDeviceId !== replay.deviceId || p.drawerId !== replay.drawerId))
          return json({ success: false, error: 'Signed drawer device mismatch' }, 403);
        if (p.branchId !== branch) return badRequest('Cash shift branch mismatch');
        const drawer = await env.DB.prepare("SELECT id FROM cash_drawers WHERE id = ? AND tenant_id = ? AND branch_id = ? AND status = 'active'")
          .bind(p.drawerId, tenantId, branch).first();
        if (!drawer) return badRequest('Unknown active drawer for this tenant and branch');
        if (event.action === 'create') {
          const existing = await cashShiftById(p.id);
          if (replay && existing && (existing.drawer_id!==p.drawerId ||
              existing.offline_device_id!==p.offlineDeviceId || existing.opened_by!==p.actorId ||
              existing.branch_id!==p.branchId || existing.opened_at!==p.openedAt ||
              existing.time_zone!==p.timeZone || existing.accounting_date!==p.accountingDate ||
              existing.opening_cash_cents!==Math.round(Number(p.openingCash)*100)))
            return json({success:false,error:'Existing signed shift identity mismatch'},409);
          if (!existing) replayShifts.set(p.id, { id: p.id, tenant_id: tenantId, branch_id: branch,
            drawer_id: p.drawerId, opened_by: p.actorId, offline_device_id: p.offlineDeviceId,
            time_zone: p.timeZone, accounting_date: p.accountingDate, opened_at: p.openedAt,
            opening_cash_cents: Math.round(Number(p.openingCash) * 100), status: 'open' });
          statements.push(env.DB.prepare(`INSERT INTO cash_shifts
            (id, tenant_id, branch_id, drawer_id, opened_by, offline_device_id, time_zone, accounting_date, opened_at, opening_cash_cents, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
            ON CONFLICT(id) DO NOTHING`)
            .bind(p.id, p.tenantId, p.branchId, p.drawerId, p.actorId, p.offlineDeviceId, p.timeZone, p.accountingDate,
              p.openedAt, Math.round(Number(p.openingCash) * 100)));
        } else if (['closed_local', 'closed'].includes(p.status)) {
          if (typeof p.closedAt !== 'string' || !p.closedAt || typeof p.closedBy !== 'string' || !p.closedBy)
            return badRequest('Invalid cash shift close');
          if (p.closedBy !== principal.id) return json({ success: false, error: 'Cash shift belongs to another cashier' }, 403);
          if (!Number.isFinite(Number(p.countedCash)) || Number(p.countedCash) < 0) return badRequest('Invalid counted cash');
          const shift = await cashShiftById(p.id);
          if (!shift) return badRequest('Cash shift not found');
          if (shift.opened_by !== principal.id) return json({ success: false, error: 'Cash shift belongs to another cashier' }, 403);
          if (replay && (shift.offline_device_id!==replay.deviceId || shift.drawer_id!==replay.drawerId))
            return json({success:false,error:'Signed shift writer mismatch'},403);
          const movement = await env.DB.prepare('SELECT COALESCE(SUM(amount_cents), 0) AS delta FROM cash_shift_movements WHERE tenant_id = ? AND shift_id = ?')
            .bind(tenantId, p.id).first();
          const expectedCents = shift.opening_cash_cents + Number(movement?.delta || 0) + (pendingCashDeltas.get(p.id) || 0);
          if (expectedCents !== Math.round(Number(p.expectedCash) * 100))
            return json({ success: false, error: 'Cash movements have not fully reconciled; retry after sync' }, 409);
          const countedCents = Math.round(Number(p.countedCash) * 100);
          statements.push(env.DB.prepare(`UPDATE cash_shifts SET status = 'closed', closed_at = ?, closed_by = ?,
            counted_cash_cents = ?, expected_cash_cents = ?, variance_cents = ?
            WHERE id = ? AND tenant_id = ? AND status = 'open'`)
            .bind(p.closedAt, principal.id, countedCents, expectedCents, countedCents - expectedCents, p.id, tenantId));
          replayShifts.set(p.id, { ...shift, status: 'closed' });
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
      // An identical retry must be acknowledged even if its shift has since closed.
      const old = await env.DB.prepare('SELECT * FROM sync_events_v2 WHERE tenant_id = ? AND id = ?').bind(tenantId, event.id).first();
      if (old && (old.entity_type !== event.entityType || old.entity_id !== event.entityId || old.action !== event.action || old.payload_json !== payload || old.branch_id !== branch || old.group_id !== groupId || old.conflict_policy_version !== 1 || old.preconditions_json !== preconditions)) return json({ success: false, error: 'Idempotency conflict' }, 409);
      if (old && event.payload.cashShiftId) {
        if (groupId) {
          const registered=await env.DB.prepare('SELECT event_count FROM sync_commit_groups WHERE tenant_id=? AND group_id=?')
            .bind(tenantId,groupId).first();
          if (!registered || registered.event_count !== groupCounts.get(groupId))
            return json({success:false,error:'Commit group conflict'},409);
        }
        const recorded=await env.DB.prepare('SELECT source_event_id FROM cash_shift_movements WHERE tenant_id=? AND source_event_id=?')
          .bind(tenantId,event.id).first();
        if (!recorded) return json({success:false,error:'Cash source was accepted without its movement'},409);
        continue;
      }
      let cashMovement = null;
      let sourceMovement = null;
      const cashEntityKey = `${branch}:${event.entityType}:${event.entityId}`;
      if (['void','delete'].includes(event.action)) {
        sourceMovement = await env.DB.prepare(`SELECT movement.source_event_id,movement.amount_cents
          FROM cash_shift_movements movement JOIN sync_events_v2 source
            ON source.tenant_id=movement.tenant_id AND source.id=movement.source_event_id
          WHERE source.tenant_id=? AND source.branch_id=? AND source.entity_type=? AND source.entity_id=? AND source.action='create'
          ORDER BY source.sequence LIMIT 1`).bind(tenantId,branch,event.entityType,event.entityId).first();
        sourceMovement ||= pendingCashCreates.get(cashEntityKey) || null;
        if (sourceMovement && !event.payload.cashShiftId)
          return badRequest('Cash correction requires an open shift');
      }
      if (event.payload.cashShiftId) {
        if (!['create','void','delete'].includes(event.action)) return badRequest('Unsupported cash shift mutation');
        const shiftId = event.payload.cashShiftId;
        if (typeof shiftId !== 'string' || shiftId.length > 128 || !branch) return badRequest('Invalid cash shift');
        const shift = await cashShiftById(shiftId);
        if (!shift || shift.tenant_id !== tenantId || shift.branch_id !== branch || shift.status !== 'open')
          return badRequest('Cash shift is not open for this branch');
        if (shift.opened_by !== principal.id) return json({success:false,error:'Cash shift belongs to another cashier'},403);
        if (replay && (shift.offline_device_id!==replay.deviceId || shift.drawer_id!==replay.drawerId))
          return json({success:false,error:'Signed shift writer mismatch'},403);
        const occurredAt = new Date(Number(event.timestamp)).toISOString();
        if (occurredAt < shift.opened_at || accountingDate(occurredAt,shift.time_zone) !== shift.accounting_date)
          return badRequest('Cash event falls outside its open accounting day');
        if (sourceMovement) {
          if (pendingCashReversals.has(sourceMovement.source_event_id))
            return json({success:false,error:'Cash movement has already been reversed in this batch'},409);
          const reversal = await env.DB.prepare('SELECT source_event_id FROM cash_shift_movements WHERE tenant_id=? AND reverses_source_event_id=?')
            .bind(tenantId,sourceMovement.source_event_id).first();
          if (reversal && reversal.source_event_id !== event.id)
            return json({success:false,error:'Cash movement has already been reversed'},409);
        }
        const delta = sourceMovement ? -sourceMovement.amount_cents/100 :
          event.action === 'create' ? cashMovementFromRecord(event.entityType,event.payload) : 0;
        if (delta === 0) return badRequest('Cash shift cannot be assigned to a non-cash event');
        cashMovement = {shiftId,drawerId:shift.drawer_id,accountingDate:shift.accounting_date,
          amountCents:Math.round(delta*100),reversesSourceEventId:sourceMovement?.source_event_id || null};
        pendingCashDeltas.set(shiftId, (pendingCashDeltas.get(shiftId) || 0) + cashMovement.amountCents);
        if (event.action === 'create') pendingCashCreates.set(cashEntityKey,
          {source_event_id:event.id,amount_cents:cashMovement.amountCents});
        else pendingCashReversals.add(sourceMovement.source_event_id);
      }
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
      if (!old && event.entityType === 'settings' && event.payload.timeZone !== undefined)
        statements.push(env.DB.prepare('UPDATE tenants SET time_zone = ? WHERE id = ?')
          .bind(event.payload.timeZone, tenantId));
      statements.push(env.DB.prepare(`INSERT INTO sync_events_v2
        (id, tenant_id, branch_id, entity_type, entity_id, action, payload_json, client_timestamp, server_timestamp, group_id, conflict_policy_version, preconditions_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(tenant_id, id) DO NOTHING`)
        .bind(event.id, principal.tenantId, branch, event.entityType, event.entityId, event.action, payload, Number(event.timestamp) || now, now, groupId, 1, preconditions));
      if (cashMovement) statements.push(env.DB.prepare(`INSERT INTO cash_shift_movements
        (tenant_id,source_event_id,shift_id,branch_id,drawer_id,accounting_date,amount_cents,reverses_source_event_id)
        VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,source_event_id) DO NOTHING`)
        .bind(tenantId,event.id,cashMovement.shiftId,branch,cashMovement.drawerId,cashMovement.accountingDate,
          cashMovement.amountCents,cashMovement.reversesSourceEventId));
    }
    if (cashReplay) for (const event of events) {
      const entry = cashReplayEntry(cashReplay, event);
      statements.push(env.DB.prepare(`INSERT INTO cash_source_proofs
        (tenant_id,event_id,device_id,cashier_id,principal_type,credential_version,drawer_id,proof_json)
        VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,event_id) DO NOTHING`)
        .bind(tenantId,event.id,entry.deviceId,entry.principal.id,entry.principal.type,
          entry.principal.credentialVersion,entry.drawerId,JSON.stringify(entry.proof)));
    }
    if(reviewCommit){const [claim,finish]=resolutionStatements(env,reviewCommit);statements.unshift(claim);statements.push(finish);}
    if (statements.length) await env.DB.batch(statements);
    return json({ success: true, acceptedIds: events.map(event => event.id), syncedCount: events.length });
  } catch (error) {
    if(String(error?.message).includes('UNIQUE constraint failed: cash_shifts.tenant_id, cash_shifts.branch_id, cash_shifts.drawer_id'))
      return json({success:false,error:'Drawer already has an open shift; retain sources for reconciliation'},409);
    if(String(error?.message).includes('CASH_SOURCE_AUTH_CHANGED'))
      return json({success:false,error:'Cashier or drawer authorization changed; retain local sources'},403);
    if(String(error?.message).includes('SYNC_REVIEW_STALE'))return json({success:false,error:'Review changed; refresh before deciding'},409);
    if (String(error?.message).includes('SYNC_IDEMPOTENCY_CONFLICT')) return json({ success: false, error: 'Idempotency conflict' }, 409);
    if (String(error?.message).includes('SYNC_CAUSAL_CONFLICT')) return json({ success: false, error: 'Stale multi-device mutation; synchronize and resolve the conflict' }, 409);
    if (String(error?.message).includes('sync_commit_groups')) return json({ success: false, error: 'Commit group conflict' }, 409);
    return badRequest('Invalid sync request');
  }
}
