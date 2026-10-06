import { authenticateRequest } from '../../_lib/auth.js';
import { json } from '../../_lib/http.js';

export async function onRequestGet({ request, env }) {
  const auth = await authenticateRequest(request, env);
  if (auth.error) return auth.error;
  return json({ success: true, user: {
    ...auth.principal,
    syncScopeVersion: auth.principal.type === 'user' ? auth.principal.credentialVersion : 0,
    status: 'active',
    isStaff: auth.principal.type === 'user',
    sessionExpiresAt: auth.session.expires_at
  } });
}
