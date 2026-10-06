import { validateTenantPayload } from '../_lib/syncPolicy.js';
import { authenticateRequest, requireAdmin, requireTenant } from '../_lib/auth.js';
import { badRequest, json, options } from '../_lib/http.js';

const MAX_SNAPSHOT_BYTES = 5 * 1024 * 1024;
export async function onRequestOptions() { return options(); }

export async function onRequestPost({ request, env }) {
  const auth = await authenticateRequest(request, env);
  const adminError = requireAdmin(auth);
  if (adminError) return adminError;
  try {
    const { tenantId, snapshot, version = 'unknown' } = await request.json();
    const accessError = requireTenant(auth, tenantId);
    if (accessError) return accessError;
    validateTenantPayload(snapshot, auth.principal.tenantId);
    const serialized = JSON.stringify(snapshot);
    const sizeBytes = new TextEncoder().encode(serialized).length;
    if (!snapshot || sizeBytes > MAX_SNAPSHOT_BYTES) return badRequest('Invalid or oversized backup');
    const id = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO tenant_backups (id, tenant_id, snapshot_json, size_bytes, version, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))')
      .bind(id, auth.principal.tenantId, serialized, sizeBytes, String(version).slice(0, 32)).run();
    return json({ success: true, backupId: id, sizeBytes });
  } catch { return badRequest('Invalid backup request'); }
}

export async function onRequestGet({ request, env }) {
  const auth = await authenticateRequest(request, env);
  const adminError = requireAdmin(auth);
  if (adminError) return adminError;
  const tenantId = new URL(request.url).searchParams.get('tenantId');
  const accessError = requireTenant(auth, tenantId);
  if (accessError) return accessError;
  const latest = await env.DB.prepare('SELECT id, tenant_id, snapshot_json, size_bytes, version, created_at FROM tenant_backups WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1')
    .bind(auth.principal.tenantId).first();
  if (!latest) return json({ success: true, backup: null });
  try { latest.snapshot = JSON.parse(latest.snapshot_json); } catch { return json({ success: false, error: 'Backup is corrupt' }, 500); }
  delete latest.snapshot_json;
  return json({ success: true, backup: latest });
}
