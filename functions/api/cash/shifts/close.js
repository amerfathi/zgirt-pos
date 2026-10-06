import { authenticateRequest } from '../../../_lib/auth.js';
import { forbidden, options } from '../../../_lib/http.js';

export const onRequestOptions = options;

export async function onRequestPost({request,env}) {
  const auth=await authenticateRequest(request,env);
  // A device proof alone cannot attest the original cashier or pending sources.
  // Close travels with its original signed journal chain through cash/replay.
  return auth.error || forbidden('Use signed drawer replay; legacy shift closure is disabled');
}
