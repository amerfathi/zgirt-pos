import { CloudflareSyncService, selectSyncBatch } from '../src/services/cloudflareSync.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTenantStorage, scopedStorageKey, withoutCredentials, readTenantStorage, writeTenantStorage, writeTenantLoginContext,
  prepareAccessScope, readAccessScopeTransition, clearAccessScopeTransition } from '../src/services/tenantStorage.js';
import { getSessionUser, setSessionToken, setSessionUser } from '../src/services/authSession.js';
// Storage harness exercises namespacing independently of a specific browser.
const storage=()=>({values:new Map(),getItem(k){return this.values.get(k) ?? null;},setItem(k,v){this.values.set(k,String(v));},removeItem(k){this.values.delete(k);},
  clear(){this.values.clear();},key(index){return [...this.values.keys()][index]??null;},get length(){return this.values.size;}});
beforeEach(()=>{globalThis.localStorage=storage();globalThis.sessionStorage=storage();});
const user=(tenantId,id)=>({tenantId,id,sessionExpiresAt:new Date(Date.now()+60000).toISOString()});
test('tenant and user caches have disjoint namespaces',()=>{
  assert.notEqual(scopedStorageKey('invoices',user('A','one')),scopedStorageKey('invoices',user('B','one')));
  assert.notEqual(scopedStorageKey('invoices',user('A','one')),scopedStorageKey('invoices',user('A','two')));
});
test('an old real login without branch grants requires reauthentication without erasing its storage',()=>{
  setSessionToken('legacy-session');
  setSessionUser({...user('A','owner'),role:'company_owner',storeCode:'BRK-000',branchId:'all'});
  localStorage.setItem('old-ledger','preserved');
  assert.equal(getSessionUser(),null);
  assert.equal(localStorage.getItem('old-ledger'),'preserved');
});
test('authorization scope changes start a new namespace and quarantine the prior aggregate',()=>{
  const original={...user('A','staff'),syncScopeVersion:0};
  const changed={...original,syncScopeVersion:3,branchId:'branch-new'};
  const oldKey=scopedStorageKey('atomic_v1',original);
  localStorage.setItem(oldKey,JSON.stringify({schema:1,identity:original,outbox:[{id:'pending'}],cursor:51}));
  prepareAccessScope(original);
  const transition=prepareAccessScope(changed);
  assert.deepEqual({from:transition.from,to:transition.to,oldKey:transition.oldKey},{from:0,to:3,oldKey});
  assert.notEqual(transition.nextKey,oldKey);
  assert.equal(localStorage.getItem(oldKey).includes('pending'),true,'prior offline bytes remain recoverable');
  assert.deepEqual(readAccessScopeTransition(changed),transition);
  clearAccessScopeTransition(changed);
  assert.equal(readAccessScopeTransition(changed),null);
});
test('logout preserves unsent data but another login cannot read it',()=>{
  setSessionToken('test');setSessionUser(user('A','one'));writeTenantStorage('sales',[{id:'offline-sale'}]);
  setSessionToken(null);assert.deepEqual(readTenantStorage('sales',[]),[]);
  setSessionToken('test');setSessionUser(user('B','two'));assert.deepEqual(readTenantStorage('sales',[]),[]);
  setSessionToken('test');setSessionUser(user('A','one'));assert.equal(readTenantStorage('sales',[])[0].id,'offline-sale');
});
test('credential fields are stripped recursively without destroying business records',()=>{
  assert.deepEqual(withoutCredentials({users:[{id:'u',password:'temporary',password_hash:'hash'}],total:45}),{users:[{id:'u'}],total:45});
});
test('quota failure is raised, never reported as successful persistence',()=>{
  setSessionToken('test');setSessionUser(user('A','one'));localStorage.setItem=()=>{throw new Error('Quota exceeded');};
  assert.throws(()=>writeTenantStorage('sales',[{id:'s'}]),/Quota/);
});
test('pending store writes remain bound to the original account after login changes', () => {
  setSessionToken('test'); setSessionUser(user('A','one'));
  const original = createTenantStorage();
  setSessionUser(user('B','two'));
  original.write('sales', [{id:'belongs-to-A'}]);
  assert.deepEqual(readTenantStorage('sales', []), []);
  assert.deepEqual(original.read('sales', []), [{id:'belongs-to-A'}]);
});
test('anonymous store effects cannot overwrite a newly authenticated account', () => {
  const anonymous = createTenantStorage();
  setSessionToken('test'); setSessionUser(user('B','two'));
  writeTenantStorage('sales', [{id:'saved'}]);
  anonymous.write('sales', []);
  assert.deepEqual(readTenantStorage('sales', []), [{id:'saved'}]);
});
test('login seeds authenticated server branch but never overwrites existing offline branch references', () => {
  const identity=user('A','owner');
  const branch={id:'branch-server',tenantId:'A',name:'Main',isMain:true,status:'active'};
  writeTenantLoginContext({id:'A',allowedBranches:1},identity,[branch]);
  assert.deepEqual(readTenantStorage('khodar_pos_branches_v1',[],identity),[branch]);
  assert.equal(readTenantStorage('khodar_pos_active_branch_id_v1',null,identity),branch.id);
  const pending={id:'branch-offline',tenantId:'A',name:'Offline',isMain:true,status:'active'};
  writeTenantStorage('khodar_pos_branches_v1',[pending],identity);
  writeTenantLoginContext({id:'A',allowedBranches:1},identity,[branch]);
  assert.deepEqual(readTenantStorage('khodar_pos_branches_v1',[],identity),[pending]);
});
test('login can recover an empty pre-aggregate branch cache but preserves an existing aggregate', () => {
  const identity=user('A','owner');
  const branch={id:'server-main',tenantId:'A',name:'Main',isMain:true,status:'active'};
  writeTenantStorage('khodar_pos_branches_v1',[],identity);
  writeTenantStorage('khodar_pos_active_branch_id_v1','branch-main',identity);
  writeTenantLoginContext({id:'A'},identity,[branch]);
  assert.deepEqual(readTenantStorage('khodar_pos_branches_v1',[],identity),[branch]);
  assert.equal(readTenantStorage('khodar_pos_active_branch_id_v1',null,identity),branch.id);
  writeTenantStorage('khodar_pos_branches_v1',[],identity);
  localStorage.setItem(scopedStorageKey('atomic_v1',identity),'preserved aggregate bytes');
  writeTenantLoginContext({id:'A'},identity,[branch]);
  assert.deepEqual(readTenantStorage('khodar_pos_branches_v1',null,identity),[]);
  assert.equal(localStorage.getItem(scopedStorageKey('atomic_v1',identity)),'preserved aggregate bytes');
});
test('a corrupt offline queue is preserved and blocks mutation instead of being overwritten', () => {
  const raw = '{"broken":';
  localStorage.setItem('khodar_offline_sync_queue',raw);
  const sync=new CloudflareSyncService();
  assert.throws(()=>sync.recordMutation('A',null,'product','p','create',{id:'p'}));
  assert.equal(localStorage.getItem('khodar_offline_sync_queue'),raw);
});
test('a queue quota failure propagates to the caller', () => {
  const sync=new CloudflareSyncService();
  localStorage.setItem=()=>{throw new Error('Quota exceeded');};
  assert.throws(()=>sync.recordMutation('A',null,'product','p','create',{id:'p'}),/Quota/);
});
test('queue counters do not disclose another tenant pending work', () => {
  setSessionToken('test');setSessionUser(user('A','one'));
  localStorage.setItem('khodar_offline_sync_queue',JSON.stringify([{id:'a',tenantId:'A'},{id:'b',tenantId:'B'}]));
  assert.equal(new CloudflareSyncService().getQueueLength(),1);
});
test('server batches preserve transaction order across branch boundaries and do not split a local commit', () => {
  const queue=Array.from({length:98},(_,i)=>({id:`old-${i}`,branchId:'main',groupId:`g-${i}`}));
  queue.push({id:'supplier',branchId:null,groupId:'purchase'},{id:'purchase',branchId:'main',groupId:'purchase'},{id:'expense',branchId:'other',groupId:'purchase'});
  assert.equal(selectSyncBatch(queue).length,98);
  assert.deepEqual(selectSyncBatch(queue.slice(98)).map(e=>e.id),['supplier','purchase','expense']);
});
