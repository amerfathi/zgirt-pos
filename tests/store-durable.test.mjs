import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { seedAggregate } from './aggregate-fixture.mjs';
import { writeTenantLoginContext } from '../src/services/tenantStorage.js';

const locks = globalThis.navigator.locks;
const storage = () => ({ values: new Map(), getItem(key) { return this.values.get(key) ?? null; },
  setItem(key, value) { this.values.set(key, String(value)); }, removeItem(key) { this.values.delete(key); },
  clear() { this.values.clear(); }, key(index) { return [...this.values.keys()][index] ?? null; },
  get length() { return this.values.size; } });
const installBrowserDoubles = () => {
  globalThis.localStorage = storage(); globalThis.sessionStorage = storage();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false, locks } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    addEventListener() {}, removeEventListener() {}, location: { origin: 'https://test.invalid' }
  } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    addEventListener() {}, removeEventListener() {}, visibilityState: 'hidden'
  } });
};
const seedBranchContext = (target, userId) => {
  target.setItem(`braka:A:${userId}:khodar_pos_branches_v1`,JSON.stringify([
    {id:'branch-main',tenantId:'A',name:'Main',isMain:true,status:'active'}]));
  target.setItem(`braka:A:${userId}:khodar_pos_active_branch_id_v1`,JSON.stringify('branch-main'));
};

test('actual app hook cloud-checks and adopts an existing legacy aggregate before opening finance',async()=>{
  installBrowserDoubles();
  const bundle=await build({stdin:{contents:"export {useAppStore} from './src/store/useAppStore.js';export {cloudflareSync} from './src/services/cloudflareSync.js';export {setSessionToken,setSessionUser} from './src/services/authSession.js';",resolveDir:process.cwd()},bundle:true,write:false,define:{'import.meta.env':'{}'},format:'cjs',platform:'node',packages:'external'});
  const loaded={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
  const {useAppStore,cloudflareSync,setSessionToken,setSessionUser}=loaded.exports;
  const identity={id:'legacy-owner',tenantId:'A',role:'cashier',branchId:'branch-main',sessionExpiresAt:new Date(Date.now()+60000).toISOString()};
  const snapshot=seedAggregate(localStorage,identity,{
    products_v3:[],customers_v3:[],invoices_v3:[],expenses_v3:[],workers_v3:[],worker_transactions_v3:[],
    customer_payments_v3:[],purchases_v3:[],suppliers_v3:[],supplier_payments_v3:[],partner_drawings_v3:[],
    profit_distributions_v3:[],sales_returns_v3:[],purchase_returns_v3:[],damaged_v3:[],stock_transfers_v1:[]
  });
  const sourceRaw=localStorage.getItem('braka:A:legacy-owner:atomic_v1'),rows=new Map();
  const durableRepository={
    async read(key){return structuredClone(rows.get(key)??null);},
    async adoptIfEmpty(key,value){assert.equal(rows.has(key),false);rows.set(key,structuredClone(value));return structuredClone(value);},
    async commit(key,value){rows.set(key,structuredClone(value));return structuredClone(value);}
  };
  const previousFetch=globalThis.fetch;let app,root,pulls=0,branches=0;
  function Harness(){app=useAppStore({durableRepository});return null;}
  try{
    setSessionToken('test-session');setSessionUser(identity);
    globalThis.fetch=async url=>{
      if(String(url).includes('/api/sync/pull')){pulls++;return Response.json({success:true,fullTenantVisibility:true,events:[],nextCursor:0,hasMore:false});}
      if(String(url).includes('/api/branches')){branches++;return Response.json({success:true,tenantId:'A',fullTenantVisibility:true,latestSequence:0,branches:snapshot.state.khodar_pos_branches_v1});}
      throw Error(`Unexpected URL ${url}`);
    };
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));await new Promise(resolve=>setTimeout(resolve,100));});
    assert.equal(app.persistence.ready,true,app.persistence.error || 'persistence did not become ready');
    assert.equal(pulls,1);assert.equal(branches,1);
    assert.deepEqual(rows.get('braka:A:legacy-owner:atomic_v1'),snapshot);
    assert.equal(localStorage.getItem('braka:A:legacy-owner:atomic_v1'),sourceRaw);
    assert.equal(cloudflareSync.repository.durable,durableRepository);
  }finally{
    globalThis.fetch=previousFetch;
    await act(async()=>{root?.unmount();});cloudflareSync.stopAutoSync();delete globalThis.window;delete globalThis.document;
  }
});

test('actual app hook blocks finance when authenticated branch provenance is missing', async () => {
  installBrowserDoubles();
  const previousFetch=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({success:true,tenantId:'A',fullTenantVisibility:true,latestSequence:0,conflictHeads:{},branches:[]});
  const bundle=await build({stdin:{contents:"export {useAppStore} from './src/store/useAppStore.js';export {cloudflareSync} from './src/services/cloudflareSync.js';export {setSessionToken,setSessionUser} from './src/services/authSession.js';",resolveDir:process.cwd()},bundle:true,write:false,define:{'import.meta.env':'{}'},format:'cjs',platform:'node',packages:'external'});
  const loaded={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
  const {useAppStore,cloudflareSync,setSessionToken,setSessionUser}=loaded.exports;
  let app,root;function Harness(){app=useAppStore();return null;}
  try {
    setSessionToken('test-session');
    setSessionUser({id:'u',tenantId:'A',role:'company_owner',branchId:'all',sessionExpiresAt:new Date(Date.now()+60000).toISOString()});
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));await new Promise(resolve=>setTimeout(resolve,100));});
    assert.equal(app.persistence.ready,false);
    assert.match(app.persistence.error,/فروع الشركة/);
    assert.ok(!cloudflareSync.repository);
    assert.throws(()=>app.addExpense({id:'blocked-expense',amount:10}),/الحفظ غير متاح/);
    assert.equal(app.expenses.some(item=>item.id==='blocked-expense'),false);
  } finally {globalThis.fetch=previousFetch;await act(async()=>{root?.unmount();});cloudflareSync.stopAutoSync();delete globalThis.window;delete globalThis.document;}
});

test('owner startup repairs missing branch context from the authenticated manifest without changing saved finance', async () => {
  installBrowserDoubles();
  const bundle=await build({stdin:{contents:"export {useAppStore} from './src/store/useAppStore.js';export {cloudflareSync} from './src/services/cloudflareSync.js';export {setSessionToken,setSessionUser} from './src/services/authSession.js';",resolveDir:process.cwd()},bundle:true,write:false,define:{'import.meta.env':'{}'},format:'cjs',platform:'node',packages:'external'});
  const loaded={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
  const {useAppStore,cloudflareSync,setSessionToken,setSessionUser}=loaded.exports;
  const identity={id:'repair-owner',tenantId:'A',role:'company_owner',branchId:'all',sessionExpiresAt:new Date(Date.now()+60000).toISOString()};
  const branch={id:'branch-main',tenantId:'A',name:'Main',isMain:true,status:'active'};
  const invoice={id:'saved-invoice',tenantId:'A',branchId:branch.id,total:27};
  const saved=seedAggregate(localStorage,identity,{branches_v1:[],active_branch_id_v1:null,invoices_v3:[invoice]});
  const rows=new Map([['braka:A:repair-owner:atomic_v1',structuredClone(saved)]]);
  const durableRepository={async read(key){return structuredClone(rows.get(key)??null);},async commit(key,value){rows.set(key,structuredClone(value));return structuredClone(value);}};
  const previousFetch=globalThis.fetch;let app,root;
  function Harness(){app=useAppStore({durableRepository});return null;}
  try {
    setSessionToken('test-session');setSessionUser(identity);
    globalThis.fetch=async url=>String(url).includes('/api/branches')
      ? Response.json({success:true,tenantId:'A',fullTenantVisibility:true,latestSequence:0,conflictHeads:{'record:branch:branch-main':'server-branch-event'},branches:[branch]})
      : Response.json({success:true,events:[],nextCursor:0,hasMore:false,conflictHeads:{}});
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));await new Promise(resolve=>setTimeout(resolve,100));});
    assert.equal(app.persistence.ready,true,app.persistence.error);
    assert.deepEqual(app.invoices,[invoice]);
    assert.deepEqual(app.branches,[branch]);
    assert.equal(app.activeBranchId,branch.id);
    assert.deepEqual(rows.get('braka:A:repair-owner:atomic_v1').outbox,[]);
  } finally {globalThis.fetch=previousFetch;await act(async()=>{root?.unmount();});cloudflareSync.stopAutoSync();delete globalThis.window;delete globalThis.document;}
});

test('owner startup keeps protection when saved finance belongs to an unrecognized branch', async () => {
  installBrowserDoubles();
  const bundle=await build({stdin:{contents:"export {useAppStore} from './src/store/useAppStore.js';export {cloudflareSync} from './src/services/cloudflareSync.js';export {setSessionToken,setSessionUser} from './src/services/authSession.js';",resolveDir:process.cwd()},bundle:true,write:false,define:{'import.meta.env':'{}'},format:'cjs',platform:'node',packages:'external'});
  const loaded={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
  const {useAppStore,cloudflareSync,setSessionToken,setSessionUser}=loaded.exports;
  const identity={id:'unsafe-owner',tenantId:'A',role:'company_owner',branchId:'all',sessionExpiresAt:new Date(Date.now()+60000).toISOString()};
  const saved=seedAggregate(localStorage,identity,{branches_v1:[],active_branch_id_v1:null,invoices_v3:[{id:'invoice-other',tenantId:'A',branchId:'unknown-branch',total:27}]});
  const rows=new Map([['braka:A:unsafe-owner:atomic_v1',structuredClone(saved)]]);
  const durableRepository={async read(key){return structuredClone(rows.get(key)??null);},async commit(){throw Error('Unsafe aggregate must not be committed');}};
  const previousFetch=globalThis.fetch;let app,root;
  function Harness(){app=useAppStore({durableRepository});return null;}
  try {
    setSessionToken('test-session');setSessionUser(identity);
    globalThis.fetch=async()=>Response.json({success:true,tenantId:'A',fullTenantVisibility:true,latestSequence:0,conflictHeads:{},branches:[{id:'branch-main',tenantId:'A',name:'Main',isMain:true,status:'active'}]});
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));await new Promise(resolve=>setTimeout(resolve,100));});
    assert.equal(app.persistence.ready,false);
    assert.match(app.persistence.error,/فرع غير معروف/);
    assert.deepEqual(rows.get('braka:A:unsafe-owner:atomic_v1'),saved);
    assert.equal(cloudflareSync.repository,null);
  } finally {globalThis.fetch=previousFetch;await act(async()=>{root?.unmount();});cloudflareSync.stopAutoSync();delete globalThis.window;delete globalThis.document;}
});

test('actual app hook starts a newly authenticated tenant on its server-provisioned branch only', async () => {
  installBrowserDoubles();
  const bundle=await build({stdin:{contents:"export {useAppStore} from './src/store/useAppStore.js';export {cloudflareSync} from './src/services/cloudflareSync.js';export {setSessionToken,setSessionUser} from './src/services/authSession.js';",resolveDir:process.cwd()},bundle:true,write:false,define:{'import.meta.env':'{}'},format:'cjs',platform:'node',packages:'external'});
  const loaded={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
  const {useAppStore,cloudflareSync,setSessionToken,setSessionUser}=loaded.exports;
  const identity={id:'fresh-owner',tenantId:'fresh',role:'company_owner',branchId:'all',sessionExpiresAt:new Date(Date.now()+60000).toISOString()};
  const branch={id:'branch-provisioned',tenantId:'fresh',name:'Main',code:'BR-01',phone:'',address:'',managerName:'',isMain:true,status:'active'};
  const previousFetch=globalThis.fetch;
  let app,root;function Harness(){app=useAppStore();return null;}
  try {
    globalThis.fetch=async url=>String(url).includes('/api/branches')
      ? Response.json({success:true,tenantId:'fresh',fullTenantVisibility:true,latestSequence:0,conflictHeads:{},branches:[branch]})
      : Response.json({success:true,events:[],nextCursor:0,hasMore:false,conflictHeads:{}});
    setSessionToken('test-session');setSessionUser(identity);
    writeTenantLoginContext({id:'fresh',allowedBranches:1},identity,[branch]);
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));await new Promise(resolve=>setTimeout(resolve,100));});
    assert.equal(app.persistence.ready,true,app.persistence.error || 'persistence did not become ready');
    assert.deepEqual(app.branches,[branch]);
    assert.deepEqual(app.partners,[],'a new tenant must not inherit demo equity owners');
    assert.equal(app.activeBranchId,branch.id);
    assert.deepEqual(cloudflareSync.repository.value.outbox.map(event=>event.entityId),[branch.id]);
  } finally {globalThis.fetch=previousFetch;await act(async()=>{root?.unmount();});cloudflareSync.stopAutoSync();delete globalThis.window;delete globalThis.document;}
});

test('authorization-scope change quarantines pending offline work and blocks finance', async () => {
  installBrowserDoubles();
  const bundle=await build({stdin:{contents:"export {useAppStore} from './src/store/useAppStore.js';export {cloudflareSync} from './src/services/cloudflareSync.js';export {setSessionToken,setSessionUser} from './src/services/authSession.js';",resolveDir:process.cwd()},bundle:true,write:false,define:{'import.meta.env':'{}'},format:'cjs',platform:'node',packages:'external'});
  const loaded={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
  const {useAppStore,cloudflareSync,setSessionToken,setSessionUser}=loaded.exports;
  const oldIdentity={id:'scope-user',tenantId:'A',role:'cashier',branchId:'branch-main',syncScopeVersion:0,sessionExpiresAt:new Date(Date.now()+60000).toISOString()};
  const changed={...oldIdentity,branchId:'branch-other',syncScopeVersion:1};
  const snapshot=seedAggregate(localStorage,oldIdentity);
  snapshot.outbox=[{id:'offline-expense',tenantId:'A',branchId:'branch-main',entityType:'expense',entityId:'offline-expense',action:'create',payload:{id:'offline-expense'}}];
  const oldKey='braka:A:scope-user:atomic_v1';
  localStorage.setItem(oldKey,JSON.stringify(snapshot));
  writeTenantLoginContext({id:'A'},oldIdentity,[{id:'branch-main',tenantId:'A',name:'Main',isMain:true,status:'active'}]);
  writeTenantLoginContext({id:'A'},changed,[{id:'branch-other',tenantId:'A',name:'Other',isMain:false,status:'active'}]);
  let app,root;function Harness(){app=useAppStore();return null;}
  try {
    setSessionToken('changed-session');setSessionUser(changed);
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));await Promise.resolve();});
    assert.equal(app.persistence.ready,false);
    assert.match(app.persistence.error,/حركة محلية معلّقة/);
    assert.equal(localStorage.getItem(oldKey),JSON.stringify(snapshot));
    assert.equal(cloudflareSync.repository,null);
    assert.throws(()=>app.addExpense({id:'must-not-save',amount:10}),/الحفظ غير متاح/);
  } finally {await act(async()=>{root?.unmount();});cloudflareSync.stopAutoSync();delete globalThis.window;delete globalThis.document;}
});

test('actual app hook with opt-in durable repository waits before publishing an expense', async () => {
  installBrowserDoubles();
  const bundle = await build({ stdin: { contents: "export {useAppStore} from './src/store/useAppStore.js';export {cloudflareSync} from './src/services/cloudflareSync.js';export {setSessionToken,setSessionUser} from './src/services/authSession.js';", resolveDir: process.cwd() }, bundle: true, write: false, define: { 'import.meta.env': '{}' }, format: 'cjs', platform: 'node', packages: 'external' });
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const { useAppStore, cloudflareSync, setSessionToken, setSessionUser } = loaded.exports;
  let app, root;
  function Harness() { app = useAppStore(); return null; }
  try {
    setSessionToken('test-session');
    setSessionUser({ id: 'u', tenantId: 'A', role: 'cashier', branchId: 'branch-main', branchIds: ['branch-main'], isStaff: true, sessionExpiresAt: new Date(Date.now() + 60_000).toISOString() });
    seedBranchContext(localStorage,'u');
    await act(async () => { root = TestRenderer.create(React.createElement(Harness)); });
    const repo = cloudflareSync.repository;
    assert.ok(repo);
    const original = JSON.stringify(repo.value), count = app.expenses.length;
    let releaseCommit;
    repo.durable = { commit: (_key, snapshot, revision) => {
      assert.equal(revision, repo.value.revision);
      return new Promise(resolve => { releaseCommit = () => resolve(snapshot); });
    } };
    let pending;
    await act(async () => { pending = app.addExpense({ id: 'durable-expense', amount: 12, paymentMethod: 'cash' }); });
    assert.equal(typeof pending.then, 'function');
    assert.equal(app.expenses.length, count);
    assert.equal(JSON.stringify(repo.value), original);
    let saved;
    await act(async () => { releaseCommit(); saved = await pending; });
    assert.equal(saved.id, 'durable-expense');
    assert.equal(app.expenses.length, count + 1);
    assert.equal(repo.value.outbox.some(item => item.entityId === 'durable-expense'), true);
    const committed = JSON.stringify(repo.value);
    repo.durable = { commit: async () => { throw Error('Injected durable write failure'); } };
    await act(async () => {
      await assert.rejects(app.addExpense({ id: 'failed-expense', amount: 99, paymentMethod: 'cash' }), /Injected durable write failure/);
    });
    assert.equal(JSON.stringify(repo.value), committed);
    assert.equal(app.expenses.some(item => item.id === 'failed-expense'), false);
    assert.match(app.persistence.error, /Injected durable write failure/);
  } finally {
    await act(async () => { root?.unmount(); });
    cloudflareSync.stopAutoSync();
    delete globalThis.window; delete globalThis.document;
  }
});

test('online financial action waits for fresh server state and preserves inputs on preflight failure', async () => {
  installBrowserDoubles();
  const bundle = await build({ stdin: { contents: "export {useAppStore} from './src/store/useAppStore.js';export {cloudflareSync} from './src/services/cloudflareSync.js';export {setSessionToken,setSessionUser} from './src/services/authSession.js';", resolveDir: process.cwd() }, bundle: true, write: false, define: {'import.meta.env':'{}'}, format:'cjs', platform:'node', packages:'external' });
  const loaded = { exports: {} };
  new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
  const { useAppStore, cloudflareSync, setSessionToken, setSessionUser } = loaded.exports;
  let app, root, releasePreflight, calls = 0;
  function Harness() { app = useAppStore(); return null; }
  try {
    setSessionToken('test-session');
    setSessionUser({ id:'u', tenantId:'A', role:'cashier', branchId:'branch-main', branchIds:['branch-main'], isStaff:true,
      sessionExpiresAt:new Date(Date.now()+60_000).toISOString() });
    seedBranchContext(localStorage,'u');
    await act(async () => { root = TestRenderer.create(React.createElement(Harness)); });
    assert.equal(app.persistence.ready, true);
    const before = JSON.stringify(cloudflareSync.repository.value);
    cloudflareSync.isOnline = true;
    cloudflareSync.prepareFinancialMutation = async () => { calls++; return new Promise(resolve => { releasePreflight = resolve; }); };
    const pending = app.addExpense({ id:'online-preflight-expense', amount:10, paymentMethod:'cash' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 1);
    assert.equal(JSON.stringify(cloudflareSync.repository.value), before);
    releasePreflight({ success:false, error:'server unavailable' });
    await assert.rejects(pending, /server unavailable/);
    assert.equal(JSON.stringify(cloudflareSync.repository.value), before);
  } finally {
    await act(async () => { root?.unmount(); }); cloudflareSync.stopAutoSync();
    delete globalThis.window; delete globalThis.document;
  }
});

test('a durable financial commit triggers outbound delivery without waiting for the fallback timer', async () => {
  installBrowserDoubles();
  const bundle = await build({ stdin: { contents: "export {useAppStore} from './src/store/useAppStore.js';export {cloudflareSync} from './src/services/cloudflareSync.js';export {setSessionToken,setSessionUser} from './src/services/authSession.js';", resolveDir: process.cwd() }, bundle: true, write: false, define: {'import.meta.env':'{}'}, format:'cjs', platform:'node', packages:'external' });
  const loaded = { exports:{} };
  new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
  const { useAppStore, cloudflareSync, setSessionToken, setSessionUser } = loaded.exports;
  let app, root, deliver = 0;
  function Harness() { app = useAppStore(); return null; }
  try {
    setSessionToken('test-session');
    setSessionUser({ id:'u', tenantId:'A', role:'cashier', branchId:'branch-main', branchIds:['branch-main'], isStaff:true,
      sessionExpiresAt:new Date(Date.now()+60_000).toISOString() });
    seedBranchContext(localStorage,'u');
    await act(async () => { root = TestRenderer.create(React.createElement(Harness)); });
    assert.equal(app.persistence.ready, true);
    cloudflareSync.isOnline = true;
    cloudflareSync.prepareFinancialMutation = async () => ({success:true});
    cloudflareSync.flushQueue = async () => { deliver++; return false; };
    await act(async () => { await app.addExpense({id:'deliver-after-commit', amount:10, paymentMethod:'cash'}); });
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(deliver >= 1, 'the durable commit must wake the outbound queue');
    assert.equal(cloudflareSync.repository.current.outbox.some(event => event.entityId === 'deliver-after-commit'), true);
  } finally {
    await act(async () => { root?.unmount(); }); cloudflareSync.stopAutoSync();
    delete globalThis.window; delete globalThis.document;
  }
});

test('server-created user stays a success when its local cache commit fails', async () => {
  installBrowserDoubles();
  const bundle = await build({ stdin: { contents: "export {useAppStore} from './src/store/useAppStore.js';export {cloudflareSync} from './src/services/cloudflareSync.js';export {setSessionToken,setSessionUser} from './src/services/authSession.js';", resolveDir: process.cwd() }, bundle: true, write: false, define: { 'import.meta.env': '{}' }, format: 'cjs', platform: 'node', packages: 'external' });
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const { useAppStore, cloudflareSync, setSessionToken, setSessionUser } = loaded.exports;
  let app, root, serverCalls = 0;
  const previousFetch = globalThis.fetch;
  function Harness() { app = useAppStore(); return null; }
  try {
    setSessionToken('test-session');
    setSessionUser({ id: 'owner', tenantId: 'A', role: 'admin', branchId: 'branch-main', sessionExpiresAt: new Date(Date.now() + 60_000).toISOString() });
    seedBranchContext(localStorage,'owner');
    await act(async () => { root = TestRenderer.create(React.createElement(Harness)); });
    const repo = cloudflareSync.repository;
    const original = JSON.stringify(repo.value);
    globalThis.fetch = async (_url, init) => {
      assert.equal(init.method, 'POST');
      serverCalls++;
      return Response.json({ success: true, user: { id: 'remote-staff', tenantId: 'A', name: 'Staff' } });
    };
    repo.durable = { commit: async () => { throw Error('Injected metadata commit failure'); } };
    let created;
    await act(async () => { created = await app.addUser({ name: 'Staff' }); });
    assert.equal(created.id, 'remote-staff');
    assert.equal(serverCalls, 1);
    assert.equal(JSON.stringify(repo.value), original);
    assert.equal(app.users.some(user => user.id === 'remote-staff'), false);
    assert.match(app.persistence.error, /metadata commit failure/);
  } finally {
    globalThis.fetch = previousFetch;
    await act(async () => { root?.unmount(); });
    cloudflareSync.stopAutoSync();
    delete globalThis.window; delete globalThis.document;
  }
});

test('actual app hook reopens from durable authority despite corrupt legacy caches', async () => {
  installBrowserDoubles();
  const bundle = await build({ stdin: { contents: "export {useAppStore} from './src/store/useAppStore.js';export {cloudflareSync} from './src/services/cloudflareSync.js';export {setSessionToken,setSessionUser} from './src/services/authSession.js';", resolveDir: process.cwd() }, bundle: true, write: false, define: { 'import.meta.env': '{}' }, format: 'cjs', platform: 'node', packages: 'external' });
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const { useAppStore, cloudflareSync, setSessionToken, setSessionUser } = loaded.exports;
  const rows = new Map();
  const initial=seedAggregate(storage(),{id:'u',tenantId:'A'});
  rows.set('braka:A:u:atomic_v1',initial);
  const durableRepository = {
    async read(key) { return structuredClone(rows.get(key) ?? null); },
    async commit(key, snapshot, expectedRevision) {
      assert.equal(rows.get(key)?.revision ?? null, expectedRevision);
      rows.set(key, structuredClone(snapshot));
      return structuredClone(snapshot);
    }
  };
  let app, root;
  function Harness() { app = useAppStore({ durableRepository }); return null; }
  try {
    setSessionToken('test-session');
    setSessionUser({ id: 'u', tenantId: 'A', role: 'cashier', branchId: 'branch-main', branchIds: ['branch-main'], isStaff: true, sessionExpiresAt: new Date(Date.now() + 60_000).toISOString() });
    await act(async () => { root = TestRenderer.create(React.createElement(Harness)); });
    assert.equal(app.persistence.ready, true);
    await act(async () => { await app.addExpense({ id: 'saved-expense', title: 'Rent', amount: 12, paymentMethod: 'cash' }); });
    const saved = structuredClone(cloudflareSync.repository.value);
    assert.equal(saved.outbox.some(event => event.entityId === 'saved-expense'), true);
    await act(async () => { root.unmount(); });
    const key = 'braka:A:u:atomic_v1';
    localStorage.setItem(key, '{broken aggregate cache');
    localStorage.setItem('braka:A:u:khodar_pos_expenses_v3', '{broken pre-aggregate cache');
    await act(async () => { root = TestRenderer.create(React.createElement(Harness)); });
    assert.equal(app.persistence.ready, true);
    assert.deepEqual(cloudflareSync.repository.value, saved);
    assert.equal(app.expenses.some(expense => expense.id === 'saved-expense'), true);
    assert.equal(localStorage.getItem(key), '{broken aggregate cache');
  } finally {
    await act(async () => { root?.unmount(); });
    cloudflareSync.stopAutoSync();
    delete globalThis.window; delete globalThis.document;
  }
});

test('actual app hook refuses to seed durable storage over orphan financial data', async () => {
  installBrowserDoubles();
  const oldKey = 'braka:A:u:khodar_pos_invoices_v3';
  localStorage.setItem(oldKey, '{damaged old invoice cache');
  const bundle = await build({ stdin: { contents: "export {useAppStore} from './src/store/useAppStore.js';export {cloudflareSync} from './src/services/cloudflareSync.js';export {setSessionToken,setSessionUser} from './src/services/authSession.js';", resolveDir: process.cwd() }, bundle: true, write: false, define: { 'import.meta.env': '{}' }, format: 'cjs', platform: 'node', packages: 'external' });
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const { useAppStore, cloudflareSync, setSessionToken, setSessionUser } = loaded.exports;
  let app, root, seeded = false;
  function Harness() { app = useAppStore({ durableRepository: {
    read: async () => null, commit: async () => { seeded = true; throw Error('must not seed'); }
  } }); return null; }
  try {
    setSessionToken('test-session');
    setSessionUser({ id: 'u', tenantId: 'A', role: 'cashier', sessionExpiresAt: new Date(Date.now() + 60_000).toISOString() });
    await act(async () => { root = TestRenderer.create(React.createElement(Harness)); });
    assert.equal(app.persistence.ready, false);
    assert.match(app.persistence.error, /بيانات مالية قديمة للحساب بلا سجل تجميعي/);
    assert.equal(seeded, false);
    assert.equal(localStorage.getItem(oldKey), '{damaged old invoice cache');
    assert.equal(localStorage.getItem('braka:A:u:atomic_v1'), null);
  } finally {
    await act(async () => { root?.unmount(); });
    cloudflareSync.stopAutoSync();
    delete globalThis.window; delete globalThis.document;
  }
});
