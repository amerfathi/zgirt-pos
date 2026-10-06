/** Authentication endpoint. Store/user discovery is intentionally not exposed. */
import { badRequest, json, options, readJson } from '../../_lib/http.js';
import { createSession } from '../../_lib/auth.js';
import { verifyPassword } from '../../_lib/passwords.js';
import { assignedBranchIds, visibleBranches } from '../../../src/services/branchAccess.js';

import { rateLimit } from '../../_lib/rateLimit.js';

export async function onRequestOptions() { return options(); }
export async function onRequestGet() { return json({ success: false, error: 'Use POST to authenticate' }, 405); }

export async function onRequestPost({ request, env }) {
  if (!env?.DB || !env?.AUTH_SECRET) return json({ success: false, error: 'Authentication service is unavailable' }, 503);
  try {
    const limited = await rateLimit(request, env, 'login');
    if (limited) return limited;
    const { storeCode, username, password } = await readJson(request, 4096);
    const code = String(storeCode || '').trim().toUpperCase();
    const user = String(username || '').trim().toLowerCase();
    if (!code || !user || typeof password !== 'string') return badRequest('Store code, username and password are required');

    const tenant = await env.DB.prepare('SELECT * FROM tenants WHERE UPPER(store_code) = ? LIMIT 1').bind(code).first();
    // One generic error prevents store, username, and staff enumeration.
    if (!tenant || tenant.status !== 'active' || (tenant.expires_at && tenant.expires_at.slice(0,10) < new Date().toISOString().slice(0,10))) return json({ success: false, error: 'Invalid sign-in details' }, 401);

    let principal = null;
    if (tenant.username.toLowerCase() === user) {
      const result = await verifyPassword(password, tenant.password_hash, env);
      if (result.valid) {
        const credentialVersion = Number(tenant.auth_version || 0) + (result.legacy ? 1 : 0);
        principal = { id: tenant.id, tenantId: tenant.id, type: 'tenant', role: tenant.role, credentialVersion };
      }
    }
    if (!principal) {
      const staff = await env.DB.prepare('SELECT * FROM users WHERE tenant_id = ? AND LOWER(username) = ? LIMIT 1').bind(tenant.id, user).first();
      if (staff?.status === 'active') {
        const result = await verifyPassword(password, staff.password_hash, env);
        if (result.valid) {
          const credentialVersion = Number(staff.auth_version || 0) + (result.legacy ? 1 : 0);
          principal = { id: staff.id, tenantId: tenant.id, type: 'user', role: staff.role, credentialVersion, staff };
        }
      }
    }
    if (!principal) return json({ success: false, error: 'Invalid sign-in details' }, 401);
    const session = await createSession(env, principal);
    const staff = principal.staff;
    const { results: branchRows } = await env.DB.prepare('SELECT * FROM branches WHERE tenant_id = ? ORDER BY is_main DESC, created_at, id')
      .bind(tenant.id).all();
    const branches = branchRows.map(row => ({
      id: row.id, tenantId: row.tenant_id, name: row.name, code: row.code || '',
      phone: row.phone || '', address: row.address || '', managerName: row.manager_name || '',
      isMain: Boolean(row.is_main), status: row.status, createdAt: row.created_at
    }));
    const branchIds = principal.type === 'tenant' ? ['all'] : assignedBranchIds({
      branchId: staff.branch_id,
      branchIds: staff.branch_ids_json ? JSON.parse(staff.branch_ids_json) : undefined
    });
    const loginUser = {
      id: principal.id, tenantId: tenant.id, branchId: branchIds.includes('all') ? 'all' : branchIds[0] || null,
      branchIds, username: user,
      name: staff?.name || tenant.company_name, role: principal.role,
      syncScopeVersion: principal.type === 'user' ? principal.credentialVersion : 0,
      permissions: staff ? JSON.parse(staff.permissions_json || '{}') : {},
      storeCode: tenant.store_code, companyName: tenant.company_name
    };
    return json({ success: true, authenticated: true, userType: principal.type === 'tenant' ? 'owner' : 'staff', session, user: loginUser,
      tenant: { id: tenant.id, storeCode: tenant.store_code, companyName: tenant.company_name, status: tenant.status,
        expiresAt: tenant.expires_at, allowedBranches: tenant.allowed_branches }, branches: visibleBranches(loginUser, branches) });
  } catch {
    return json({ success: false, error: 'Authentication failed' }, 500);
  }
}
