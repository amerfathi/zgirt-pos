import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as signer from '../functions/_lib/offlineGrantSignature.js';
import { OfflineGrantStore, memoryBackend, offlineGrantRecordKey } from '../src/services/offlineGrantStore.js';
import { ensureOfflineDeviceIdentity } from '../src/services/offlineDeviceIdentity.js';
import { enrollOnline, unlockOffline, openOfflineSession } from '../src/services/offlineGrantEnrollment.js';
import { assertVerifiedOfflineGrant } from '../src/services/verifiedOfflineGrant.js';
import {setSessionToken,setSessionUser,getSessionUser,getSessionToken} from '../src/services/authSession.js';

const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const privateJwk = await crypto.subtle.exportKey('jwk', keys.privateKey);
const publicJwk = await crypto.subtle.exportKey('jwk', keys.publicKey);

const user = { id: 'cashier-a', tenantId: 'tenant-a', branchId: 'branch-1', branchIds: ['branch-1', 'branch-2'] };
const ok = body => ({ ok: true, status: 200, json: async () => body });

const fakeFetch = async (url, init) => {
  const body = JSON.parse(init.body);
  if (url.endsWith('/api/cash/devices')) return ok({ success: true, deviceId: body.deviceId });
  if (url.endsWith('/api/cash/grants')) {
    const grant = await signer.issueSignedOfflineGrant(privateJwk, {
      tenantId: body.tenantId, cashierId: 'cashier-a', deviceId: body.deviceId,
      branchIds: ['branch-1', 'branch-2'], onlineVerifiedAt: new Date().toISOString(),eventPublicJwk:body.eventPublicJwk
    });
    return ok({ success: true, grant });
  }
  return { ok: false, status: 404, json: async () => ({ success: false, error: 'not found' }) };
};

test('device identity is generated once and reused', async () => {
  const store = new OfflineGrantStore(memoryBackend());
  const first = await ensureOfflineDeviceIdentity(store);
  const second = await ensureOfflineDeviceIdentity(store);
  assert.equal(second.deviceId, first.deviceId);
  assert.equal(second.deviceProof, first.deviceProof);
  assert.match(first.deviceProof, /^[a-f0-9]{64}$/);
});

test('simultaneous first enrollment shares one durable device identity across store instances',async()=>{
  const backend=memoryBackend();
  const identities=await Promise.all(Array.from({length:8},()=>ensureOfflineDeviceIdentity(new OfflineGrantStore(backend))));
  assert.equal(new Set(identities.map(identity=>identity.deviceId)).size,1);
  assert.equal(new Set(identities.map(identity=>identity.deviceProof)).size,1);
  assert.deepEqual(await new OfflineGrantStore(backend).loadDeviceIdentity(),identities[0]);
});

test('corrupt existing device identity is retained for recovery, never silently replaced',async()=>{
  const store=new OfflineGrantStore(memoryBackend()),corrupt={deviceId:'old-device',deviceProof:'corrupt'};
  await store.saveDeviceIdentity(corrupt);
  await assert.rejects(ensureOfflineDeviceIdentity(store),/هوية.*استرداد/);
  assert.deepEqual(await store.loadDeviceIdentity(),corrupt);
});

test('offline grant records are device-scoped and durable', async () => {
  const backend = memoryBackend();
  const store = new OfflineGrantStore(backend);
  await store.saveRecord({ tenantId: 'tenant-a', cashierId: 'cashier-a', deviceId: 'device-1' }, { marker: 1 });
  const reopened = new OfflineGrantStore(backend);
  assert.deepEqual(await reopened.loadRecord({ tenantId: 'tenant-a', cashierId: 'cashier-a', deviceId: 'device-1' }), { marker: 1 });
  assert.equal(await reopened.loadRecord({ tenantId: 'tenant-a', cashierId: 'cashier-a', deviceId: 'device-2' }), null);
  await reopened.clearRecord({ tenantId: 'tenant-a', cashierId: 'cashier-a', deviceId: 'device-1' });
  assert.equal(await reopened.loadRecord({ tenantId: 'tenant-a', cashierId: 'cashier-a', deviceId: 'device-1' }), null);
  assert.equal(offlineGrantRecordKey({ tenantId: 't', cashierId: 'c', deviceId: 'd' }), 'braka:offline_grant:t:c:d');
});

test('online enrollment registers the device, obtains a grant, and persists it', async () => {
  const store = new OfflineGrantStore(memoryBackend());
  const { deviceId, record } = await enrollOnline({
    store, fetchFn: fakeFetch, apiBaseUrl: 'https://test.invalid', token: 'tok',
    user, password: 'secret-pass', pinnedPublicJwk: publicJwk
  });
  assert.equal(typeof deviceId, 'string');
  assert.equal(record.envelope.claims.cashierId, 'cashier-a');
  assert.equal(record.signingKeyVault?.version,1);
  assert.equal(record.envelope.claims.eventPublicJwk?.kty,'EC');
  const saved = await store.loadRecord({ tenantId: 'tenant-a', cashierId: 'cashier-a', deviceId });
  assert.deepEqual(saved.envelope.claims, record.envelope.claims);
});

test('an enrolled cashier unlocks offline on their own device and branch', async () => {
  const store = new OfflineGrantStore(memoryBackend());
  await enrollOnline({ store, fetchFn: fakeFetch, apiBaseUrl: 'https://test.invalid', token: 'tok', user, password: 'secret-pass', pinnedPublicJwk: publicJwk });
  const handle = await unlockOffline({ store, user, password: 'secret-pass', branchId: 'branch-2', pinnedPublicJwk: publicJwk });
  assert.equal(assertVerifiedOfflineGrant(handle, { tenantId: 'tenant-a', cashierId: 'cashier-a', deviceId: (await ensureOfflineDeviceIdentity(store)).deviceId, branchId: 'branch-2' }), true);
});

test('offline unlock fails closed for a wrong password or an unenrolled device', async () => {
  const store = new OfflineGrantStore(memoryBackend());
  await assert.rejects(unlockOffline({ store, user, password: 'secret-pass', branchId: 'branch-1', pinnedPublicJwk: publicJwk }), /تحقق سابق/);
  await enrollOnline({ store, fetchFn: fakeFetch, apiBaseUrl: 'https://test.invalid', token: 'tok', user, password: 'secret-pass', pinnedPublicJwk: publicJwk });
  await assert.rejects(unlockOffline({ store, user, password: 'wrong-pass', branchId: 'branch-1', pinnedPublicJwk: publicJwk }), /كلمة المرور/);
  await assert.rejects(unlockOffline({ store, user, password: 'secret-pass', branchId: 'foreign-branch', pinnedPublicJwk: publicJwk }), /تصريح/);
});

test('enrollment propagates server errors instead of persisting a half-finished grant', async () => {
  const store = new OfflineGrantStore(memoryBackend());
  const failing = async (url, init) => ({ ok: false, status: 403, json: async () => ({ success: false, error: 'Device proof mismatch' }) });
  await assert.rejects(enrollOnline({ store, fetchFn: failing, apiBaseUrl: 'https://test.invalid', token: 'tok', user, password: 'secret-pass', pinnedPublicJwk: publicJwk }), /Device proof mismatch/);
  const device = await ensureOfflineDeviceIdentity(store);
  assert.equal(await store.loadRecord({ tenantId: 'tenant-a', cashierId: 'cashier-a', deviceId: device.deviceId }), null);
});

test('public offline session wiring uses the password-unlocked signed identity after eight-hour server expiry',async()=>{
  const store=new OfflineGrantStore(memoryBackend()),now=Date.now();
  const fetchFn=async(url,init)=>{
    const response=await fakeFetch(url,init);
    if(!url.endsWith('/api/cash/grants'))return response;
    const {grant}=await response.json();
    return ok({success:true,grant:await signer.issueSignedOfflineGrant(privateJwk,{...grant.claims,
      onlineVerifiedAt:new Date(now-9*60*60*1000).toISOString(),principalType:'user',credentialVersion:2,
      offlineIdentity:{role:'cashier',permissions:{canSell:true,canAccessSettings:false},syncScopeVersion:2}})});
  };
  await enrollOnline({store,fetchFn,apiBaseUrl:'https://test.invalid',token:'fixture-session',user,
    password:'fixture-local-only',pinnedPublicJwk:publicJwk});
  const previous=globalThis.sessionStorage,items=new Map();
  globalThis.sessionStorage={getItem:key=>items.get(key)??null,
    setItem(key,value){items.set(key,String(value));},removeItem(key){items.delete(key);},
    clear(){items.clear();},key:index=>[...items.keys()][index]??null,get length(){return items.size;}};
  try {
    setSessionToken('expired-fixture');
    setSessionUser({...user,role:'super_admin',sessionExpiresAt:new Date(now-1).toISOString()});
    assert.equal(getSessionUser(),null);
    const input={store,user:{...user,role:'super_admin'},password:'fixture-local-only',branchId:'branch-2',pinnedPublicJwk:publicJwk};
    await assert.rejects(openOfflineSession({...input,password:'wrong'}),/كلمة المرور/);
    assert.equal(getSessionUser(),null);
    const result=await openOfflineSession(input);
    assert.equal(result.user.role,'cashier');assert.equal(getSessionToken(),'');
    assert.equal(getSessionUser().permissions.canAccessSettings,false);
    assert.equal(getSessionUser().branchId,'branch-2');
    assert.equal(getSessionUser().syncScopeVersion,2);
    await assert.rejects(openOfflineSession({...input,branchId:'foreign'}),/تصريح/);
    setSessionToken(null);assert.equal(getSessionUser(),null);
  } finally {setSessionToken(null);globalThis.sessionStorage=previous;}
});
