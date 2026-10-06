// Thin, injectable wiring between the local unlock primitives and the server.
// Actual login calls this only with an explicitly provisioned cashGrantStore.
// Production does not provision it yet; offline cashier UI remains hidden.
import { OfflineGrantStore } from './offlineGrantStore.js';
import { ensureOfflineDeviceIdentity } from './offlineDeviceIdentity.js';
import { enrollOfflineGrant, unlockOfflineGrant, offlineIdentityFromUnlockedGrant } from './offlineUnlock.js';
import { setOfflineSession } from './authSession.js';
import { OFFLINE_GRANT_PUBLIC_JWK } from '../config/offlineGrantPublicKey.js';

const primaryBranch = user => {
  if (user?.branchId && user.branchId !== 'all') return user.branchId;
  const list = Array.isArray(user?.branchIds) ? user.branchIds.filter(id => typeof id === 'string' && id && id !== 'all') : [];
  return list[0] || null;
};

const authHeaders = token => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });

async function postJson(fetchFn, url, token, body) {
  const response = await fetchFn(url, { method: 'POST', headers: authHeaders(token), body: JSON.stringify(body) });
  const parsed = await response.json();
  if (!response.ok || !parsed?.success) {
    throw new Error(parsed?.error || 'تعذر الاتصال بخدمة التصاريح');
  }
  return parsed;
}

export async function enrollOnline(input) {
  const { store, apiBaseUrl, token, user, password } = input;
  const fetchFn = input.fetchFn ?? globalThis.fetch;
  const pinnedPublicJwk = input.pinnedPublicJwk ?? OFFLINE_GRANT_PUBLIC_JWK;
  if (!(store instanceof OfflineGrantStore)) throw new Error('تخزين التصاريح غير متاح');
  if (!user?.tenantId || !user?.id || typeof password !== 'string' || !password)
    throw new Error('هوية المحاسب أو كلمة المرور غير صالحة');
  const branchId = primaryBranch(user);
  if (!branchId) throw new Error('المحاسب غير مخصص لأي فرع');
  const { deviceId, deviceProof } = await ensureOfflineDeviceIdentity(store);
  const scope = { tenantId: user.tenantId, cashierId: user.id, deviceId, branchId };
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const eventPublicJwk=await crypto.subtle.exportKey('jwk',pair.publicKey);
  const eventPrivateJwk=await crypto.subtle.exportKey('jwk',pair.privateKey);
  await postJson(fetchFn, `${apiBaseUrl}/api/cash/devices`, token, { tenantId: user.tenantId, deviceId, deviceProof });
  const issued = await postJson(fetchFn, `${apiBaseUrl}/api/cash/grants`, token, { tenantId: user.tenantId, deviceId, deviceProof,eventPublicJwk });
  if (!issued.grant?.claims?.eventPublicJwk) throw new Error('الخادم لا يدعم إثبات مصدر الحركات؛ لم يُحفظ التصريح');
  const record = await enrollOfflineGrant({
    envelope: issued.grant, password, ...scope, pinnedPublicJwk,eventPrivateJwk
  });
  await store.saveRecord({ tenantId: scope.tenantId, cashierId: scope.cashierId, deviceId }, record);
  return { deviceId, record };
}

export async function unlockOffline(input) {
  const { store, user, password, branchId } = input;
  const pinnedPublicJwk = input.pinnedPublicJwk ?? OFFLINE_GRANT_PUBLIC_JWK;
  if (!(store instanceof OfflineGrantStore)) throw new Error('تخزين التصاريح غير متاح');
  if (!user?.tenantId || !user?.id || typeof password !== 'string' || !password || typeof branchId !== 'string' || !branchId)
    throw new Error('هوية المحاسب أو الفرع أو كلمة المرور غير صالحة');
  const { deviceId } = await ensureOfflineDeviceIdentity(store);
  const record = await store.loadRecord({ tenantId: user.tenantId, cashierId: user.id, deviceId });
  return unlockOfflineGrant(record, {
    password, tenantId: user.tenantId, cashierId: user.id, deviceId, branchId,
    ...(input.at ? { at: input.at } : {}), pinnedPublicJwk
  });
}

// The caller must remount its user-scoped store after success (not redirect old
// pending effects into another account). No first-time offline enrollment.
export async function openOfflineSession(input) {
  const handle=await unlockOffline(input);
  const user=offlineIdentityFromUnlockedGrant(handle,input.branchId);
  setOfflineSession(handle,input.branchId);
  return {user,handle};
}
