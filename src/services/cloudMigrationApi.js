import { apiFetch } from './authSession.js';
import { getApiBaseUrl } from '../config/appVersion.js';
import { verifyCloudCheckpoint } from './legacyMigrationAudit.js';

export async function fetchCloudCheckpointPage({ tenantId, cursor, limit }) {
  const response = await apiFetch(`${getApiBaseUrl()}/api/sync/pull?tenantId=${encodeURIComponent(tenantId)}&cursor=${cursor}&limit=${limit}`,
    { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`تعذر قراءة سجل الشركة من الخادم: HTTP ${response.status}`);
  return response.json();
}

export function auditLegacyCloudCheckpoint(snapshot) {
  return verifyCloudCheckpoint(snapshot, fetchCloudCheckpointPage);
}

export async function fetchServerBranchManifest({ tenantId }) {
  const response = await apiFetch(`${getApiBaseUrl()}/api/branches?tenantId=${encodeURIComponent(tenantId)}`,
    { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`تعذر قراءة فروع الشركة من الخادم: HTTP ${response.status}`);
  return response.json();
}
