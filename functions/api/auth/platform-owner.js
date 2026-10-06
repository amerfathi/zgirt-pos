import { authenticateRequest, requireSuperAdmin } from '../../_lib/auth.js';
import { hashPassword, verifyPassword } from '../../_lib/passwords.js';
import { badRequest, json, options, readJson } from '../../_lib/http.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function authorize(request, env) {
  const auth = await authenticateRequest(request, env);
  const denied = requireSuperAdmin(auth);
  return denied ? { denied } : { auth };
}

export async function onRequestOptions() { return options(); }

export async function onRequestGet({ request, env }) {
  const result = await authorize(request, env);
  if (result.denied) return result.denied;
  const { auth } = result;
  const owner = await env.DB.prepare(
    "SELECT username, created_at, updated_at FROM tenants WHERE id=? AND role='super_admin' LIMIT 1"
  ).bind(auth.principal.id).first();
  if (!owner) return json({ success: false, error: 'Platform owner account was not found' }, 404);
  const { results: events } = await env.DB.prepare(
    'SELECT id,event_type,metadata_json,created_at FROM platform_security_events WHERE tenant_id=? ORDER BY created_at DESC,id DESC LIMIT 25'
  ).bind(auth.principal.tenantId).all();
  return json({ success: true, owner: { email: owner.username, createdAt: owner.created_at, updatedAt: owner.updated_at },
    events: events.map(event => ({ id: event.id, type: event.event_type,
      metadata: safeMetadata(event.metadata_json), createdAt: event.created_at })) });
}

export async function onRequestPatch({ request, env }) {
  const result = await authorize(request, env);
  if (result.denied) return result.denied;
  const { auth } = result;
  try {
    return await changeOwnerCredentials(auth, env, await readJson(request, 4096));
  } catch (error) {
    if (/UNIQUE constraint failed/i.test(String(error?.message || error)))
      return json({ success: false, error: 'Email is already in use' }, 409);
    return badRequest(error?.message || 'Invalid platform owner credential change');
  }
}

export async function changeOwnerCredentials(auth, env, body) {
  if (!auth?.principal?.isSuperAdmin) return json({ success: false, error: 'Super administrator permission required' }, 403);
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newEmail = typeof body.newEmail === 'string' ? body.newEmail.trim().toLowerCase() : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';
    if (!currentPassword) return badRequest('Current password is required');
    if (!newEmail && !newPassword) return badRequest('Email or password change is required');
    if (newEmail && (newEmail.length > 254 || !emailPattern.test(newEmail))) return badRequest('A valid owner email is required');
    if (newPassword !== confirmPassword) return badRequest('New password confirmation does not match');
    if (newPassword && newPassword === currentPassword) return badRequest('New password must differ from current password');

    const owner = await env.DB.prepare(
      "SELECT id,username,password_hash,role,status FROM tenants WHERE id=? AND role='super_admin' LIMIT 1"
    ).bind(auth.principal.id).first();
    if (!owner || owner.status !== 'active') return json({ success: false, error: 'Platform owner account is unavailable' }, 403);
    if (!(await verifyPassword(currentPassword, owner.password_hash, env)).valid)
      return json({ success: false, error: 'Invalid current password' }, 403);
    if (newEmail && newEmail !== owner.username.toLowerCase()) {
      const duplicate = await env.DB.prepare('SELECT id FROM tenants WHERE LOWER(username)=? AND id<>? UNION SELECT id FROM users WHERE LOWER(username)=? LIMIT 1')
        .bind(newEmail, owner.id, newEmail).first();
      if (duplicate) return json({ success: false, error: 'Email is already in use' }, 409);
    }

    const fields = [];
    const assignments = [];
    const values = [];
    if (newEmail && newEmail !== owner.username.toLowerCase()) { assignments.push('username=?'); values.push(newEmail); fields.push('email'); }
    if (newPassword) { assignments.push('password_hash=?'); values.push(await hashPassword(newPassword, env)); fields.push('password'); }
    if (!fields.length) return badRequest('No credential change was requested');
    assignments.push("auth_version=COALESCE(auth_version,0)+1", "updated_at=datetime('now')");
    values.push(owner.id);
    const eventId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(`UPDATE tenants SET ${assignments.join(',')} WHERE id=? AND role='super_admin'`).bind(...values),
      env.DB.prepare("UPDATE sessions SET revoked_at=datetime('now') WHERE tenant_id=? AND revoked_at IS NULL").bind(auth.principal.tenantId),
      env.DB.prepare('INSERT INTO platform_security_events(id,tenant_id,actor_principal_id,event_type,metadata_json) VALUES(?,?,?,?,?)')
        .bind(eventId, auth.principal.tenantId, auth.principal.id, 'platform_owner_credentials_changed', JSON.stringify({ fields, allSessionsRevoked: true }))
    ]);
    return json({ success: true, signInRequired: true, changed: fields });
}

function safeMetadata(value) {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}
