import { authenticateRequest, requireTenant } from '../../_lib/auth.js';
import { canSync } from '../../_lib/syncPolicy.js';
import { json, options } from '../../_lib/http.js';

export const onRequestOptions = options;

// Read-only migration checkpoint. Branch-scoped identities cannot attest to
// the complete tenant branch set, so they must not receive this manifest.
export async function onRequestGet({ request, env }) {
  const auth = await authenticateRequest(request, env);
  if (auth.error) return auth.error;
  const tenantId = new URL(request.url).searchParams.get('tenantId');
  const accessError = requireTenant(auth, tenantId);
  if (accessError) return accessError;
  if (auth.principal.branchId !== 'all' || !canSync(auth.principal, 'branch'))
    return json({ success: false, error: 'Complete branch access required' }, 403);
  const [branchResult, sequenceResult, headsResult] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM branches WHERE tenant_id = ? ORDER BY id').bind(tenantId),
    env.DB.prepare('SELECT COALESCE(MAX(sequence), 0) AS latest_sequence FROM sync_events_v2 WHERE tenant_id = ?').bind(tenantId),
    env.DB.prepare('SELECT conflict_key,last_event_id FROM sync_conflict_heads WHERE tenant_id = ? ORDER BY conflict_key').bind(tenantId)
  ]);
  return json({ success: true, tenantId, fullTenantVisibility: true,
    latestSequence: sequenceResult.results[0].latest_sequence,
    conflictHeads: Object.fromEntries(headsResult.results.map(row=>[row.conflict_key,row.last_event_id])),
    branches: branchResult.results.map(row => ({
      id: row.id, tenantId: row.tenant_id, name: row.name, code: row.code || '',
      phone: row.phone || '', address: row.address || '', managerName: row.manager_name || '',
      isMain: Boolean(row.is_main), status: row.status
    })) });
}
