import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { seedAggregate } from './aggregate-fixture.mjs';
import { attachConflictPreconditions } from '../src/services/syncConflictPolicy.js';

// Mount the actual production hook. Only browser storage/events are provided by
// a harness; no API success is fabricated. The device stays offline throughout.
const browserLocks = globalThis.navigator.locks;

test('actual hook installs owner-reviewed server choice, removes only reviewed optimism and reopens with reconciled debt/stock',async()=>{
  globalThis.localStorage=storage();globalThis.sessionStorage=storage();
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false,locks:browserLocks}});
  Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener(){},removeEventListener(){},location:{origin:'https://test.invalid'}}});
  Object.defineProperty(globalThis,'document',{configurable:true,value:{addEventListener(){},removeEventListener(){},visibilityState:'hidden'}});
  const bundle=await build({stdin:{contents:"export {useAppStore} from './src/store/useAppStore.js';export {cloudflareSync} from './src/services/cloudflareSync.js';export {setSessionToken,setSessionUser} from './src/services/authSession.js';",resolveDir:process.cwd()},bundle:true,write:false,define:{'import.meta.env':'{}'},format:'cjs',platform:'node',packages:'external'});
  const loaded={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
  const {useAppStore,cloudflareSync,setSessionToken,setSessionUser}=loaded.exports;
  const branch={id:'main',tenantId:'A',name:'Main',isMain:true,status:'active'},product={id:'p',tenantId:'A',branchId:'main',name:'Carrot',currentStockKg:20,branchStock:{main:20}},customer={id:'c',tenantId:'A',branchId:'main',balance:0};
  let app,root;function Harness(){app=useAppStore();return null;}
  try{
    setSessionToken('test-session');setSessionUser({id:'review-hook',tenantId:'A',role:'company_owner',branchId:'main',branchIds:['main'],sessionExpiresAt:new Date(Date.now()+60000).toISOString()});
    seedAggregate(localStorage,{id:'review-hook',tenantId:'A'},{branches_v1:[branch],active_branch_id_v1:'main',products_v3:[product],customers_v3:[customer]});
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));await new Promise(resolve=>setTimeout(resolve,0));});
    await act(async()=>{app.saveInvoice({customerId:'c',remainingDebt:15,items:[{productId:'p',netWeight:3}],paymentMethod:'credit',finalTotal:15});});
    const queue=structuredClone(cloudflareSync.repository.current.outbox);
    assert.equal(queue.length,1);assert.match(queue[0].entityId,/\d{6}-[a-f0-9-]{36}$/);
    const history=[{id:'server-product',entityType:'product',entityId:'p',action:'create',payload:product},
      {id:'server-customer',entityType:'customer',entityId:'c',action:'create',payload:customer},
      {id:'server-invoice',entityType:'invoice',entityId:'server-sale',action:'create',payload:{id:'server-sale',tenantId:'A',branchId:'main',customerId:'c',status:'active',remainingDebt:10,finalTotal:10,items:[{productId:'p',netWeight:2}]}}]
      .map((event,index)=>({...event,tenantId:'A',branchId:'main',sequence:index+1}));
    const proposal={protocol:'owner-reviewed-ledger-v1',tenantId:'A',completeHistory:true,history,branches:[branch],queue,nextCursor:3,conflictHeads:{},receipts:[{reviewId:'hook-review',tenantId:'A',choice:'server',events:queue,acceptedEventIds:[]}]};
    await act(async()=>{await cloudflareSync.updateHandler(history,3,{},true,proposal);});
    assert.equal(app.products[0].currentStockKg,18);assert.equal(app.customers[0].balance,10);assert.deepEqual(app.invoices.map(row=>row.id),['server-sale']);
    assert.equal(cloudflareSync.repository.current.outbox.length,0);assert.equal(cloudflareSync.repository.read('braka_review_recovery_archive_v1')[0].original.outbox[0].id,queue[0].id);
    await act(async()=>root.unmount());
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));await new Promise(resolve=>setTimeout(resolve,0));});
    assert.equal(app.products[0].currentStockKg,18);assert.equal(app.customers[0].balance,10);assert.equal(cloudflareSync.repository.current.cursor,3);
  }finally{cloudflareSync.stopAutoSync();if(root)await act(async()=>root.unmount());delete globalThis.window;delete globalThis.document;}
});

test('actual receiver admits a branch product after an orphan legacy invoice without partial balances', async () => {
  globalThis.localStorage=storage(); globalThis.sessionStorage=storage();
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false,locks:browserLocks}});
  Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener(){},removeEventListener(){},location:{origin:'https://test.invalid'}}});
  Object.defineProperty(globalThis,'document',{configurable:true,value:{addEventListener(){},removeEventListener(){},visibilityState:'hidden'}});
  const bundle=await build({stdin:{contents:"export {useAppStore} from './src/store/useAppStore.js'; export {cloudflareSync} from './src/services/cloudflareSync.js'; export {setSessionToken,setSessionUser} from './src/services/authSession.js';",resolveDir:process.cwd()},bundle:true,write:false,define:{'import.meta.env':'{}'},format:'cjs',platform:'node',packages:'external'});
  const loaded={exports:{}};
  new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
  const {useAppStore,cloudflareSync,setSessionToken,setSessionUser}=loaded.exports;
  let app,root;
  function Harness(){app=useAppStore();return null;}
  try {
    setSessionToken('test-session');
    setSessionUser({id:'u',tenantId:'A',role:'company_owner',branchId:'main',sessionExpiresAt:new Date(Date.now()+60000).toISOString()});
    seedAggregate(localStorage,{id:'u',tenantId:'A'},{products_v3:[],customers_v3:[{id:'c',balance:0}]});
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));await new Promise(resolve=>setTimeout(resolve,0));});
    const event=(id,type,payload)=>({id,tenantId:'A',branchId:'main',entityType:type,entityId:payload.id,action:'create',payload});
    const old=event('old-event','invoice',{id:'old',branchId:'main',customerId:'c',remainingDebt:15,items:[{productId:'missing',netWeight:3}]});
    const carrot=event('carrot-event','product',{id:'carrot',branchId:'main',name:'جزر',currentStockKg:10});
    await act(async()=>{cloudflareSync.updateHandler([old,carrot],2,{},true);});
    assert.equal(app.products.find(p=>p.id==='carrot').currentStockKg,10);
    assert.equal(app.invoices.length,0);
    assert.equal(app.customers[0].balance,0);
    assert.equal(app.inboundReview[0].events[0].id,'old-event');
    assert.throws(()=>app.saveInvoice({items:[]}),/الأرصدة غير مكتملة/);
    assert.throws(()=>app.getBackupSnapshot(),/نسخة احتياطية ناقصة/);
    assert.throws(()=>app.updateSettings({openingCashBalance:100}),/لم يُعدّل السجل غير المكتمل/);
    await act(async()=>{root.unmount();});
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));await new Promise(resolve=>setTimeout(resolve,0));});
    assert.equal(app.inboundReview.length,1);
    assert.equal(app.products[0].name,'جزر');
    await act(async()=>{cloudflareSync.updateHandler([event('missing-event','product',{id:'missing',branchId:'main',name:'بطاطا',currentStockKg:20})],3,{},true);});
    await act(async()=>{cloudflareSync.updateHandler([],3,{},true);});
    assert.equal(app.inboundReview.length,0);
    assert.equal(app.invoices.length,1);
    assert.equal(app.products.find(p=>p.id==='missing').currentStockKg,17);
    assert.equal(app.customers[0].balance,15);
  } finally {
    await act(async()=>{root?.unmount();}); cloudflareSync.stopAutoSync();
    delete globalThis.window; delete globalThis.document;
  }
});
const storage = () => ({ values:new Map(), getItem(k){return this.values.get(k) ?? null;}, setItem(k,v){this.values.set(k,String(v));}, removeItem(k){this.values.delete(k);},
  clear(){this.values.clear();},key(index){return [...this.values.keys()][index]??null;},get length(){return this.values.size;} });

test('actual store reconciles two offline credit invoices without duplicating stock or debt after restart', async () => {
  globalThis.localStorage=storage(); globalThis.sessionStorage=storage();
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false,locks:browserLocks}});
  Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener(){},removeEventListener(){},location:{origin:'https://test.invalid'}}});
  Object.defineProperty(globalThis,'document',{configurable:true,value:{addEventListener(){},removeEventListener(){},visibilityState:'hidden'}});
  const bundle=await build({stdin:{contents:"export {useAppStore} from './src/store/useAppStore.js'; export {cloudflareSync} from './src/services/cloudflareSync.js'; export {setSessionToken,setSessionUser} from './src/services/authSession.js';",resolveDir:process.cwd()},bundle:true,write:false,define:{'import.meta.env':'{}'},format:'cjs',platform:'node',packages:'external'});
  const loaded={exports:{}};
  new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
  const {useAppStore,cloudflareSync,setSessionToken,setSessionUser}=loaded.exports;
  let app, root;
  function Harness(){app=useAppStore();return null;}
  try {
    setSessionToken('test-session');
    setSessionUser({id:'rebase-u',tenantId:'A',role:'company_owner',branchId:'main',sessionExpiresAt:new Date(Date.now()+60000).toISOString()});
    seedAggregate(localStorage,{id:'rebase-u',tenantId:'A'},{
      branches_v1:[{id:'main',tenantId:'A',name:'Main',code:'M',isMain:true,status:'active'}],active_branch_id_v1:'main',
      products_v3:[{id:'p',name:'Tomato',currentStockKg:20,branchStock:{main:20}}],customers_v3:[{id:'c',balance:0}]
    });
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));await new Promise(resolve=>setTimeout(resolve,0));});
    const repository=cloudflareSync.repository;
    const heads={...repository.read('khodar_pos_sync_heads_v1')};
    await act(async()=>{app.saveInvoice({customerId:'c',remainingDebt:15,items:[{productId:'p',netWeight:3}],paymentMethod:'credit',finalTotal:15});});
    const queue=structuredClone(repository.current.outbox), cursor=repository.current.cursor;
    assert.equal(queue.length,1);
    const remote=attachConflictPreconditions({...queue[0],id:'other-device-sale',entityId:'other-invoice',
      payload:{...queue[0].payload,id:'other-invoice'}},heads);
    const proposal={protocol:'independent-sales-v1',acceptedIds:[],queue,cursor};
    await act(async()=>{cloudflareSync.updateHandler([remote],cursor+1,heads,true,proposal);});
    assert.equal(app.invoices.length,2);
    assert.equal(app.products[0].currentStockKg,14);
    assert.equal(app.products[0].branchStock.main,14);
    assert.equal(app.customers[0].balance,30);
    const pending=structuredClone(repository.current.outbox);
    assert.deepEqual(pending[0].payload,queue[0].payload);
    assert.equal(pending[0].preconditions['domain:inventory'],remote.id);
    attachConflictPreconditions(pending[0],heads);
    await act(async()=>{cloudflareSync.updateHandler([pending[0]],cursor+2,heads,true,
      {...proposal,queue:pending,cursor:cursor+1,acceptedIds:[pending[0].id]});});
    assert.equal(repository.current.outbox.length,0);
    await act(async()=>{root.unmount();});
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));await new Promise(resolve=>setTimeout(resolve,0));});
    assert.equal(app.invoices.length,2);
    assert.equal(app.products[0].currentStockKg,14);
    assert.equal(app.customers[0].balance,30);
  } finally {
    await act(async()=>{root?.unmount();}); cloudflareSync.stopAutoSync();
    delete globalThis.window; delete globalThis.document;
  }
});
test('receiving the same sale twice changes stock and debt exactly once', async () => {
  globalThis.localStorage=storage(); globalThis.sessionStorage=storage();
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false,locks:browserLocks}});
  Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener(){},removeEventListener(){},location:{origin:'https://test.invalid'}}});
  Object.defineProperty(globalThis,'document',{configurable:true,value:{addEventListener(){},removeEventListener(){},visibilityState:'hidden'}});
  const bundle=await build({stdin:{contents:"export {useAppStore} from './src/store/useAppStore.js'; export {cloudflareSync} from './src/services/cloudflareSync.js'; export {setSessionToken,setSessionUser} from './src/services/authSession.js';",resolveDir:process.cwd()},bundle:true,write:false,define:{'import.meta.env':'{}'},format:'cjs',platform:'node',packages:'external'});
  const loaded={exports:{}};
  new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
  const {useAppStore,cloudflareSync,setSessionToken,setSessionUser}=loaded.exports;
  let app,root;
  function Harness(){app=useAppStore();return null;}
  try {
    // Connect the real store receiver under a scoped offline session.
    setSessionToken('test-session');
    setSessionUser({id:'u',tenantId:'A',role:'company_owner',branchId:'main',sessionExpiresAt:new Date(Date.now()+60000).toISOString()});
    seedAggregate(localStorage,{id:'u',tenantId:'A'},{
      products_v3:[{id:'p',name:'Tomato',currentStockKg:20,branchStock:{main:20}}],
      customers_v3:[{id:'c',balance:0}]
    });
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));await new Promise(resolve=>setTimeout(resolve,0));});
    const serverHeads={};
    const event=attachConflictPreconditions({id:'sale-event',tenantId:'A',entityType:'invoice',entityId:'sale',action:'create',payload:{id:'sale',tenantId:'A',branchId:'main',customerId:'c',remainingDebt:15,items:[{productId:'p',netWeight:2},{productId:'p',netWeight:1}]}},serverHeads);
    await act(async()=>{cloudflareSync.updateHandler([event,event],1);});
    assert.throws(()=>cloudflareSync.updateHandler([event]),/Invalid sync cursor/);
    await act(async()=>{cloudflareSync.updateHandler([event],1);});
    assert.equal(app.invoices.length,1);
    assert.equal(app.products[0].currentStockKg,17);
    assert.equal(app.products[0].branchStock.main,17);
    assert.equal(app.customers[0].balance,15);
    // A restart uses persisted invoice identity, not just an in-memory event set.
    await act(async()=>{root.unmount();});
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));await new Promise(resolve=>setTimeout(resolve,0));});
    await act(async()=>{cloudflareSync.updateHandler([event],1);});
    assert.equal(app.products[0].currentStockKg,17);
    assert.equal(app.customers[0].balance,15);
    const voidEvent=attachConflictPreconditions({...event,id:'void-sale',action:'void',payload:{id:'sale',status:'voided'},preconditions:undefined,conflictPolicyVersion:undefined},serverHeads);
    await act(async()=>{cloudflareSync.updateHandler([voidEvent,voidEvent],2);});
    assert.equal(app.products[0].currentStockKg,20);
    assert.equal(app.products[0].branchStock.main,20);
    assert.equal(app.customers[0].balance,0);
    const deleteEvent=attachConflictPreconditions({...voidEvent,id:'delete-sale',action:'delete',preconditions:undefined,conflictPolicyVersion:undefined},serverHeads);
    await act(async()=>{cloudflareSync.updateHandler([deleteEvent],3);});
    assert.equal(app.products[0].currentStockKg,20);
    assert.equal(app.customers[0].balance,0);
    let posted, retried;
    await act(async()=>{
      const data={...event.payload,id:'offline-sale',idempotencyKey:'checkout-once',paymentMethod:'credit',finalTotal:15};
      posted=app.saveInvoice(data);
      retried=app.saveInvoice(data);
    });
    assert.equal(retried.id,posted.id);
    assert.equal(app.invoices.length,1);
    assert.equal(app.products[0].currentStockKg,17);
    assert.equal(app.customers[0].balance,15);
    await act(async()=>{cloudflareSync.updateHandler([{...event,entityId:posted.id,payload:posted}],3);});
    assert.equal(app.products[0].currentStockKg,17);
    assert.equal(app.customers[0].balance,15);
    await act(async()=>{app.voidInvoice(posted.id);app.voidInvoice(posted.id);});
    assert.equal(app.products[0].currentStockKg,20);
    assert.equal(app.customers[0].balance,0);
    const before=JSON.stringify(app.syncService.repository.value);
    const originalWrite=localStorage.setItem;
    localStorage.setItem=()=>{throw new Error('Injected quota failure');};
    await act(async()=>{
      assert.throws(()=>app.saveInvoice({...event.payload,id:'failed-sale',paymentMethod:'credit',finalTotal:15}),/quota/);
    });
    assert.equal(JSON.stringify(app.syncService.repository.value),before);
    assert.equal(app.products[0].currentStockKg,20);
    assert.equal(app.customers[0].balance,0);
    assert.equal(app.invoices.some(row=>row.id==='failed-sale'),false);
    localStorage.setItem=originalWrite;
    await act(async()=>{root.unmount();});
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));await new Promise(resolve=>setTimeout(resolve,0));});
    assert.equal(app.products[0].currentStockKg,20);
    assert.equal(app.customers[0].balance,0);
    assert.equal(app.invoices.some(row=>row.id==='failed-sale'),false);
  } finally {
    await act(async()=>{root?.unmount();});
    cloudflareSync.stopAutoSync();
    delete globalThis.window; delete globalThis.document;
  }
});
