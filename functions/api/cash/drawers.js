import { authenticateRequest, requireTenant } from '../../_lib/auth.js';
import { badRequest, forbidden, json, options, readJson } from '../../_lib/http.js';
import { canAccessBranch } from '../../../src/services/branchAccess.js';

export const onRequestOptions = options;
const admin = principal => ['company_owner','admin','super_admin'].includes(principal.role);
const text = (value, limit) => typeof value === 'string' && value.trim() && value.length <= limit;

export async function onRequestGet({request,env}) {
  const auth=await authenticateRequest(request,env);
  if (auth.error) return auth.error;
  const url=new URL(request.url), tenantId=url.searchParams.get('tenantId'), branchId=url.searchParams.get('branchId');
  const denied=requireTenant(auth,tenantId);
  if (denied) return denied;
  if (!text(branchId,128) || !canAccessBranch(auth.principal,branchId)) return forbidden('Branch access denied');
  const rows=await env.DB.prepare('SELECT id,branch_id AS branchId,name,status FROM cash_drawers WHERE tenant_id=? AND branch_id=? ORDER BY created_at,id')
    .bind(tenantId,branchId).all();
  return json({success:true,drawers:rows.results});
}

export async function onRequestPost({request,env}) {
  const auth=await authenticateRequest(request,env);
  if (auth.error) return auth.error;
  try {
    const {tenantId,branchId,id,name}=await readJson(request);
    const denied=requireTenant(auth,tenantId);
    if (denied) return denied;
    if (!admin(auth.principal) || !canAccessBranch(auth.principal,branchId)) return forbidden('Drawer management denied');
    if (![id,branchId].every(value=>text(value,128)) || !text(name,100)) return badRequest('Invalid drawer');
    const branch=await env.DB.prepare("SELECT id FROM branches WHERE id=? AND tenant_id=? AND status='active'").bind(branchId,tenantId).first();
    if (!branch) return badRequest('Unknown active branch');
    await env.DB.prepare('INSERT INTO cash_drawers(id,tenant_id,branch_id,name) VALUES(?,?,?,?)')
      .bind(id,tenantId,branchId,name.trim()).run();
    return json({success:true,id},201);
  } catch(error) {
    if (/UNIQUE constraint failed/.test(error.message)) return json({success:false,error:'Drawer already exists'},409);
    return badRequest(error.message);
  }
}

// Deliberately no reassignment API: an old device may have unsent financial
// work even after 24h. Changing its writer requires an audited recovery flow.
export async function onRequestPatch({request,env}) {
  const auth=await authenticateRequest(request,env);
  if(auth.error)return auth.error;
  try {
    const {tenantId,branchId,drawerId,deviceId}=await readJson(request);
    const denied=requireTenant(auth,tenantId);
    if(denied)return denied;
    if(auth.principal.type!=='tenant'||!['company_owner','super_admin'].includes(auth.principal.role)||
      !canAccessBranch(auth.principal,branchId))return forbidden('Only the company owner can assign its drawer device');
    if(![branchId,drawerId,deviceId].every(value=>text(value,128)))return badRequest('Invalid drawer writer');
    const drawer=await env.DB.prepare("SELECT id FROM cash_drawers WHERE id=? AND tenant_id=? AND branch_id=? AND status='active'")
      .bind(drawerId,tenantId,branchId).first();
    const device=await env.DB.prepare('SELECT id FROM cash_devices WHERE id=? AND tenant_id=? AND revoked_at IS NULL')
      .bind(deviceId,tenantId).first();
    if(!drawer||!device)return badRequest('Unknown active drawer or device');
    const result=await env.DB.prepare(`INSERT INTO cash_drawer_writers(tenant_id,drawer_id,device_id,assigned_by)
      VALUES(?,?,?,?) ON CONFLICT(tenant_id,drawer_id) DO NOTHING`).bind(tenantId,drawerId,deviceId,auth.principal.id).run();
    const saved=await env.DB.prepare('SELECT device_id FROM cash_drawer_writers WHERE tenant_id=? AND drawer_id=?')
      .bind(tenantId,drawerId).first();
    if(saved?.device_id!==deviceId)return json({success:false,error:'Drawer writer already assigned; audited device recovery is required'},409);
    return json({success:true,drawerId,deviceId},result.meta.changes?201:200);
  } catch(error){return badRequest(error.message);}
}
