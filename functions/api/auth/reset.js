import { json, readJson, badRequest } from '../../_lib/http.js';
import { hashPassword } from '../../_lib/passwords.js';
import { rateLimit } from '../../_lib/rateLimit.js';
export async function onRequestPost({ request, env }) {
  try {
    const limited = await rateLimit(request,env,'password-reset');
    if (limited) return limited;
    const { resetToken, newPassword } = await readJson(request,4096);
    if (typeof resetToken !== 'string' || !/^[a-f0-9]{64}$/.test(resetToken)) return badRequest('Invalid reset token');
    const tokenHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(resetToken))), b=>b.toString(16).padStart(2,'0')).join('');
    const row = await env.DB.prepare("SELECT * FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL AND datetime(expires_at)>datetime('now')").bind(tokenHash).first();
    if (!row) return badRequest('Invalid or expired reset token');
    if (!['tenant','user'].includes(row.principal_type)) return badRequest('Invalid reset principal');
    const hashed = await hashPassword(newPassword, env);
    const accountUpdate = row.principal_type === 'tenant'
      ? env.DB.prepare(`UPDATE tenants SET password_hash=?,auth_version=COALESCE(auth_version,0)+1 WHERE id=? AND id=? AND EXISTS
        (SELECT 1 FROM password_reset_tokens WHERE token_hash=? AND principal_type='tenant' AND used_at IS NULL AND datetime(expires_at)>datetime('now'))`)
        .bind(hashed,row.principal_id,row.tenant_id,tokenHash)
      : env.DB.prepare(`UPDATE users SET password_hash=?,auth_version=COALESCE(auth_version,0)+1 WHERE id=? AND tenant_id=? AND EXISTS
        (SELECT 1 FROM password_reset_tokens WHERE token_hash=? AND principal_type='user' AND used_at IS NULL AND datetime(expires_at)>datetime('now'))`)
        .bind(hashed,row.principal_id,row.tenant_id,tokenHash);
    const results = await env.DB.batch([
      accountUpdate,
      env.DB.prepare("UPDATE sessions SET revoked_at=datetime('now') WHERE tenant_id=? AND principal_id=? AND principal_type=? AND revoked_at IS NULL")
        .bind(row.tenant_id,row.principal_id,row.principal_type),
      env.DB.prepare("UPDATE password_reset_tokens SET used_at=datetime('now') WHERE token_hash=? AND used_at IS NULL").bind(tokenHash),
      env.DB.prepare(`INSERT INTO platform_security_events(id,tenant_id,actor_principal_id,event_type,metadata_json)
        SELECT ?,?,?,?,? WHERE ?='tenant' AND EXISTS(SELECT 1 FROM tenants WHERE id=? AND role='super_admin')`)
        .bind(crypto.randomUUID(),row.tenant_id,row.principal_id,'platform_owner_password_initialized',JSON.stringify({ allSessionsRevoked: true }),row.principal_type,row.principal_id)
    ]);
    return results[0].meta.changes ? json({success:true}) : badRequest('Invalid or consumed reset token');
  } catch { return badRequest('Invalid reset request'); }
}
