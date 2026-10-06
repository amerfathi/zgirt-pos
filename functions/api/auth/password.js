import { authenticateRequest } from '../../_lib/auth.js';
import { hashPassword, verifyPassword } from '../../_lib/passwords.js';
import { json, readJson, badRequest } from '../../_lib/http.js';
import { changeOwnerCredentials } from './platform-owner.js';
export async function onRequestPost({ request, env }) {
  const auth = await authenticateRequest(request, env);
  if (auth.error) return auth.error;
  try {
    const { currentPassword, newPassword } = await readJson(request, 4096);
    if (auth.principal.isSuperAdmin) return await changeOwnerCredentials(auth, env, {
      currentPassword, newPassword, confirmPassword: newPassword
    });
    if (newPassword === currentPassword) return badRequest('New password must differ from current password');
    const table = auth.principal.type === 'tenant' ? 'tenants' : 'users';
    const row = await env.DB.prepare(`SELECT password_hash FROM ${table} WHERE id = ?`).bind(auth.principal.id).first();
    if (!(await verifyPassword(currentPassword, row.password_hash, env)).valid) return json({ success: false, error: 'Invalid current password' }, 403);
    const hashed = await hashPassword(newPassword, env);
    await env.DB.batch([
      env.DB.prepare(`UPDATE ${table} SET password_hash = ?, auth_version = auth_version + 1 WHERE id = ?`).bind(hashed, auth.principal.id),
      env.DB.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE principal_id = ? AND principal_type = ?").bind(auth.principal.id, auth.principal.type)
    ]);
    return json({ success: true, signInRequired: true });
  } catch { return badRequest('Invalid password change request'); }
}
