import { forbidden, unauthorized } from './http.js';
import { assignedBranchIds } from '../../src/services/branchAccess.js';

const encoder = new TextEncoder();

async function digest(value) {
  const raw = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(raw), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function createSession(env, principal) {
  if (!env?.DB || typeof env.AUTH_SECRET !== 'string' || env.AUTH_SECRET.length < 32) throw new Error('Server authentication is not configured');
  const token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(`INSERT INTO sessions
    (id, token_hash, tenant_id, principal_id, principal_type, credential_version, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`).bind(
    id, await digest(`${env.AUTH_SECRET}:${token}`), principal.tenantId, principal.id,
    principal.type, principal.credentialVersion || 0, expiresAt
  ).run();
  return { token, expiresAt };
}

export async function authenticateRequest(request, env) {
  if (!env?.DB || typeof env.AUTH_SECRET !== 'string' || env.AUTH_SECRET.length < 32) return { error: unauthorized('Server authentication is not configured') };
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return { error: unauthorized() };
  const token = header.slice(7).trim();
  if (!/^[a-f0-9]{64}$/.test(token)) return { error: unauthorized() };
  const session = await env.DB.prepare(`SELECT * FROM sessions
    WHERE token_hash = ? AND revoked_at IS NULL AND datetime(expires_at) > datetime('now') LIMIT 1`)
    .bind(await digest(`${env.AUTH_SECRET}:${token}`)).first();
  if (!session) return { error: unauthorized('Session is expired or invalid') };

  let principal;
  if (session.principal_type === 'tenant') {
    principal = await env.DB.prepare(`SELECT id, role, status, auth_version FROM tenants WHERE id = ? LIMIT 1`)
      .bind(session.principal_id).first();
  } else {
    principal = await env.DB.prepare(`SELECT id, tenant_id, role, status, branch_id, branch_ids_json, permissions_json, auth_version FROM users WHERE id = ? LIMIT 1`)
      .bind(session.principal_id).first();
  }
  const tenant = await env.DB.prepare('SELECT id, status, expires_at FROM tenants WHERE id = ?').bind(session.tenant_id).first();
  const belongs = session.principal_type === 'tenant' ? principal?.id === session.tenant_id : principal?.tenant_id === session.tenant_id;
  if (!principal || !belongs || !tenant || tenant.status !== 'active' ||
      (tenant.expires_at && tenant.expires_at.slice(0, 10) < new Date().toISOString().slice(0, 10)) ||
      principal.status !== 'active' || Number(principal.auth_version || 0) !== Number(session.credential_version || 0)) {
    return { error: unauthorized('Session is no longer valid') };
  }
  const branchIds = session.principal_type === 'tenant' ? ['all'] : assignedBranchIds({
    branchId: principal.branch_id,
    branchIds: principal.branch_ids_json ? safeJson(principal.branch_ids_json) : undefined
  });
  return { session, principal: {
    id: principal.id, tenantId: session.tenant_id, type: session.principal_type,
    role: principal.role, branchId: branchIds.includes('all') ? 'all' : branchIds[0] || null, branchIds,
    credentialVersion: Number(principal.auth_version || 0),
    permissions: safeJson(principal.permissions_json), isSuperAdmin: session.principal_type === 'tenant' && principal.role === 'super_admin'
  }};
}

function safeJson(value) { try { return JSON.parse(value || '{}'); } catch { return {}; } }

export function requireTenant(auth, requestedTenantId) {
  if (auth.error) return auth.error;
  if (!requestedTenantId || auth.principal.tenantId !== requestedTenantId) return forbidden('Tenant access denied');
  return null;
}

export function requireAdmin(auth) {
  if (auth.error) return auth.error;
  if (!['super_admin', 'company_owner', 'admin'].includes(auth.principal.role)) return forbidden('Administrator permission required');
  return null;
}

export function requireSuperAdmin(auth) {
  if (auth.error) return auth.error;
  if (!auth.principal.isSuperAdmin) return forbidden('Super administrator permission required');
  return null;
}

export async function revokePrincipalSessions(env, principalId) {
  await env.DB.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE principal_id = ? AND revoked_at IS NULL")
    .bind(principalId).run();
}
