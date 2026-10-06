import { authenticateRequest, requireTenant } from '../../_lib/auth.js';
import { forbidden, json, options } from '../../_lib/http.js';
import { canAccessBranch } from '../../../src/services/branchAccess.js';

export const onRequestOptions = options;
const text = (value, limit) => typeof value === 'string' && value.trim() && value.length <= limit;

export async function onRequestGet({request,env}) {
  const auth=await authenticateRequest(request,env);
  if (auth.error) return auth.error;
  const url=new URL(request.url),tenantId=url.searchParams.get('tenantId'),branchId=url.searchParams.get('branchId');
  const denied=requireTenant(auth,tenantId);
  if (denied) return denied;
  if (!text(branchId,128) || !canAccessBranch(auth.principal,branchId)) return forbidden('Branch access denied');
  const rows=await env.DB.prepare(`SELECT id,tenant_id,branch_id,drawer_id,opened_by,offline_device_id,time_zone,
    accounting_date,opened_at,opening_cash_cents,status,closed_at,closed_by,counted_cash_cents,expected_cash_cents,variance_cents
    FROM cash_shifts WHERE tenant_id=? AND branch_id=? ORDER BY opened_at DESC,id DESC LIMIT 200`)
    .bind(tenantId,branchId).all();
  return json({success:true,shifts:rows.results});
}

export async function onRequestPost({request,env}) {
  const auth=await authenticateRequest(request,env);
  // Mutation is available only through the verified signed replay context.
  return auth.error || forbidden('Use signed drawer replay; legacy shift opening is disabled');
}
