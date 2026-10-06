import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as signer from '../functions/_lib/offlineGrantSignature.js';
import { enrollOfflineGrant, unlockOfflineGrant, verifyPasswordVerifier } from '../src/services/offlineUnlock.js';
import { assertVerifiedOfflineGrant } from '../src/services/verifiedOfflineGrant.js';
import * as grantVerification from '../src/services/verifiedOfflineGrant.js';
import * as unlockService from '../src/services/offlineUnlock.js';
import * as sessions from '../src/services/authSession.js';
import {signOfflineCashEvent} from '../src/services/offlineUnlock.js';

const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const privateJwk = await crypto.subtle.exportKey('jwk', keys.privateKey);
const publicJwk = await crypto.subtle.exportKey('jwk', keys.publicKey);

const claims = () => ({ tenantId: 'tenant-a', cashierId: 'cashier-a', deviceId: 'device-1',
  branchIds: ['branch-1'], onlineVerifiedAt: '2026-10-01T08:00:00Z' });
const context = () => ({ tenantId: 'tenant-a', cashierId: 'cashier-a', deviceId: 'device-1', branchId: 'branch-1' });
const grant = async (overrides = {}) => signer.issueSignedOfflineGrant(privateJwk, { ...claims(), ...overrides });

test('a previously enrolled cashier unlocks offline with their password', async () => {
  const record = await enrollOfflineGrant({ envelope: await grant(), password: 'secret-pass', ...context(), at: '2026-10-01T09:00:00Z', pinnedPublicJwk: publicJwk });
  assert.equal(typeof record.salt, 'string');
  assert.equal(record.envelope.claims.cashierId, 'cashier-a');
  const handle = await unlockOfflineGrant(record, { password: 'secret-pass', ...context(), at: '2026-10-01T10:00:00Z', pinnedPublicJwk: publicJwk });
  assert.equal(assertVerifiedOfflineGrant(handle, context(), '2026-10-01T10:00:00Z'), true);
});

test('first-time offline login has no stored record and fails closed', async () => {
  await assert.rejects(unlockOfflineGrant(null, { password: 'secret-pass', ...context(), pinnedPublicJwk: publicJwk }), /تحقق سابق/);
});

test('a wrong password cannot unlock a valid grant', async () => {
  const record = await enrollOfflineGrant({ envelope: await grant(), password: 'right-pass', ...context(), at: '2026-10-01T09:00:00Z', pinnedPublicJwk: publicJwk });
  await assert.rejects(unlockOfflineGrant(record, { password: 'wrong-pass', ...context(), at: '2026-10-01T10:00:00Z', pinnedPublicJwk: publicJwk }), /كلمة المرور/);
  assert.equal(await verifyPasswordVerifier('wrong-pass', record.salt, record.hash), false);
  assert.equal(await verifyPasswordVerifier('right-pass', record.salt, record.hash), true);
});

test('an expired grant cannot be unlocked even with the correct password', async () => {
  const record = await enrollOfflineGrant({ envelope: await grant(), password: 'secret-pass', ...context(), at: '2026-10-01T09:00:00Z', pinnedPublicJwk: publicJwk });
  await assert.rejects(unlockOfflineGrant(record, { password: 'secret-pass', ...context(), at: '2026-10-02T09:00:00Z', pinnedPublicJwk: publicJwk }), /انتهت صلاحية/);
});

test('the grant cannot be unlocked for another device, branch, cashier, or tenant', async () => {
  const record = await enrollOfflineGrant({ envelope: await grant(), password: 'secret-pass', ...context(), at: '2026-10-01T09:00:00Z', pinnedPublicJwk: publicJwk });
  for (const [field, value] of [['deviceId', 'device-2'], ['branchId', 'branch-2'], ['cashierId', 'cashier-b'], ['tenantId', 'tenant-b']])
    await assert.rejects(unlockOfflineGrant(record, { password: 'secret-pass', ...context(), [field]: value, at: '2026-10-01T10:00:00Z', pinnedPublicJwk: publicJwk }), /تصريح/);
});

test('a tampered stored envelope cannot be unlocked', async () => {
  const record = await enrollOfflineGrant({ envelope: await grant(), password: 'secret-pass', ...context(), at: '2026-10-01T09:00:00Z', pinnedPublicJwk: publicJwk });
  record.envelope.claims.cashierId = 'attacker';
  await assert.rejects(unlockOfflineGrant(record, { password: 'secret-pass', ...context(), at: '2026-10-01T10:00:00Z', pinnedPublicJwk: publicJwk }), /توقيع/);
});

test('an already-expired grant cannot be enrolled', async () => {
  await assert.rejects(enrollOfflineGrant({ envelope: await grant(), password: 'secret-pass', ...context(), at: '2026-10-02T09:00:00Z', pinnedPublicJwk: publicJwk }), /انتهت صلاحية/);
});

test('enrollment rejects a grant whose claims do not match the device scope', async () => {
  await assert.rejects(enrollOfflineGrant({ envelope: await grant({ deviceId: 'other-device' }), password: 'secret-pass', ...context(), at: '2026-10-01T09:00:00Z', pinnedPublicJwk: publicJwk }), /تصريح/);
});

test('event signing key is encrypted and bound to the server signed grant', async () => {
  const eventKeys = await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const eventPrivateJwk = await crypto.subtle.exportKey('jwk',eventKeys.privateKey);
  const eventPublicJwk = await crypto.subtle.exportKey('jwk',eventKeys.publicKey);
  const envelope = await grant({eventPublicJwk});
  const input = {envelope,password:'vault-pass',...context(),at:'2026-10-01T09:00:00Z',pinnedPublicJwk:publicJwk,eventPrivateJwk};
  const record = await enrollOfflineGrant(input);
  assert.equal(record.signingKeyVault?.version,1);
  assert.equal(JSON.stringify(record).includes(eventPrivateJwk.d),false);
  await assert.rejects(enrollOfflineGrant({...input,eventPrivateJwk:privateJwk}),/مفتاح/);
  const corrupted=structuredClone(record);
  corrupted.signingKeyVault.ciphertext=corrupted.signingKeyVault.ciphertext.replace(/^./,char=>char==='A'?'B':'A');
  await assert.rejects(unlockOfflineGrant(corrupted,{password:'vault-pass',...context(),at:'2026-10-01T10:00:00Z',pinnedPublicJwk:publicJwk}),/مفتاح/);
});

test('original cashier event proof survives handover but cannot be altered or forged',async()=>{
  assert.equal(typeof grantVerification.verifyOfflineCashEvent,'function');
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const envelope=await grant({eventPublicJwk:await crypto.subtle.exportKey('jwk',pair.publicKey)});
  const input={password:'proof-pass',...context(),at:'2026-10-01T09:00:00Z',pinnedPublicJwk:publicJwk};
  const record=await enrollOfflineGrant({...input,envelope,eventPrivateJwk:await crypto.subtle.exportKey('jwk',pair.privateKey)});
  const handle=await unlockOfflineGrant(record,input);
  const event={id:'invoice-a',tenantId:'tenant-a',branchId:'branch-1',entityType:'invoice',entityId:'invoice-a',
    action:'create',timestamp:Date.parse('2026-10-01T09:01:00Z'),payload:{amount:27},preconditions:{'stock:branch-1':null}};
  const proof=await signOfflineCashEvent(handle,event);
  const verified=await grantVerification.verifyOfflineCashEvent(JSON.parse(JSON.stringify(proof)),publicJwk,
    {tenantId:'tenant-a',deviceId:'device-1'});
  assert.equal(verified.cashierId,'cashier-a');
  assert.deepEqual(verified.source,event);
  for (const change of [source=>source.payload.amount=99,source=>source.id='other',
    source=>source.preconditions['stock:branch-1']='other',source=>source.timestamp+=24*60*60*1000]) {
    const altered=structuredClone(proof);change(altered.source);
    await assert.rejects(grantVerification.verifyOfflineCashEvent(altered,publicJwk,{tenantId:'tenant-a',deviceId:'device-1'}));
  }
  await assert.rejects(grantVerification.verifyOfflineCashEvent(proof,publicJwk,{tenantId:'tenant-a',deviceId:'other'}));
  await assert.rejects(signOfflineCashEvent({},event),/مفتاح/);
  await assert.rejects(signOfflineCashEvent(handle,{...event,timestamp:event.timestamp+24*60*60*1000}),/صلاحية/);
  const swapped=structuredClone(proof);swapped.grant.claims.cashierId='cashier-b';
  await assert.rejects(grantVerification.verifyOfflineCashEvent(swapped,publicJwk,{tenantId:'tenant-a',deviceId:'device-1'}));
});

test('password-unlocked signed identity works after server expiry without a bearer or editable role',async()=>{
  assert.equal(typeof unlockService.offlineIdentityFromUnlockedGrant,'function');
  assert.equal(typeof sessions.setOfflineSession,'function');
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const now=Date.now(),onlineVerifiedAt=new Date(now-9*60*60*1000).toISOString();
  const envelope=await grant({onlineVerifiedAt,principalType:'user',credentialVersion:3,
    offlineIdentity:{role:'custom',permissions:{canSell:true,canAccessSettings:false},syncScopeVersion:3},
    eventPublicJwk:await crypto.subtle.exportKey('jwk',pair.publicKey)});
  const input={password:'local-fixture-password',...context(),at:new Date(now).toISOString(),pinnedPublicJwk:publicJwk};
  const record=await enrollOfflineGrant({...input,envelope,eventPrivateJwk:await crypto.subtle.exportKey('jwk',pair.privateKey)});
  const handle=await unlockOfflineGrant(record,input);
  const original=globalThis.sessionStorage,items=new Map();
  Object.assign(globalThis,{sessionStorage:{getItem:key=>items.get(key)??null,setItem:(key,value)=>items.set(key,String(value)),removeItem:key=>items.delete(key)}});
  try {
    sessions.setSessionToken('expired-server-fixture');
    sessions.setSessionUser({id:'cashier-a',tenantId:'tenant-a',sessionExpiresAt:new Date(now-1).toISOString(),role:'super_admin'});
    assert.equal(sessions.getSessionUser(),null);
    sessions.setOfflineSession(handle,'branch-1');
    assert.equal(sessions.getSessionToken(),'');
    const user=sessions.getSessionUser();
    assert.equal(user.role,'custom');assert.equal(user.isOfflineSession,true);
    assert.equal(user.syncScopeVersion,3);assert.equal(user.permissions.canAccessSettings,false);
    user.role='super_admin';user.branchIds.push('foreign');
    assert.equal(sessions.getSessionUser().role,'custom');
    assert.deepEqual(sessions.getSessionUser().branchIds,['branch-1']);
    assert.throws(()=>sessions.setOfflineSession({},'branch-1'),/مفتاح|تصريح/);
    assert.throws(()=>unlockService.offlineIdentityFromUnlockedGrant(handle,'branch-1',new Date(Date.parse(onlineVerifiedAt)+24*60*60*1000).toISOString()),/صلاحية/);
    await assert.rejects(unlockOfflineGrant(record,{...input,password:'wrong'}),/كلمة المرور/);
    sessions.setSessionToken(null);assert.equal(sessions.getSessionUser(),null);
  } finally {sessions.setSessionToken(null);Object.assign(globalThis,{sessionStorage:original});}
});
