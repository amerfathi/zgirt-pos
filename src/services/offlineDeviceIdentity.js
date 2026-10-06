// A stable per-device identity plus a 64-hex possession proof. The identity is
// created once and stored durably; it is not an authorization credential, but
// the server stores only a salted hash of the proof, so a caller must hold the
// same device to register it or obtain an offline grant.
import { OfflineGrantStore } from './offlineGrantStore.js';

const proofPattern = /^[a-f0-9]{64}$/;
const deviceProof = () => crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
const validate = identity => {
  if(typeof identity?.deviceId!=='string' || !identity.deviceId || !proofPattern.test(identity.deviceProof||''))
    throw new Error('هوية الجهاز المحفوظة غير صالحة؛ يلزم استرداد متحقق دون استبدالها');
  return identity;
};

export async function ensureOfflineDeviceIdentity(store) {
  if (!(store instanceof OfflineGrantStore)) throw new Error('تخزين هوية الجهاز غير متاح');
  const existing = await store.loadDeviceIdentity();
  if (existing!==undefined && existing!==null) return validate(existing);
  const identity = { deviceId: crypto.randomUUID(), deviceProof: deviceProof(), createdAt: new Date().toISOString() };
  return validate(await store.createDeviceIdentityIfAbsent(identity));
}
