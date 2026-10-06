import {verifyOfflineCashEvent} from '../../src/services/verifiedOfflineGrant.js';
import {assignedBranchIds,canAccessBranch} from '../../src/services/branchAccess.js';
import {hashCashDeviceProof} from './cashDeviceProof.js';
import {canSync} from './syncPolicy.js';

const contexts=new WeakMap();
// Only a verified opaque handle can change the source actor inside sync/push.
export async function verifyCashReplay(env,auth,input) {
  const {tenantId,deviceId,deviceProof,proofs}=input;
  if(tenantId!==auth.principal.tenantId || typeof deviceId!=='string' || !deviceId ||
    !Array.isArray(proofs)||proofs.length<1||proofs.length>100)throw Error('Invalid signed replay scope');
  const device=await env.DB.prepare('SELECT device_proof_hash,revoked_at FROM cash_devices WHERE tenant_id=? AND id=?').bind(tenantId,deviceId).first();
  if(!device||device.revoked_at||device.device_proof_hash!==await hashCashDeviceProof(env.AUTH_SECRET,deviceProof))throw Error('Device replay denied');
  const key=JSON.parse(env.OFFLINE_GRANT_PRIVATE_JWK||'null');
  if(key?.kty!=='EC'||key.crv!=='P-256'||!key.d)throw Error('Replay verification is not configured');
  const pin={kty:'EC',crv:'P-256',x:key.x,y:key.y};
  const entries=new Map(),shifts=new Map(),principals=new Map();
  for(const proof of proofs) {
    const verified=await verifyOfflineCashEvent(proof,pin,{tenantId,deviceId});
    const source=verified.source,claims=proof.grant.claims;
    if(entries.has(source.id)||!['tenant','user'].includes(claims.principalType)||
      !Number.isSafeInteger(claims.credentialVersion)||!canAccessBranch(auth.principal,source.branchId))throw Error('Source replay scope denied');
    const actorKey=`${claims.principalType}:${verified.cashierId}`;
    let principal=principals.get(actorKey);
    if(!principal) {
      const row=claims.principalType==='tenant'
        ? await env.DB.prepare('SELECT id,role,status,auth_version FROM tenants WHERE id=?').bind(verified.cashierId).first()
        : await env.DB.prepare('SELECT id,tenant_id,role,status,auth_version,branch_id,branch_ids_json,permissions_json FROM users WHERE id=? AND tenant_id=?').bind(verified.cashierId,tenantId).first();
      if(!row||row.status!=='active'||(claims.principalType==='tenant'&&row.id!==tenantId))throw Error('Original cashier is not active');
      const branchIds=claims.principalType==='tenant'?['all']:assignedBranchIds({branchId:row.branch_id,branchIds:row.branch_ids_json?JSON.parse(row.branch_ids_json):undefined});
      principal={id:row.id,tenantId,type:claims.principalType,role:row.role,credentialVersion:Number(row.auth_version||0),
        branchIds,branchId:branchIds.includes('all')?'all':branchIds[0]||null,permissions:JSON.parse(row.permissions_json||'{}')};
      principals.set(actorKey,principal);
    }
    if(principal.credentialVersion!==claims.credentialVersion||!canAccessBranch(principal,source.branchId)||
      !canSync(principal,source.entityType,source.action))throw Error('Original cashier permission changed');
    if(source.entityType==='cash_shift')shifts.set(source.entityId,source.payload);
    entries.set(source.id,{proof,source,principal,deviceId});
  }
  for(const entry of entries.values()) {
    const {source,proof}=entry;
    let drawerId=source.entityType==='cash_shift'?source.payload.drawerId:null;
    if(source.payload.cashShiftId) {
      const shift=shifts.get(source.payload.cashShiftId)||await env.DB.prepare('SELECT drawer_id AS drawerId FROM cash_shifts WHERE tenant_id=? AND id=?')
        .bind(tenantId,source.payload.cashShiftId).first();
      drawerId=shift?.drawerId;
      if(!drawerId)throw Error('Cash source has no drawer');
    }
    const rows=await env.DB.prepare(`SELECT w.drawer_id AS id FROM cash_drawer_writers w
      JOIN cash_drawers d ON d.id=w.drawer_id AND d.tenant_id=w.tenant_id
      WHERE w.tenant_id=? AND w.device_id=? AND d.branch_id=? AND d.status='active'`)
      .bind(tenantId,deviceId,source.branchId).all();
    const assigned=rows.results.filter(row=>proof.grant.claims.drawerIds?.includes(row.id));
    if(!assigned.length||(drawerId&&!assigned.some(row=>row.id===drawerId)))throw Error('Drawer writer assignment denied');
    entry.drawerId=drawerId||assigned[0].id;
  }
  const handle=Object.freeze({});contexts.set(handle,entries);return handle;
}

export function cashReplayEntry(handle,event) {
  const entry=contexts.get(handle)?.get(event.id);
  if(!entry||JSON.stringify(entry.source)!==JSON.stringify(event))throw Error('Unverified source replay');
  return entry;
}
