import { authenticateRequest, requireTenant } from '../../_lib/auth.js';
import { badRequest, forbidden, json, options, readJson } from '../../_lib/http.js';
import { canSync } from '../../_lib/syncPolicy.js';
import { hashCashDeviceProof } from '../../_lib/cashDeviceProof.js';

export const onRequestOptions = options;
const text = (value, limit) => typeof value === 'string' && value.trim() && value.length <= limit;
const deviceProofPattern = /^[a-f0-9]{64}$/;

// One online authorization registers a physical device for a tenant. A later
// authenticated cashier can then obtain a signed 24-hour offline grant bound to
// that device. Registration does not itself grant offline access.
export async function onRequestPost({ request, env }) {
  const auth = await authenticateRequest(request, env);
  if (auth.error) return auth.error;
  try {
    const input = await readJson(request);
    const denied = requireTenant(auth, input.tenantId);
    if (denied) return denied;
    if (!canSync(auth.principal, 'invoice', 'create')) return forbidden('Device registration denied');
    if (!text(input.deviceId, 128) || !deviceProofPattern.test(input.deviceProof || ''))
      return badRequest('Invalid device identity');
    const proofHash = await hashCashDeviceProof(env.AUTH_SECRET, input.deviceProof);
    const existing = await env.DB.prepare('SELECT device_proof_hash, revoked_at FROM cash_devices WHERE tenant_id = ? AND id = ?')
      .bind(auth.principal.tenantId, input.deviceId).first();
    if (existing && !existing.revoked_at && existing.device_proof_hash === proofHash)
      return json({ success: true, deviceId: input.deviceId }, 200);
    if (existing && !existing.revoked_at)
      return json({ success: false, error: 'Device already registered with a different proof' }, 409);
    if (existing && existing.revoked_at)
      return forbidden('Device is revoked; supervisor re-enrollment is required');
    const inserted = await env.DB.prepare(`INSERT INTO cash_devices (id, tenant_id, device_proof_hash, registered_by)
      VALUES (?, ?, ?, ?) ON CONFLICT(tenant_id, id) DO NOTHING`)
      .bind(input.deviceId, auth.principal.tenantId, proofHash, auth.principal.id).run();
    const registered = await env.DB.prepare('SELECT device_proof_hash, revoked_at FROM cash_devices WHERE tenant_id = ? AND id = ?')
      .bind(auth.principal.tenantId, input.deviceId).first();
    if (!registered || registered.revoked_at) return forbidden('Device enrollment denied');
    if (registered.device_proof_hash !== proofHash)
      return json({ success: false, error: 'Device already registered with a different proof' }, 409);
    return json({ success: true, deviceId: input.deviceId }, inserted.meta.changes ? 201 : 200);
  } catch (error) {
    if (error instanceof SyntaxError) return badRequest('Invalid JSON');
    return badRequest(error.message);
  }
}
