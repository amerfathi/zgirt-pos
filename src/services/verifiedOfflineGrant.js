import { assertOfflineShiftGrant } from './offlineShiftGrantPolicy.js';

const verified = new WeakMap();
const decode = value => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,512}$/.test(value)) throw new Error('توقيع التصريح غير صالح');
  const raw = atob(value.replace(/-/g,'+').replace(/_/g,'/') + '='.repeat((4-value.length%4)%4));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
};

// The public JWK must be pinned in trusted application code; never accept it
// from an offline user, an envelope, or an untrusted API response.
export async function verifySignedOfflineGrant(envelope, pinnedPublicJwk) {
  if (!envelope?.claims || !envelope?.signature || pinnedPublicJwk?.kty !== 'EC' ||
      pinnedPublicJwk?.crv !== 'P-256') throw new Error('تصريح العمل دون اتصال غير موقّع أو مفتاحه غير موثوق');
  let valid = false;
  try {
    const key = await crypto.subtle.importKey('jwk',pinnedPublicJwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
    valid = await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,decode(envelope.signature),
      new TextEncoder().encode(JSON.stringify(envelope.claims)));
  } catch { /* Malformed grant remains denied. */ }
  if (!valid) throw new Error('توقيع تصريح العمل دون اتصال غير موثوق');
  const handle = Object.freeze({});
  verified.set(handle,structuredClone(envelope.claims));
  return handle;
}

export function assertVerifiedOfflineGrant(handle, context, at) {
  const claims = handle && verified.get(handle);
  if (!claims) throw new Error('تصريح العمل دون اتصال غير موقّع أو موثوق');
  return assertOfflineShiftGrant(claims,context,at);
}

// A signature proves original authorship, not acceptance. Server callers must
// additionally enforce device/drawer assignment, replay sequence and idempotency.
// Expiry is checked at creation time so reconnection after expiry can retain
// valid already-created sources; caller must authenticate the uploading device.
export async function verifyOfflineCashEvent(proof,pinnedPublicJwk,context) {
  const handle=await verifySignedOfflineGrant(proof?.grant,pinnedPublicJwk);
  const source=proof?.source,claims=verified.get(handle);
  if (!source||typeof source.id!=='string'||!source.id||!Number.isSafeInteger(source.timestamp)||
      !context||source.tenantId!==context.tenantId||claims.deviceId!==context.deviceId)
    throw new Error('مصدر الحركة أو جهاز رفعها غير صالح');
  assertVerifiedOfflineGrant(handle,{tenantId:source.tenantId,cashierId:claims.cashierId,
    deviceId:context.deviceId,branchId:source.branchId},new Date(source.timestamp).toISOString());
  try {
    const publicJwk=claims.eventPublicJwk;
    if (publicJwk?.kty!=='EC'||publicJwk.crv!=='P-256'||publicJwk.d) throw Error('Invalid public key');
    const key=await crypto.subtle.importKey('jwk',publicJwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
    if (!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,decode(proof.signature),
      new TextEncoder().encode(JSON.stringify(source)))) throw Error('Invalid signature');
  } catch { throw new Error('توقيع مصدر الحركة غير موثوق؛ لم تُقبل الحركة'); }
  return {source:structuredClone(source),cashierId:claims.cashierId,deviceId:claims.deviceId};
}
