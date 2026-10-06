// Local unlock for the 24-hour offline cashier grant.
//
// The offline grant is a signed, server-issued envelope. This module binds that
// envelope to the previously verified cashier's login credential without ever
// retaining the plaintext password or a reusable bearer token. When a cashier
// first authenticates online, `enrollOfflineGrant` verifies the grant and
// stores it next to a salted PBKDF2 verifier of the password. Later, while
// disconnected, `unlockOfflineGrant` re-checks the password and the signature
// and re-asserts the 24-hour scope/expiry policy before releasing a verified
// handle. First-time offline login (no stored record), a wrong password, a
// tampered envelope, a wrong device/branch/cashier/tenant, and an expired grant
// all fail closed. Server revocation cannot reach a disconnected device, so the
// accepted local revocation window is the same 24-hour expiry (see the design).
import { verifySignedOfflineGrant, assertVerifiedOfflineGrant } from './verifiedOfflineGrant.js';
import { OFFLINE_GRANT_PUBLIC_JWK } from '../config/offlineGrantPublicKey.js';

const encoder = new TextEncoder();
const signingKeys = new WeakMap();
const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = value => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('بيانات قفل العمل دون اتصال تالفة');
  const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
};

async function deriveVerifier(password, saltBytes) {
  if (typeof password !== 'string' || !password) throw new Error('يلزم إدخال كلمة المرور');
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
  return new Uint8Array(bits);
}

async function vaultKey(password,salt) {
  return crypto.subtle.importKey('raw',await deriveVerifier(password,unb64u(salt)),{name:'AES-GCM'},false,['encrypt','decrypt']);
}
async function importBoundSigningKey(privateJwk,publicJwk) {
  try {
    if (privateJwk?.kty!=='EC'||privateJwk.crv!=='P-256'||!privateJwk.d||
        publicJwk?.kty!=='EC'||publicJwk.crv!=='P-256'||publicJwk.d||
        privateJwk.x!==publicJwk.x||privateJwk.y!==publicJwk.y) throw Error('mismatch');
    const key=await crypto.subtle.importKey('jwk',privateJwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
    const publicKey=await crypto.subtle.importKey('jwk',publicJwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
    const challenge=crypto.getRandomValues(new Uint8Array(32));
    const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,challenge);
    if (!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,signature,challenge)) throw Error('mismatch');
    return key;
  } catch { throw new Error('مفتاح توقيع الحركات لا يطابق التصريح'); }
}

export async function derivePasswordVerifier(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: b64u(salt), hash: b64u(await deriveVerifier(password, salt)) };
}

export async function verifyPasswordVerifier(password, salt, expectedHash) {
  const hash = await deriveVerifier(password, unb64u(salt));
  const expected = unb64u(expectedHash);
  if (hash.length !== expected.length) return false;
  let diff = 0;
  for (let index = 0; index < hash.length; index += 1) diff |= hash[index] ^ expected[index];
  return diff === 0;
}

export async function enrollOfflineGrant(input) {
  const { envelope, password, tenantId, cashierId, deviceId, branchId, at = new Date().toISOString() } = input;
  const pinnedPublicJwk = input.pinnedPublicJwk ?? OFFLINE_GRANT_PUBLIC_JWK;
  const handle = await verifySignedOfflineGrant(envelope, pinnedPublicJwk);
  assertVerifiedOfflineGrant(handle, { tenantId, cashierId, deviceId, branchId }, at);
  const verifier = await derivePasswordVerifier(password);
  const record = { envelope: structuredClone(envelope), salt: verifier.salt, hash: verifier.hash };
  if (envelope.claims.eventPublicJwk) {
    await importBoundSigningKey(input.eventPrivateJwk,envelope.claims.eventPublicJwk);
    const salt=b64u(crypto.getRandomValues(new Uint8Array(16))),iv=crypto.getRandomValues(new Uint8Array(12));
    const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(JSON.stringify(envelope))},
      await vaultKey(password,salt),encoder.encode(JSON.stringify(input.eventPrivateJwk)));
    Object.assign(record,{signingKeyVault:{version:1,salt,iv:b64u(iv),ciphertext:b64u(new Uint8Array(ciphertext))}});
  }
  return record;
}

export async function unlockOfflineGrant(record, input) {
  const { password, tenantId, cashierId, deviceId, branchId, at = new Date().toISOString() } = input;
  const pinnedPublicJwk = input.pinnedPublicJwk ?? OFFLINE_GRANT_PUBLIC_JWK;
  if (!record?.envelope || !record?.salt || !record?.hash)
    throw new Error('لا يوجد تحقق سابق عبر الإنترنت لهذا المحاسب على هذا الجهاز');
  if (!(await verifyPasswordVerifier(password, record.salt, record.hash)))
    throw new Error('كلمة المرور غير صحيحة للعمل دون اتصال');
  const handle = await verifySignedOfflineGrant(record.envelope, pinnedPublicJwk);
  assertVerifiedOfflineGrant(handle, { tenantId, cashierId, deviceId, branchId }, at);
  if (record.envelope.claims.eventPublicJwk) {
    try {
      const vault=record.signingKeyVault;
      if (vault?.version!==1||unb64u(vault.iv).length!==12) throw Error('Invalid vault');
      const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64u(vault.iv),additionalData:encoder.encode(JSON.stringify(record.envelope))},
        await vaultKey(password,vault.salt),unb64u(vault.ciphertext));
      const key=await importBoundSigningKey(JSON.parse(new TextDecoder().decode(bytes)),record.envelope.claims.eventPublicJwk);
      signingKeys.set(handle,{key,envelope:structuredClone(record.envelope)});
    } catch { throw new Error('تعذر فتح مفتاح توقيع الحركات؛ لم تُعتمد أي حركة'); }
  }
  return handle;
}

// Only handles released by password-verified unlock own a signing key.
export async function signOfflineCashEvent(handle,event) {
  const unlocked=signingKeys.get(handle);
  if (!unlocked) throw new Error('مفتاح توقيع الحركات غير مفتوح');
  if (!event||typeof event.id!=='string'||!event.id||!Number.isSafeInteger(event.timestamp))
    throw new Error('الحركة غير صالحة للتوقيع');
  const claims=unlocked.envelope.claims;
  assertVerifiedOfflineGrant(handle,{tenantId:event.tenantId,cashierId:claims.cashierId,
    deviceId:claims.deviceId,branchId:event.branchId},new Date(event.timestamp).toISOString());
  const source=JSON.parse(JSON.stringify(event));
  const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},unlocked.key,encoder.encode(JSON.stringify(source)));
  return {source,grant:structuredClone(unlocked.envelope),signature:b64u(new Uint8Array(signature))};
}

// Local identity is derived only from a password-opened signing vault and the
// server-signed permission snapshot. Never promote cached editable user data.
export function offlineIdentityFromUnlockedGrant(handle,branchId,at=new Date().toISOString()) {
  const unlocked=signingKeys.get(handle);
  if(!unlocked)throw Error('مفتاح تصريح الدخول المحلي غير مفتوح');
  const claims=unlocked.envelope.claims,identity=claims.offlineIdentity;
  assertVerifiedOfflineGrant(handle,{tenantId:claims.tenantId,cashierId:claims.cashierId,
    deviceId:claims.deviceId,branchId},at);
  if(!['tenant','user'].includes(claims.principalType)||!Number.isSafeInteger(claims.credentialVersion)||
      typeof identity?.role!=='string'||!identity.role||!identity.permissions||Array.isArray(identity.permissions)||
      !Number.isSafeInteger(identity.syncScopeVersion)||identity.syncScopeVersion<0||
      (claims.principalType==='user'&&identity.syncScopeVersion!==claims.credentialVersion)||
      (claims.principalType==='tenant'&&identity.syncScopeVersion!==0)||
      Object.values(identity.permissions).some(value=>typeof value!=='boolean'))
    throw Error('تصريح الدخول المحلي لا يتضمن هوية وصلاحيات موقّعة؛ تحقق عبر الإنترنت');
  return {id:claims.cashierId,tenantId:claims.tenantId,role:identity.role,
    isStaff:claims.principalType==='user',status:'active',branchId,branchIds:[...claims.branchIds],
    permissions:structuredClone(identity.permissions),syncScopeVersion:identity.syncScopeVersion,
    sessionExpiresAt:new Date(Date.parse(claims.onlineVerifiedAt)+24*60*60*1000).toISOString(),
    isOfflineSession:true};
}
