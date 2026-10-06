import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { seedAggregate } from './aggregate-fixture.mjs';
import { accountingDate } from '../src/services/cashShiftEngine.js';
import { issueSignedOfflineGrant } from '../functions/_lib/offlineGrantSignature.js';

const locks = globalThis.navigator.locks;
const storage = () => ({ values: new Map(),
  getItem(key) { return this.values.get(key) ?? null; },
  setItem(key, value) { this.values.set(key, String(value)); },
  removeItem(key) { this.values.delete(key); }, clear() { this.values.clear(); },
  key(index) { return [...this.values.keys()][index] ?? null; },
  get length() { return this.values.size; } });

const openShift = () => ({ id: 'shift-1', tenantId: 'A', branchId: 'branch-main', drawerId: 'drawer-1',
  actorId: 'u', offlineDeviceId: 'device-1', timeZone: 'Asia/Riyadh', accountingDate: accountingDate(new Date().toISOString(), 'Asia/Riyadh'),
  openedAt: new Date().toISOString(), openingCash: 100, events: [], status: 'open' });

for (const scenario of ['own', 'other-first', 'ambiguous']) test(`cash expense shift attribution: ${scenario}`, async () => {
  const target = storage();
  const own = openShift();
  const shifts = scenario === 'own' ? [own] : scenario === 'other-first'
    ? [{ ...own, id: 'other-shift', actorId: 'other', drawerId: 'other-drawer' }, own]
    : [own, { ...own, id: 'second-own', drawerId: 'other-drawer' }];
  seedAggregate(target, { id: 'u', tenantId: 'A' }, { cash_shifts_v1: shifts });
  globalThis.localStorage = target;
  globalThis.sessionStorage = storage();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false, locks } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {}, removeEventListener() {}, location: { origin: 'https://test.invalid' } } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { addEventListener() {}, removeEventListener() {}, visibilityState: 'hidden' } });
  const bundle = await build({ stdin: { contents: "export {useAppStore} from './src/store/useAppStore.js';export {setSessionToken,setSessionUser} from './src/services/authSession.js';", resolveDir: process.cwd() },
    bundle: true, write: false, define: { 'import.meta.env': '{}' }, format: 'cjs', platform: 'node', external: ['react', 'react-test-renderer'] });
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const { useAppStore, setSessionToken, setSessionUser } = loaded.exports;
  let app, root;
  function Harness() { app = useAppStore(); return null; }
  try {
    setSessionToken('test');
    setSessionUser({ id: 'u', tenantId: 'A', role: 'company_owner', branchId: 'branch-main', branchIds: ['branch-main'], sessionExpiresAt: new Date(Date.now() + 60000).toISOString() });
    await act(async () => { root = TestRenderer.create(React.createElement(Harness)); await Promise.resolve(); });
    if (scenario === 'ambiguous') {
      await act(async () => {
        assert.throws(() => app.addExpense({ id: 'e1', title: 'Rent', amount: 12, paymentMethod: 'cash' }), /درج/);
      });
      assert.equal(app.expenses.some(item => item.id === 'e1'), false);
      assert.ok(app.cashShifts.every(shift => shift.events.length === 0));
      return;
    }
    await act(async () => { app.addExpense({ id: 'e1', title: 'Rent', amount: 12, paymentMethod: 'cash' }); });
    const expense = app.expenses.find(item => item.id === 'e1');
    assert.equal(expense.cashShiftId, 'shift-1');
    const updated = app.cashShifts.find(shift => shift.id === own.id);
    assert.equal(updated.events.length, 1);
    assert.equal(updated.events[0].amount, -12);
    if (scenario === 'other-first') assert.equal(app.cashShifts.find(shift => shift.id === 'other-shift').events.length, 0);
  } finally {
    await act(async () => { root?.unmount(); });
    delete globalThis.window;
    delete globalThis.document;
  }
});

test('actual login enrolls its authenticated cashier without storing credentials in the grant',async()=>{
  globalThis.localStorage=storage();globalThis.sessionStorage=storage();
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false,locks}});
  let reloads=0;
  Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener(){},removeEventListener(){},location:{origin:'https://test.invalid',reload(){reloads++;}}}});
  Object.defineProperty(globalThis,'document',{configurable:true,value:{addEventListener(){},removeEventListener(){},visibilityState:'hidden'}});
  const bundle=await build({stdin:{contents:"export {useAppStore} from './src/store/useAppStore.js';export {OfflineGrantStore,memoryBackend} from './src/services/offlineGrantStore.js';export {ensureOfflineDeviceIdentity} from './src/services/offlineDeviceIdentity.js';export {unlockOffline} from './src/services/offlineGrantEnrollment.js';",resolveDir:process.cwd()},bundle:true,write:false,define:{'import.meta.env':'{}'},format:'cjs',platform:'node',packages:'external'});
  const loaded={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
  const {useAppStore,OfflineGrantStore,memoryBackend,ensureOfflineDeviceIdentity,unlockOffline}=loaded.exports;
  const grantStore=new OfflineGrantStore(memoryBackend());
  const issuer=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const pin=await crypto.subtle.exportKey('jwk',issuer.publicKey);
  const user={id:'login-cashier',tenantId:'A',role:'cashier',branchId:'branch-main',branchIds:['branch-main']};
  const originalFetch=globalThis.fetch;let unavailable=false,registrations=0,app,root;
  globalThis.fetch=async(url,init)=>{
    if(String(url).endsWith('/api/tenants/lookup'))return Response.json({success:true,user,userType:'staff',tenant:{id:'A',storeCode:'LOCALTEST',timeZone:'Asia/Riyadh'},branches:[{id:'branch-main',tenantId:'A',name:'Main',isMain:true}],session:{token:'fixture-session',expiresAt:new Date(Date.now()+60000).toISOString()}});
    assert.equal(new Headers(init.headers).get('Authorization'),'Bearer fixture-session');
    if(String(url).endsWith('/api/cash/devices')){registrations++;return Response.json({success:true});}
    if(String(url).endsWith('/api/cash/grants')){
      if(unavailable)return Response.json({success:false,error:'Fixture grant unavailable'},{status:503});
      const body=JSON.parse(init.body);
      return Response.json({success:true,grant:await issueSignedOfflineGrant(await crypto.subtle.exportKey('jwk',issuer.privateKey),{tenantId:'A',cashierId:user.id,deviceId:body.deviceId,branchIds:user.branchIds,onlineVerifiedAt:new Date().toISOString(),eventPublicJwk:body.eventPublicJwk})});
    }
    throw Error('Unexpected fixture request');
  };
  function Harness(){app=useAppStore({cashGrantStore:grantStore,offlineGrantPublicJwk:pin});return null;}
  try{
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));});
    let result;await act(async()=>{result=await app.login('cashier','fixture-password','LOCALTEST');});
    assert.equal(result.success,true);assert.equal(result.offlineGrantStatus,'enrolled');
    assert.equal(registrations,1);assert.equal(reloads,1);
    const device=await ensureOfflineDeviceIdentity(grantStore);
    const saved=await grantStore.loadRecord({tenantId:'A',cashierId:user.id,deviceId:device.deviceId});
    assert.equal(saved.signingKeyVault.version,1);
    assert.equal(JSON.stringify(saved).includes('fixture-password'),false);
    assert.equal(JSON.stringify(saved).includes('fixture-session'),false);
    await unlockOffline({store:grantStore,user,password:'fixture-password',branchId:'branch-main',pinnedPublicJwk:pin});
    unavailable=true;
    await act(async()=>{result=await app.login('cashier','fixture-password','LOCALTEST');});
    assert.equal(result.success,true);assert.equal(result.offlineGrantStatus,'unavailable');
    assert.equal(reloads,2);
  }finally{globalThis.fetch=originalFetch;await act(async()=>{root?.unmount();});delete globalThis.window;delete globalThis.document;}
});

test('actual hook opens, sells, closes and hands over a signed local drawer atomically', async () => {
  globalThis.localStorage = storage();
  globalThis.sessionStorage = storage();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false, locks } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {}, removeEventListener() {}, location: { origin: 'https://test.invalid' } } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { addEventListener() {}, removeEventListener() {}, visibilityState: 'hidden' } });
  const bundle = await build({ stdin: { contents: "export {useAppStore} from './src/store/useAppStore.js';export {cloudflareSync} from './src/services/cloudflareSync.js';export {setSessionToken,setSessionUser,setOfflineSession,getSessionToken} from './src/services/authSession.js';export {enrollOfflineGrant,unlockOfflineGrant} from './src/services/offlineUnlock.js';export {verifyOfflineCashEvent} from './src/services/verifiedOfflineGrant.js';export {OfflineGrantStore,memoryBackend} from './src/services/offlineGrantStore.js';", resolveDir: process.cwd() }, bundle: true, write: false, define: { 'import.meta.env': '{}' }, format: 'cjs', platform: 'node', packages: 'external' });
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const { useAppStore, cloudflareSync, setSessionToken, setSessionUser, setOfflineSession, getSessionToken,
    enrollOfflineGrant, unlockOfflineGrant, verifyOfflineCashEvent, OfflineGrantStore, memoryBackend } = loaded.exports;
  const identity = { id: 'u', tenantId: 'A', role: 'cashier', branchId: 'branch-main', branchIds: ['branch-main'], sessionExpiresAt: new Date(Date.now() + 60000).toISOString() };
  const shift = openShift();
  const initial = seedAggregate(localStorage, identity, { cash_shifts_v1: [], expenses_v3: [], invoices_v3: [],
    products_v3: [{id:'p',tenantId:'A',branchId:'branch-main',name:'Carrot',currentStockKg:15,costPerKg:2,branchStock:{'branch-main':15}}] });
  const userKey = 'braka:A:u:atomic_v1';
  const journalKey = 'braka:A:branch-main:drawer-1:device-1:cash_drawer_journal_v1';
  const rows = new Map();
  rows.set(userKey, initial);
  let fail = false;
  const disk = {
    async read(key) { return structuredClone(rows.get(key) ?? null); },
    async commit(key, snapshot, expectedRevision) {
      if ((rows.get(key)?.revision ?? null) !== expectedRevision) throw Error('Revision conflict');
      rows.set(key, structuredClone(snapshot)); return structuredClone(snapshot);
    },
    async commitBatch(entries) {
      if (fail) throw Error('Injected paired failure');
      for (const entry of entries) assert.equal(rows.get(entry.key)?.revision ?? null, entry.expectedRevision);
      for (const entry of entries) rows.set(entry.key, structuredClone(entry.snapshot));
      return entries.map(entry => structuredClone(entry.snapshot));
    }
  };
  const issuer = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const eventKeys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicJwk = await crypto.subtle.exportKey('jwk', issuer.publicKey);
  const at = new Date().toISOString();
  const envelope = await issueSignedOfflineGrant(await crypto.subtle.exportKey('jwk', issuer.privateKey), {
    tenantId: 'A', cashierId: 'u', deviceId: 'device-1', branchIds: ['branch-main'], drawerIds:['drawer-1'], onlineVerifiedAt: at,
    eventPublicJwk: await crypto.subtle.exportKey('jwk', eventKeys.publicKey)
  });
  const context = { tenantId: 'A', cashierId: 'u', deviceId: 'device-1', branchId: 'branch-main', password: 'fixture-only', pinnedPublicJwk: publicJwk, at };
  const enrolled = await enrollOfflineGrant({ ...context, envelope, eventPrivateJwk: await crypto.subtle.exportKey('jwk', eventKeys.privateKey) });
  const grantStore=new OfflineGrantStore(memoryBackend());
  const deviceIdentity={deviceId:'device-1',deviceProof:'a'.repeat(64)};
  await grantStore.saveDeviceIdentity(deviceIdentity);
  const grantScope={tenantId:'A',cashierId:'u',deviceId:'device-1'};
  await grantStore.saveRecord(grantScope,enrolled);
  let app, root;
  function Harness() { app = useAppStore({ durableRepository: disk, cashGrantStore:grantStore, offlineGrantPublicJwk:publicJwk }); return null; }
  try {
    setSessionToken('test'); setSessionUser(identity);
    await act(async () => { root = TestRenderer.create(React.createElement(Harness)); await new Promise(resolve => setTimeout(resolve, 30)); });
    assert.equal(app.persistence.ready, true, app.persistence.error);
    assert.ok(cloudflareSync.drawerReplay,'opt-in drawer account must not fall back to unsigned sync');
    await act(async()=>{assert.deepEqual(await app.unlockCashDrawer('fixture-only',shift.id),{shiftId:shift.id,deviceId:'device-1'});});
    const opening = {id:shift.id,tenantId:'A',branchId:'branch-main',drawerId:'drawer-1',actorId:'u',offlineDeviceId:'device-1',openingCash:100,at:new Date().toISOString(),timeZone:'Asia/Riyadh'};
    const beforeOpen = structuredClone([...rows]);
    fail = true;
    await act(async () => { await assert.rejects(app.openShift(opening), /Injected paired failure/); });
    assert.deepEqual([...rows], beforeOpen);
    assert.equal(app.cashShifts.length, 0);
    fail = false;
    await act(async () => { await app.openShift(opening); });
    assert.equal(rows.get(journalKey).sources.length, 1);
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));});
    assert.deepEqual(cloudflareSync.drawerReplay.scope,{tenantId:'A',branchId:'branch-main',drawerId:'drawer-1',deviceId:'device-1'});
    assert.equal(cloudflareSync.drawerReplay.deviceProof,deviceIdentity.deviceProof);
    const before = structuredClone([...rows]);
    await grantStore.saveDeviceIdentity({deviceId:'other-device',deviceProof:'b'.repeat(64)});
    await act(async()=>{await assert.rejects(app.unlockCashDrawer('fixture-only',shift.id),/تحقق سابق/);});
    await grantStore.saveDeviceIdentity(deviceIdentity);
    await act(async()=>{await assert.rejects(app.unlockCashDrawer('wrong-password',shift.id),/كلمة المرور/);});
    assert.equal(cloudflareSync.drawerReplay.scope,null,'failed unlock must retain a blocked signed mode');
    assert.throws(()=>app.addExpense({id:'locked-expense',amount:12}),/افتح تصريح/);
    const expiredEnvelope=await issueSignedOfflineGrant(await crypto.subtle.exportKey('jwk',issuer.privateKey),{
      ...envelope.claims,onlineVerifiedAt:new Date(Date.now()-25*60*60*1000).toISOString()
    });
    await grantStore.saveRecord(grantScope,{...enrolled,envelope:expiredEnvelope});
    await act(async()=>{await assert.rejects(app.unlockCashDrawer('fixture-only',shift.id),/انتهى|صلاحية/);});
    await grantStore.saveRecord(grantScope,enrolled);
    await act(async()=>{await app.unlockCashDrawer('fixture-only',shift.id);});
    assert.deepEqual([...rows], before);
    fail = true;
    await act(async () => { await assert.rejects(app.addExpense({ id: 'failed-expense', title: 'Rent', amount: 12, paymentMethod: 'cash' }), /Injected paired failure/); });
    assert.deepEqual([...rows], before);
    assert.equal(app.expenses.length, 0);
    fail = false;
    await act(async () => { await app.addExpense({ id: 'signed-expense', title: 'Rent', amount: 12, paymentMethod: 'cash' }); });
    assert.equal(app.expenses.length, 1);
    const shared = rows.get(journalKey);
    assert.equal(shared.shifts[0].events.length, 1);
    assert.equal(shared.shifts[0].events[0].amount, -12);
    assert.deepEqual(shared.shifts[0], app.cashShifts[0]);
    assert.equal(shared.sources.filter(proof => proof.source.entityType === 'expense').length, 1);
    assert.equal(shared.sources.filter(proof => proof.source.entityType === 'cash_shift').length, 2);
    for (const proof of shared.sources) {
      const verified = await verifyOfflineCashEvent(proof, publicJwk, { tenantId: 'A', deviceId: 'device-1' });
      assert.equal(verified.cashierId, 'u');
    }
    const committed = structuredClone([...rows]);
    await act(async () => { await assert.rejects(app.deleteExpense('signed-expense'), /عكس الحركة/); });
    assert.deepEqual([...rows], committed);
    assert.equal(app.expenses.length, 1);
    await act(async () => { await app.addExpense({id:'bank-expense',amount:7,paymentMethod:'bank'}); });
    assert.equal(rows.get(journalKey).shifts[0].events.length, 1, 'bank payment must not move drawer cash');
    const sale = {id:'cash-sale',customerId:'walk_in',items:[{productId:'p',netWeight:3}],saleType:'cash',paymentMethod:'cash',paidAmount:27,finalTotal:27};
    const beforeSale = structuredClone([...rows]);
    fail = true;
    await act(async () => { await assert.rejects(app.saveInvoice(sale), /Injected paired failure/); });
    assert.deepEqual([...rows], beforeSale);
    assert.equal(app.products[0].currentStockKg, 15);
    assert.equal(app.invoices.length, 0);
    fail = false;
    await act(async () => { await app.saveInvoice(sale); });
    assert.equal(app.products[0].currentStockKg, 12);
    assert.equal(app.invoices.length, 1);
    const afterSale = rows.get(journalKey);
    assert.equal(afterSale.shifts[0].events.length, 2);
    assert.equal(afterSale.shifts[0].events[1].amount, 27);
    assert.equal(afterSale.sources.filter(proof => proof.source.entityType === 'invoice').length, 1);
    const invoiceProof = afterSale.sources.find(proof => proof.source.entityType === 'invoice');
    assert.equal((await verifyOfflineCashEvent(invoiceProof,publicJwk,{tenantId:'A',deviceId:'device-1'})).cashierId, 'u');
    await act(async()=>{await app.updateInvoiceNotes('cash-sale','Checked receipt');});
    assert.equal(app.invoices[0].notes,'Checked receipt');assert.equal(rows.get(journalKey).shifts[0].events.length,2);
    const beforeVoid=structuredClone([...rows]);
    fail=true;
    await act(async()=>{await assert.rejects(app.voidInvoice('cash-sale'),/Injected paired failure/);});
    assert.deepEqual([...rows],beforeVoid);assert.equal(app.invoices[0].status,'active');assert.equal(app.products[0].currentStockKg,12);
    fail=false;
    await act(async()=>{await app.voidInvoice('cash-sale');});
    assert.equal(app.invoices[0].status,'voided');assert.equal(app.invoices[0].paidAmount,27);assert.equal(app.products[0].currentStockKg,15);
    const afterVoid=rows.get(journalKey);
    assert.equal(afterVoid.shifts[0].events.at(-1).amount,-27);
    assert.equal(afterVoid.shifts[0].events.at(-1).id,'cash:void:cash-sale');
    const reversal=afterVoid.sources.find(proof=>proof.source.entityType==='invoice'&&proof.source.action==='void');
    assert.ok(reversal);assert.equal((await verifyOfflineCashEvent(reversal,publicJwk,{tenantId:'A',deviceId:'device-1'})).cashierId,'u');
    await act(async()=>{await app.voidInvoice('cash-sale');});
    assert.equal(rows.get(journalKey).sources.filter(proof=>proof.source.action==='void').length,1);
    assert.equal(rows.get(journalKey).shifts[0].events.length,3);
    const closing = {shiftId:shift.id,actorId:'u',deviceId:'device-1',countedCash:88,at:new Date().toISOString()};
    const beforeClose = structuredClone([...rows]);
    fail = true;
    await act(async () => { await assert.rejects(app.closeShift(closing), /Injected paired failure/); });
    assert.deepEqual([...rows], beforeClose);
    assert.equal(app.cashShifts[0].status, 'open');
    fail = false;
    await act(async () => { await app.closeShift(closing); });
    assert.equal(app.cashShifts[0].status, 'closed_local');
    assert.equal(app.cashShifts[0].expectedCash, 88);
    assert.equal(app.cashShifts[0].variance, 0);
    const closed = rows.get(journalKey);
    assert.deepEqual(closed.shifts[0], app.cashShifts[0]);
    assert.equal(closed.sources.length, afterVoid.sources.length + 1);
    assert.equal((await verifyOfflineCashEvent(closed.sources.at(-1),publicJwk,{tenantId:'A',deviceId:'device-1'})).cashierId, 'u');
    const firstRecord = structuredClone(rows.get(userKey));
    await act(async () => { root.unmount(); });
    assert.equal(cloudflareSync.drawerReplay,null,'unmount clears the previous account transport');
    const secondIdentity = {...identity,id:'cashier-2'};
    const secondInitial = seedAggregate(localStorage,secondIdentity,{cash_shifts_v1:[],expenses_v3:[],invoices_v3:[]});
    rows.set('braka:A:cashier-2:atomic_v1',secondInitial);
    const secondKeys = await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
    const secondEnvelope = await issueSignedOfflineGrant(await crypto.subtle.exportKey('jwk',issuer.privateKey),{
      tenantId:'A',cashierId:'cashier-2',deviceId:'device-1',branchIds:['branch-main'],drawerIds:['drawer-1'],onlineVerifiedAt:at,
      principalType:'user',credentialVersion:0,offlineIdentity:{role:'cashier',permissions:{canSell:true},syncScopeVersion:0},
      eventPublicJwk:await crypto.subtle.exportKey('jwk',secondKeys.publicKey)
    });
    const secondContext = {...context,cashierId:'cashier-2'};
    const secondRecord = await enrollOfflineGrant({...secondContext,envelope:secondEnvelope,eventPrivateJwk:await crypto.subtle.exportKey('jwk',secondKeys.privateKey)});
    await grantStore.saveRecord({tenantId:'A',cashierId:'cashier-2',deviceId:'device-1'},secondRecord);
    setSessionUser({...secondIdentity,sessionExpiresAt:new Date(Date.now()-1).toISOString()});
    setOfflineSession(await unlockOfflineGrant(secondRecord,secondContext),'branch-main');
    assert.equal(getSessionToken(),'','handover must not invent or extend a cloud bearer');
    await act(async () => { root=TestRenderer.create(React.createElement(Harness));await new Promise(resolve=>setTimeout(resolve,30)); });
    assert.equal(app.persistence.ready,true,app.persistence.error);
    await act(async()=>{await app.unlockCashDrawer('fixture-only','shift-2');});
    await act(async () => { await app.openShift({...opening,id:'shift-2',actorId:'cashier-2',openingCash:88,at:new Date().toISOString()}); });
    assert.deepEqual(app.cashShifts.map(row=>row.id),['shift-2']);
    assert.deepEqual(rows.get(userKey),firstRecord);
    const handedOver=rows.get(journalKey);
    assert.deepEqual(handedOver.shifts.map(row=>[row.actorId,row.status]),[['u','closed_local'],['cashier-2','open']]);
    assert.deepEqual(handedOver.sources.slice(0,closed.sources.length),closed.sources);
    assert.equal((await verifyOfflineCashEvent(handedOver.sources.at(-1),publicJwk,{tenantId:'A',deviceId:'device-1'})).cashierId,'cashier-2');
  } finally {
    await act(async () => { root?.unmount(); });
    delete globalThis.window; delete globalThis.document;
  }
});
