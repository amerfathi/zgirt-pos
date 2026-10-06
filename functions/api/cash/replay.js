import {authenticateRequest,requireTenant} from '../../_lib/auth.js';
import {json,options,readJson} from '../../_lib/http.js';
import {verifyCashReplay} from '../../_lib/cashReplay.js';
import {onRequestPost as push} from '../sync/push.js';
export const onRequestOptions=options;
export async function onRequestPost({request,env}) {
  const auth=await authenticateRequest(request,env);
  if(auth.error)return auth.error;
  let stage='input';
  try {
    const input=await readJson(request);
    const denied=requireTenant(auth,input.tenantId);if(denied)return denied;
    stage='verification';
    const cashReplay=await verifyCashReplay(env,auth,input);
    stage='dispatch';
    const headers=new Headers(request.headers);headers.delete('Content-Length');
    return await push({env,cashReplay,request:new Request(request.url,{method:'POST',headers,
      body:JSON.stringify({tenantId:input.tenantId,events:input.proofs.map(proof=>proof.source)})})});
  } catch (error) {
    const known=['Invalid signed replay scope','Device replay denied','Replay verification is not configured',
      'Source replay scope denied','Original cashier is not active','Original cashier permission changed',
      'Cash source has no drawer','Drawer writer assignment denied','Unverified source replay',
      'وقت تصريح العمل دون اتصال غير صالح','توقيع مصدر الحركة غير موثوق؛ لم تُقبل الحركة',
      'توقيع تصريح العمل دون اتصال غير موثوق'];
    const reason=known.includes(error?.message)?error.message:'Signature or source validation failed';
    return json({success:false,error:'Signed drawer replay denied; keep local sources for review',reason,stage,
      errorType:error instanceof TypeError?'type':error instanceof SyntaxError?'syntax':'validation'},403);
  }
}
