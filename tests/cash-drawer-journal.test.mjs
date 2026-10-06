import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AtomicStore } from '../src/services/atomicStore.js';
import * as journal from '../src/services/cashDrawerJournal.js';
import { verifySignedOfflineGrant } from '../src/services/verifiedOfflineGrant.js';
import {enrollOfflineGrant,unlockOfflineGrant} from '../src/services/offlineUnlock.js';
import {issueSignedOfflineGrant} from '../functions/_lib/offlineGrantSignature.js';
import {CloudflareSyncService} from '../src/services/cloudflareSync.js';
import {setSessionToken,setSessionUser} from '../src/services/authSession.js';

const cache = () => ({ rows:new Map(), getItem(key){return this.rows.get(key)??null;},
  setItem(key,value){this.rows.set(key,String(value));}, removeItem(key){this.rows.delete(key);},
  clear(){this.rows.clear();},key(index){return [...this.rows.keys()][index]??null;},get length(){return this.rows.size;} });
const locks = { async request(_key,_options,fn){return fn({});}, async query(){return {held:[],pending:[]};} };
const durable = () => ({ rows:new Map(), fail:false,
  async read(key){return structuredClone(this.rows.get(key)??null);},
  async commit(key,value,expectedRevision){
    if(this.fail)throw Error('Injected paired commit failure');
    if ((this.rows.get(key)?.revision??null)!==expectedRevision) throw Error('Revision conflict');
    this.rows.set(key,structuredClone(value));return structuredClone(value);
  },
  async commitBatch(entries){
    if(this.fail)throw Error('Injected paired commit failure');
    for(const entry of entries)if((this.rows.get(entry.key)?.revision??null)!==entry.expectedRevision)throw Error('Revision conflict');
    for(const entry of entries)this.rows.set(entry.key,structuredClone(entry.snapshot));
    return entries.map(entry=>structuredClone(entry.snapshot));
  }
});

test('journal-only acknowledgement uses the real durable single-record contract',async()=>{
  const disk=durable(),storage=cache(),uploader=await storeFor('cashier-b',disk,storage);
  const paired=disk.commitBatch.bind(disk);
  disk.commitBatch=async entries=>{if(entries.length<2)throw Error('مراجعات السجلات الدائمة المشتركة غير صالحة');return paired(entries);};
  const scope={tenantId:'tenant-a',branchId:'branch-1',drawerId:'drawer-1',deviceId:'device-1'};
  const key='braka:tenant-a:branch-1:drawer-1:device-1:cash_drawer_journal_v1';
  const sources=[{source:{id:'other-cashier-source',tenantId:'tenant-a',branchId:'branch-1'},grant:{},signature:'fixture'}];
  disk.rows.set(key,{revision:0,...scope,shifts:[],sources});
  const before=structuredClone(uploader.value);
  const send=async()=>({success:true,acceptedIds:['other-cashier-source']});
  assert.equal(await journal.replayDrawerJournal(disk,locks,scope,send,{repository:uploader}),true);
  assert.deepEqual(uploader.value,before);
  assert.deepEqual(disk.rows.get(key).acceptedIds,['other-cashier-source']);
  await uploader.close();
});
const storeFor = async (id,disk,storage,initial={}) => {
  const store=new AtomicStore({id,tenantId:'tenant-a'},initial,storage,{durableFirst:true});
  assert.equal(await store.acquire(locks,disk),true);return store;
};
const grant = cashierId => ({tenantId:'tenant-a',cashierId,deviceId:'device-1',branchIds:['branch-1'],drawerIds:['drawer-1'],onlineVerifiedAt:'2026-10-01T17:00:00Z'});
const keys = await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const publicJwk = await crypto.subtle.exportKey('jwk',keys.publicKey);
const signedGrant = async (cashierId,drawerIds=['drawer-1']) => {
  const claims={...grant(cashierId),drawerIds};
  const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,
    new TextEncoder().encode(JSON.stringify(claims)));
  return verifySignedOfflineGrant({claims,signature:Buffer.from(signature).toString('base64url')},publicJwk);
};
const open = (id,actorId,at) => ({id,tenantId:'tenant-a',branchId:'branch-1',drawerId:'drawer-1',actorId,
  offlineDeviceId:'device-1',openingCash:100,at,timeZone:'Asia/Riyadh'});
const close = (id,actorId,at) => ({shiftId:id,actorId,deviceId:'device-1',countedCash:100,at});

test('actual sync sends shared proofs through signed replay and rejects stale account completion',async()=>{
  const previousSession=globalThis.sessionStorage,previousFetch=globalThis.fetch;
  globalThis.sessionStorage=cache();
  const disk=durable(),storage=cache(),repository=await storeFor('cashier-b',disk,storage,{
    khodar_pos_active_branch_id_v1:'branch-1'
  });
  await repository.transactDurable(()=>repository.enqueue({id:'sync-source',tenantId:'tenant-a',
    branchId:'branch-1',entityType:'expense',entityId:'e',action:'create',payload:{id:'e',branchId:'branch-1',amount:1}}));
  const scope={tenantId:'tenant-a',branchId:'branch-1',drawerId:'drawer-1',deviceId:'device-1'};
  const key='braka:tenant-a:branch-1:drawer-1:device-1:cash_drawer_journal_v1';
  const proofs=repository.value.outbox.map(source=>({source,grant:{},signature:'fixture'}));
  disk.rows.set(key,{revision:0,...scope,shifts:[],sources:proofs});
  const identity={id:'cashier-b',tenantId:'tenant-a',branchIds:['branch-1'],sessionExpiresAt:new Date(Date.now()+60000).toISOString()};
  setSessionToken('fixture-token');setSessionUser(identity);
  const service=new CloudflareSyncService();service.isOnline=true;service.repository=repository;service.currentTenantId=scope.tenantId;
  service.drawerReplay={scope,locks,deviceProof:'fixture-device-proof'};
  let change='account',requests=0;
  globalThis.fetch=async(url,options)=>{
    requests++;assert.ok(url.endsWith('/api/cash/replay'));
    const body=JSON.parse(options.body);assert.deepEqual(body.proofs,proofs);
    assert.equal(body.deviceId,scope.deviceId);assert.equal(options.headers.Authorization,'Bearer fixture-token');
    if(change==='account')setSessionUser({...identity,id:'other-account'});
    if(change==='branch')await repository.transactDurable(()=>repository.set('khodar_pos_active_branch_id_v1','other-branch'));
    return Response.json({success:true,acceptedIds:['sync-source']});
  };
  try {
    assert.equal(await service.flushQueue({pullAfterFlush:false}),false);
    assert.equal(repository.value.outbox.length,1);assert.equal(disk.rows.get(key).revision,0);
    setSessionUser(identity);change='branch';
    assert.equal(await service.flushQueue({pullAfterFlush:false}),false);
    assert.equal(repository.value.outbox.length,1);assert.equal(disk.rows.get(key).revision,0);
    await repository.transactDurable(()=>repository.set('khodar_pos_active_branch_id_v1','branch-1'));
    change='none';
    assert.equal(await service.flushQueue({pullAfterFlush:false}),true);
    assert.equal(repository.value.outbox.length,0);assert.deepEqual(disk.rows.get(key).acceptedIds,['sync-source']);
    assert.equal(requests,3);
  } finally {service.stopAutoSync();await repository.close();globalThis.fetch=previousFetch;globalThis.sessionStorage=previousSession;}
});

test('shared replay preserves proofs on lost response or failed acknowledgement and never mixes user queues',async()=>{
  const disk=durable(),scope={tenantId:'tenant-a',branchId:'branch-1',drawerId:'drawer-1',deviceId:'device-1'};
  const key='braka:tenant-a:branch-1:drawer-1:device-1:cash_drawer_journal_v1';
  const source=id=>({source:{id,tenantId:'tenant-a',branchId:'branch-1',groupId:id},signature:'fixture',grant:{}});
  const sources=[source('first'),source('second')];
  disk.rows.set(key,{revision:0,...scope,shifts:[],sources});
  assert.equal(typeof journal.replayDrawerJournal,'function');
  const invoke=send=>journal.replayDrawerJournal(disk,locks,scope,send);
  await assert.rejects(invoke(async()=>{throw Error('Lost response');}),/Lost response/);
  assert.deepEqual(disk.rows.get(key).sources,sources);
  await assert.rejects(invoke(async()=>({success:true,acceptedIds:['first']})),/acknowledgement/);
  assert.equal(disk.rows.get(key).revision,0);
  disk.fail=true;
  await assert.rejects(invoke(async()=>({success:true,acceptedIds:['first','second']})),/Injected/);
  assert.equal(disk.rows.get(key).revision,0);
  disk.fail=false;
  assert.equal(await invoke(async batch=>{
    assert.deepEqual(batch,sources);
    return {success:true,acceptedIds:['first','second']};
  }),true);
  assert.deepEqual(disk.rows.get(key).sources,sources); // Audit proofs are not deleted.
  assert.deepEqual(disk.rows.get(key).acceptedIds,['first','second']);
  let requests=0;
  assert.equal(await invoke(async()=>{requests++;}),true);
  assert.equal(requests,0);
});

test('two pre-enrolled cashier claim fixtures hand over a local drawer without mixing user records',async()=>{
  assert.equal(typeof journal.commitDrawerShiftDurable,'function');
  const disk=durable(),storage=cache();
  const first=await storeFor('cashier-1',disk,storage),second=await storeFor('cashier-2',disk,storage);
  await journal.commitDrawerShiftDurable(first,disk,locks,'open',open('shift-1','cashier-1','2026-10-01T18:00:00Z'),await signedGrant('cashier-1'));
  await journal.commitDrawerShiftDurable(first,disk,locks,'close',close('shift-1','cashier-1','2026-10-01T19:00:00Z'),await signedGrant('cashier-1'));
  await journal.commitDrawerShiftDurable(second,disk,locks,'open',open('shift-2','cashier-2','2026-10-01T19:01:00Z'),await signedGrant('cashier-2'));
  assert.deepEqual(first.value.state.khodar_pos_cash_shifts_v1.map(row=>row.id),['shift-1']);
  assert.deepEqual(second.value.state.khodar_pos_cash_shifts_v1.map(row=>row.id),['shift-2']);
  const shared=[...disk.rows.entries()].find(([key])=>key.endsWith(':cash_drawer_journal_v1'))?.[1];
  assert.deepEqual(shared.shifts.map(row=>[row.id,row.actorId,row.status]),[
    ['shift-1','cashier-1','closed_local'],['shift-2','cashier-2','open']]);
  await first.close();await second.close();
  const reopened=await storeFor('cashier-2',disk,storage);
  assert.equal(reopened.value.state.khodar_pos_cash_shifts_v1[0].id,'shift-2');
  await reopened.close();
});

test('replay never splits a commit group and retains sources appended during the request',async()=>{
  const disk=durable(),scope={tenantId:'tenant-a',branchId:'branch-1',drawerId:'drawer-1',deviceId:'device-1'};
  const key='braka:tenant-a:branch-1:drawer-1:device-1:cash_drawer_journal_v1';
  const make=(id,groupId)=>({source:{id,groupId,tenantId:scope.tenantId,branchId:scope.branchId}});
  const sources=Array.from({length:101},(_,i)=>make(String(i),i<99?'group-a':'group-b'));
  disk.rows.set(key,{revision:0,...scope,shifts:[],sources});
  assert.equal(await journal.replayDrawerJournal(disk,locks,scope,async batch=>{
    assert.equal(batch.length,99);
    const saved=disk.rows.get(key);
    disk.rows.set(key,{...saved,revision:1,sources:[...saved.sources,make('new','group-c')]});
    return {success:true,acceptedIds:batch.map(proof=>proof.source.id)};
  }),false);
  assert.equal(disk.rows.get(key).sources.length,102);
  assert.equal(disk.rows.get(key).acceptedIds.length,99);
  assert.equal(disk.rows.get(key).revision,2);
  assert.equal(await journal.replayDrawerJournal(disk,locks,scope,async batch=>{
    assert.deepEqual(batch.map(proof=>proof.source.id),['99','100','new']);
    return {success:true,acceptedIds:batch.map(proof=>proof.source.id)};
  }),true);
  disk.rows.set(key,{revision:0,...scope,shifts:[],sources:sources.map(proof=>({...proof,source:{...proof.source,groupId:'huge'}}))});
  await assert.rejects(journal.replayDrawerJournal(disk,locks,scope,async()=>{throw Error('Must not send');}),/exceeds replay limit/);
});

test('shared replay acknowledges only the current cashier queue in one paired durable commit',async()=>{
  const disk=durable(),storage=cache(),a=await storeFor('cashier-a',disk,storage),b=await storeFor('cashier-b',disk,storage);
  for(const {store,id} of [{store:a,id:'a-source'},{store:b,id:'b-source'}])await store.transactDurable(()=>store.enqueue({
    id,tenantId:'tenant-a',branchId:'branch-1',entityType:'expense',entityId:id,action:'create',
    payload:{id,tenantId:'tenant-a',branchId:'branch-1',amount:1}
  }));
  const scope={tenantId:'tenant-a',branchId:'branch-1',drawerId:'drawer-1',deviceId:'device-1'};
  const key='braka:tenant-a:branch-1:drawer-1:device-1:cash_drawer_journal_v1';
  const sources=[...a.value.outbox,...b.value.outbox].map(source=>({source,grant:{},signature:'fixture'}));
  disk.rows.set(key,{revision:0,...scope,shifts:[],sources});
  const send=async()=>({success:true,acceptedIds:sources.map(proof=>proof.source.id)});
  disk.fail=true;
  await assert.rejects(journal.replayDrawerJournal(disk,locks,scope,send,{repository:b}),/Injected/);
  assert.equal(b.value.outbox.length,1);assert.equal(disk.rows.get(key).revision,0);
  disk.fail=false;
  assert.equal(await journal.replayDrawerJournal(disk,locks,scope,send,{repository:b}),true);
  assert.equal(b.value.outbox.length,0);assert.equal(a.value.outbox.length,1);
  assert.equal(disk.rows.get(b.key).outbox.length,0);
  assert.equal(await journal.replayDrawerJournal(disk,locks,scope,async()=>{throw Error('No resend required');},{repository:a}),true);
  assert.equal(a.value.outbox.length,0);
  await a.close();await b.close();
});

test('failed paired commit cannot open a shift only in one of the two records',async()=>{
  assert.equal(typeof journal.commitDrawerShiftDurable,'function');
  const disk=durable(),storage=cache(),first=await storeFor('cashier-1',disk,storage);
  disk.fail=true;
  await assert.rejects(journal.commitDrawerShiftDurable(first,disk,locks,'open',open('shift-1','cashier-1','2026-10-01T18:00:00Z'),await signedGrant('cashier-1')),/Injected paired commit failure/);
  assert.deepEqual(first.value.state,{});
  assert.equal([...disk.rows.keys()].some(key=>key.endsWith(':cash_drawer_journal_v1')),false);
  await first.close();
});

test('unsigned caller-provided claims cannot authorize an offline drawer opening',async()=>{
  const disk=durable(),storage=cache(),first=await storeFor('cashier-1',disk,storage);
  await assert.rejects(journal.commitDrawerShiftDurable(first,disk,locks,'open',
    open('shift-unsigned','cashier-1','2026-10-01T18:00:00Z'),grant('cashier-1')),/توقيع|موثوق/);
  assert.deepEqual(first.value.state,{});
  await first.close();
});

test('a signed branch grant without drawer assignment cannot open a local drawer',async()=>{
  const disk=durable(),storage=cache(),first=await storeFor('cashier-1',disk,storage);
  const before=structuredClone([...disk.rows]);
  await assert.rejects(journal.commitDrawerShiftDurable(first,disk,locks,'open',
    open('unassigned','cashier-1','2026-10-01T18:00:00Z'),await signedGrant('cashier-1',[])),/الدرج/);
  assert.deepEqual([...disk.rows],before);
  await first.close();
});

test('a valid grant for another cashier cannot close or move this cashier drawer',async()=>{
  const disk=durable(),storage=cache(),first=await storeFor('cashier-1',disk,storage);
  await journal.commitDrawerShiftDurable(first,disk,locks,'open',open('shift-owner','cashier-1','2026-10-01T18:00:00Z'),await signedGrant('cashier-1'));
  const before=structuredClone([...disk.rows]);
  const other=await signedGrant('cashier-2');
  await assert.rejects(journal.commitDrawerShiftDurable(first,disk,locks,'close',close('shift-owner','cashier-1','2026-10-01T19:00:00Z'),other),/محاسب|تصريح|مطابق/);
  assert.deepEqual([...disk.rows],before);
  await assert.rejects(journal.commitDrawerShiftDurable(first,disk,locks,'cash',{
    shiftId:'shift-owner',actorId:'cashier-1',deviceId:'device-1',id:'unauthorized-cash',amount:5,at:'2026-10-01T18:05:00Z'
  },other),/محاسب|تصريح|مطابق/);
  assert.deepEqual([...disk.rows],before);
  await first.close();
});

test('altering signed cashier or branch claims invalidates the offline grant',async()=>{
  const claims=grant('cashier-1');
  const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,
    new TextEncoder().encode(JSON.stringify(claims)));
  const envelope={claims,signature:Buffer.from(signature).toString('base64url')};
  await assert.rejects(verifySignedOfflineGrant({...envelope,claims:{...claims,cashierId:'cashier-2'}},publicJwk),/توقيع/);
  await assert.rejects(verifySignedOfflineGrant({...envelope,claims:{...claims,branchIds:['branch-2']}},publicJwk),/توقيع/);
});

test('financial source and signed drawer journal commit together or neither commits',async()=>{
  const disk=durable(),storage=cache(),first=await storeFor('cashier-1',disk,storage,{khodar_pos_expenses_v3:[]});
  const eventKeys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const envelope=await issueSignedOfflineGrant(await crypto.subtle.exportKey('jwk',keys.privateKey),
    {...grant('cashier-1'),eventPublicJwk:await crypto.subtle.exportKey('jwk',eventKeys.publicKey)});
  const context={tenantId:'tenant-a',cashierId:'cashier-1',deviceId:'device-1',branchId:'branch-1',
    password:'fixture-pass',pinnedPublicJwk:publicJwk,at:'2026-10-01T18:00:00Z'};
  const record=await enrollOfflineGrant({...context,envelope,eventPrivateJwk:await crypto.subtle.exportKey('jwk',eventKeys.privateKey)});
  const unlocked=await unlockOfflineGrant(record,context);
  await journal.commitDrawerShiftDurable(first,disk,locks,'open',open('shift-finance','cashier-1',context.at),unlocked,{signSources:true});
  const financial=()=>{
    const expense={id:'expense-finance',tenantId:'tenant-a',branchId:'branch-1',amount:12,paymentMethod:'cash',cashShiftId:'shift-finance'};
    first.set('khodar_pos_expenses_v3',[expense]);
    first.enqueue({id:'source-finance',tenantId:'tenant-a',branchId:'branch-1',entityType:'expense',entityId:expense.id,
      action:'create',payload:expense,timestamp:Date.parse('2026-10-01T18:05:00Z')});
  };
  const input={shiftId:'shift-finance',id:'cash:expense-finance',actorId:'cashier-1',deviceId:'device-1',amount:-12,at:'2026-10-01T18:05:00Z'};
  const before=structuredClone(first.value);
  disk.fail=true;
  await assert.rejects(journal.commitDrawerShiftDurable(first,disk,locks,'cash',input,unlocked,{financialAction:financial}),/Injected/);
  assert.deepEqual(first.value,before);
  disk.fail=false;
  await assert.rejects(journal.commitDrawerShiftDurable(first,disk,locks,'cash',{...input,amount:-13},unlocked,{financialAction:financial}),/مصدر الحركة/);
  assert.deepEqual(first.value,before);
  await journal.commitDrawerShiftDurable(first,disk,locks,'cash',input,unlocked,{financialAction:financial});
  assert.equal(first.value.state.khodar_pos_expenses_v3?.[0]?.amount,12);
  const shared=[...disk.rows.values()].find(row=>row.drawerId==='drawer-1');
  assert.equal(shared.sources?.some(proof=>proof.source.id==='source-finance'),true);
  assert.equal(shared.sources?.some(proof=>proof.source.entityType==='cash_shift'),true);
  await journal.commitDrawerShiftDurable(first,disk,locks,'close',{...close('shift-finance','cashier-1','2026-10-01T19:00:00Z'),countedCash:88},unlocked,{signSources:true});
  const closed=[...disk.rows.values()].find(row=>row.drawerId==='drawer-1');
  assert.equal(closed.sources.length,shared.sources.length+1);
  assert.equal(closed.shifts[0].expectedCash,88);
  await first.close();
});
