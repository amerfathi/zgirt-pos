import { authenticateRequest, requireTenant } from '../../_lib/auth.js';
import { json, options, readJson, badRequest } from '../../_lib/http.js';
import { canSync } from '../../_lib/syncPolicy.js';
import { canAccessBranch } from '../../../src/services/branchAccess.js';
import { readLegacyProductProofs } from '../../_lib/legacyProductReference.js';
export const onRequestOptions=options;
export async function onRequestPost({request,env}) {
  const auth=await authenticateRequest(request,env);
  if(auth.error)return auth.error;
  try {
    const {tenantId,references}=await readJson(request);
    const denied=requireTenant(auth,tenantId);if(denied)return denied;
    if(!Array.isArray(references)||!references.length||references.length>50 ||
      references.some(ref=>![ref?.parentId,ref?.productId].every(id=>typeof id==='string'&&id&&id.length<=128)))return badRequest('Invalid references');
    if(!canSync(auth.principal,'invoice')||!canSync(auth.principal,'product'))return json({success:false,error:'Access denied'},403);
    const revision=await env.DB.prepare('SELECT COALESCE(MAX(sequence),0) cursor FROM sync_events_v2 WHERE tenant_id=?').bind(tenantId).first();
    const proofs=(await readLegacyProductProofs(env,tenantId,references,revision.cursor)).filter(proof=>proof&&canAccessBranch(auth.principal,proof.branchId));
    const current=await env.DB.prepare('SELECT COALESCE(MAX(sequence),0) cursor FROM sync_events_v2 WHERE tenant_id=?').bind(tenantId).first();
    if(current.cursor!==revision.cursor)return json({success:false,error:'Reference history changed; retry proof'},409);
    return json({success:true,tenantId,proofs});
  }catch{return badRequest('Dependency proof failed');}
}
