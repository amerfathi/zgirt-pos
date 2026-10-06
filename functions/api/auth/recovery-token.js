import { authenticateRequest, requireAdmin, requireTenant } from '../../_lib/auth.js';
import { json, readJson, badRequest } from '../../_lib/http.js';
export async function onRequestPost({ request, env }) {
  const auth = await authenticateRequest(request, env);
  const denied = requireAdmin(auth);
  if (denied) return denied;
  try {
    const { tenantId, userId } = await readJson(request, 4096);
    const access = requireTenant(auth, tenantId);
    if (access) return access;
    const user = await env.DB.prepare('SELECT id FROM users WHERE tenant_id = ? AND id = ?').bind(tenantId, userId).first();
    if (!user) return json({ success: false, error: 'User not found' }, 404);
    const token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))), b => b.toString(16).padStart(2,'0')).join('');
    await env.DB.prepare("INSERT INTO password_reset_tokens (token_hash,tenant_id,principal_id,principal_type,expires_at,created_by) VALUES (?,?,?,'user',datetime('now','+15 minutes'),?)")
      .bind(hash,tenantId,userId,auth.principal.id).run();
    return json({ success: true, resetToken: token, expiresInSeconds: 900 });
  } catch { return badRequest('Invalid recovery request'); }
}
