import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AtomicStore } from '../src/services/atomicStore.js';
import { scopedStorageKey } from '../src/services/tenantStorage.js';
import { verifyCloudCheckpoint, verifyServerBranches } from '../src/services/legacyMigrationAudit.js';
import { createLiquiditySourceAudit } from '../src/services/liquidityMigrationAudit.js';
import { acquireWithCheckedLegacyMigration } from '../src/services/checkedLegacyMigration.js';
import { attachConflictPreconditions, SYNC_HEADS_STATE_KEY } from '../src/services/syncConflictPolicy.js';

// Only the Storage API is a fault-injection harness. The transaction engine and
// Node's native Web Locks are real; browser kill/reopen is a separate release gate.
const storage = () => ({ values: new Map(), getItem(key) { return this.values.get(key) ?? null; },
  setItem(key,value) { this.values.set(key,String(value)); },
  removeItem(key) { this.values.delete(key); }, clear() { this.values.clear(); },
  key(index) { return [...this.values.keys()][index] ?? null; },
  get length() { return this.values.size; } });
const user = () => ({ id:crypto.randomUUID(),tenantId:'test-tenant' });
const initial = { invoices:[], stock:20, debt:0 };

test('resilient receive retains a failed whole group while admitting new reference records and retries once', async () => {
  const identity = user(), backend = storage();
  const store = new AtomicStore(identity, { records: [] }, backend);
  await store.acquire();
  const evt = (id, type, groupId) => ({ id, tenantId: identity.tenantId, entityId:id,
    entityType:type, action:'create', payload:{id}, groupId });
  const batch = [evt('old','invoice','old-group'), evt('linked','expense','old-group'), evt('carrot','product','new-group')];
  const apply = events => { for (const e of events) {
    store.set('records', rows => [...rows,e.id]);
    if (e.id === 'old' && !store.read('records').includes('dependency')) throw Object.assign(Error('missing dependency'),{code:'MISSING_DEPENDENCY'});
  } };
  try {
    store.receiveResilient(batch, 3, apply);
    assert.deepEqual(store.read('records'), ['carrot']);
    assert.equal(store.value.cursor, 3);
    assert.equal(store.value.applied.old, undefined);
    assert.deepEqual(store.read('braka_inbound_review_v1')[0].events, batch.slice(0,2));
    const reopened = new AtomicStore(identity, {}, backend);
    assert.equal(reopened.read('braka_inbound_review_v1').length,1);
    const before = JSON.stringify(store.value), write = backend.setItem;
    backend.setItem = () => { throw Error('quota'); };
    assert.throws(() => store.receiveResilient([evt('dependency','product')],4,apply),/quota/);
    assert.equal(JSON.stringify(store.value),before);
    backend.setItem=write;
    store.receiveResilient([evt('dependency','product')],4,apply);
    store.receiveResilient([],4,apply);
    assert.deepEqual(store.read('records'),['carrot','dependency','old','linked']);
    assert.equal(store.read('braka_inbound_review_v1').length,0);
    store.receiveResilient([],4,apply);
    assert.equal(store.read('records').length,4);
    assert.throws(() => store.receiveResilient([{...evt('foreign','product'),tenantId:'foreign'}],5,apply),/tenant/);
  } finally { await store.close(); }
});

test('durable resilient receipt cannot advance past an orphan unless its retention is committed', async () => {
  const identity=user(),backend=storage(),store=new AtomicStore(identity,{records:[]},backend);
  await store.acquire();
  const old={id:'old',tenantId:identity.tenantId,entityId:'old',entityType:'invoice',action:'create',payload:{id:'old'}};
  const apply=()=>{store.set('records',['partial']);throw Object.assign(Error('missing'),{code:'MISSING_DEPENDENCY'});};
  const before=JSON.stringify(store.value);
  try {
    store.durable={commit:async()=>{throw Error('quota');}};
    await assert.rejects(store.receiveResilientDurable([old],1,apply),/quota/);
    assert.equal(JSON.stringify(store.value),before);
    let acknowledge;
    store.durable={commit:(_key,value)=>new Promise(resolve=>{acknowledge=()=>resolve(value);})};
    const pending=store.receiveResilientDurable([old],1,apply);
    assert.equal(store.value.cursor,0);
    acknowledge();await pending;
    assert.equal(store.value.cursor,1);
    assert.deepEqual(store.read('records'),[]);
    assert.deepEqual(store.read('braka_inbound_review_v1')[0].events,[old]);
    assert.equal(store.value.applied.old,undefined);
  } finally {await store.close();}
});
const migrationState = identity => ({...initial,khodar_pos_branches_v1:[{
  id:'main',tenantId:identity.tenantId,name:'Main',code:'M',isMain:true,status:'active'
}],khodar_pos_active_branch_id_v1:'main'});
const branchManifest = snapshot => ({success:true,tenantId:snapshot.identity.tenantId,fullTenantVisibility:true,
  latestSequence:snapshot.cursor,branches:structuredClone(snapshot.state.khodar_pos_branches_v1)});
const event = identity => ({ id:'sale-event',tenantId:identity.tenantId,entityId:'sale',entityType:'invoice',action:'create',payload:{id:'sale'} });
const post = (store, phase) => store.transact(() => {
  store.set('invoices',[{id:'sale'}]); if(phase===1) throw new Error('Injected stop');
  store.set('stock',17); if(phase===2) throw new Error('Injected stop');
  store.set('debt',15); if(phase===3) throw new Error('Injected stop');
  store.enqueue(event(store.user)); if(phase===4) throw new Error('Injected stop');
});

test('sale reconciliation atomically preserves local effects, reorders pending metadata and survives quota failure', async () => {
  const identity = user(), backend = storage();
  const store = new AtomicStore(identity, { marker: 0, [SYNC_HEADS_STATE_KEY]: {} }, backend);
  await store.acquire();
  try {
    const sale = id => ({ id, tenantId: identity.tenantId, branchId: 'main', entityId: id,
      entityType: 'invoice', action: 'create', payload: { id, branchId: 'main', status: 'active', items: [] } });
    store.transact(() => { store.set('marker', 1); store.enqueue(sale('local')); });
    const queue = structuredClone(store.current.outbox), cursor = store.current.cursor;
    const heads = {}, remote = attachConflictPreconditions(sale('remote'), heads);
    const proposal = { protocol: 'independent-sales-v1', acceptedIds: [], queue, cursor };
    const before = JSON.stringify(store.current);
    const write = backend.setItem;
    backend.setItem = () => { throw Error('quota'); };
    assert.throws(() => store.reconcileSales([remote], 1, () => store.set('marker', 2), heads, proposal), /quota/);
    assert.equal(JSON.stringify(store.current), before);
    backend.setItem = write;
    store.reconcileSales([remote], 1, () => store.set('marker', 2), heads, proposal);
    assert.equal(store.read('marker'), 2);
    assert.equal(store.current.cursor, 1);
    assert.deepEqual(store.current.outbox[0].payload, queue[0].payload);
    assert.equal(store.current.outbox[0].preconditions['domain:inventory'], 'remote');
    assert.throws(() => store.reconcileSales([remote], 1, () => {}, heads, proposal), /changed/);
    const pending = structuredClone(store.current.outbox);
    const acceptedHeads = { ...heads };
    attachConflictPreconditions(pending[0], acceptedHeads);
    store.reconcileSales([pending[0]], 2, () => { throw Error('duplicate effects'); }, acceptedHeads,
      { ...proposal, queue: pending, cursor: 1, acceptedIds: ['local'] });
    assert.equal(store.current.outbox.length, 0);
    assert.equal(store.read('marker'), 2);
  } finally { await store.close(); }
});

test('partial branch visibility accepts authorized events after hidden causal gaps and adopts server heads', async () => {
  const identity = user(), backend = storage();
  const store = new AtomicStore(identity, { marker: 0, [SYNC_HEADS_STATE_KEY]: {} }, backend);
  await store.acquire();
  try {
    const heads = { 'domain:inventory': 'hidden-other-branch-event' };
    const visible = attachConflictPreconditions({ id: 'visible-product-event', tenantId: identity.tenantId,
      entityType: 'product', entityId: 'branch-product', action: 'update',
      payload: { id: 'branch-product', branchId: 'assigned' } }, heads);
    assert.throws(() => store.receive([visible], 2, () => store.set('marker', 1), heads), /تعارض سببي/);
    assert.equal(store.read('marker'), 0);
    store.receive([visible], 2, () => store.set('marker', 1), heads, true);
    assert.equal(store.read('marker'), 1);
    assert.deepEqual(store.read(SYNC_HEADS_STATE_KEY), heads);
    const saved = JSON.stringify(store.value);
    store.receive([visible], 2, () => { throw Error('duplicate applied twice'); }, heads, true);
    assert.equal(JSON.stringify(store.value), saved);
  } finally { await store.close(); }
});

test('default durable acquire migrates an existing aggregate only after cloud and branch checks',async()=>{
  const backend=storage(),identity=user(),legacy=new AtomicStore(identity,migrationState(identity),backend);
  await legacy.acquire();
  legacy.receive([{id:'known',tenantId:identity.tenantId}],5,()=>legacy.set('debt',13));
  const sourceRaw=backend.getItem(legacy.key),snapshot=structuredClone(legacy.value);
  await legacy.close();
  const rows=new Map(),durable={
    async read(key){return structuredClone(rows.get(key)??null);},
    async adoptIfEmpty(key,value){if(rows.has(key)) throw Error('destination exists');rows.set(key,structuredClone(value));return structuredClone(value);},
    async commit(key,value){rows.set(key,structuredClone(value));return structuredClone(value);}
  };
  const destination=new AtomicStore(identity,migrationState(identity),backend,{durableFirst:true});
  const page={success:true,fullTenantVisibility:true,events:[{id:'known',tenantId:identity.tenantId,sequence:5}],nextCursor:5,hasMore:false};
  try {
    assert.equal(await acquireWithCheckedLegacyMigration({store:destination,durable,
      createLegacyStore:()=>new AtomicStore(identity,migrationState(identity),backend),
      fetchPage:async()=>page,fetchBranches:async()=>branchManifest(snapshot)}),true);
    assert.equal(destination.durable,durable);
    assert.equal(destination.read('debt'),13);
    assert.deepEqual(destination.value.outbox,[]);
    assert.equal(backend.getItem(destination.key),sourceRaw);
  } finally {await destination.close();}

  const secondBackend=storage(),old=new AtomicStore(identity,migrationState(identity),secondBackend);
  await old.acquire();const rejectedRaw=secondBackend.getItem(old.key);await old.close();
  const rejectedRows=new Map(),rejectedDurable={
    async read(key){return structuredClone(rejectedRows.get(key)??null);},
    async adoptIfEmpty(key,value){rejectedRows.set(key,structuredClone(value));return structuredClone(value);}
  };
  const rejected=new AtomicStore(identity,migrationState(identity),secondBackend,{durableFirst:true});
  try {
    await assert.rejects(acquireWithCheckedLegacyMigration({store:rejected,durable:rejectedDurable,
      createLegacyStore:()=>new AtomicStore(identity,migrationState(identity),secondBackend),
      fetchPage:async()=>({success:true,fullTenantVisibility:false,events:[],nextCursor:0,hasMore:false}),
      fetchBranches:async()=>branchManifest(old.value)}),/كامل سجل مزامنة الشركة/);
    assert.equal(rejectedRows.size,0);
    assert.equal(secondBackend.getItem(rejected.key),rejectedRaw);
  } finally {await rejected.close();}
});

test('liquidity migration verifies every cash/bank source, opening float, void and deletion',()=>{
  const audit=createLiquiditySourceAudit(),state={khodar_pos_settings_v3:{openingCashDrawerFloat:100}};
  /** @type {Array<[string, string, Record<string, unknown>, string]>} */
  const sources=[
    ['invoice','invoices',{status:'active',saleType:'split',cashAmount:10,bankAmount:5},'cashAmount'],
    ['purchase','purchases',{paidCashAmount:3,paidBankAmount:4},'paidBankAmount'],
    ['customer_payment','customer_payments',{method:'cash',amount:2},'amount'],
    ['supplier_payment','supplier_payments',{paymentMethod:'bank',amount:1},'amount'],
    ['expense','expenses',{paymentMethod:'cash',amount:1,isSupplierPayment:false,isWorkerPayment:false},'amount'],
    ['worker_transaction','worker_transactions',{type:'salary_payment',paymentMethod:'bank',amount:7},'amount'],
    ['partner_drawing','partner_drawings',{method:'cash',amount:4},'amount'],
    ['profit_distribution','profit_distributions',{shares:[{partnerId:'partner',method:'bank',netPayout:6}]},'shares'],
    ['sales_return','sales_returns',{refundMethod:'cash',totalRefundAmount:2},'totalRefundAmount'],
    ['purchase_return','purchase_returns',{refundMethod:'bank',totalRefundAmount:1},'totalRefundAmount']
  ];
  audit.apply({entityType:'settings',action:'update',payload:{openingCashDrawerFloat:100}});
  for(const [type,slice,data] of sources){
    const row={id:type,...data};state[`khodar_pos_${slice}_v3`]=[row];
    audit.apply({entityType:type,entityId:type,action:'create',payload:row});
  }
  assert.deepEqual(audit.verify({state}),{verifiedLiquidityRecords:10,verifiedOpeningCash:100});
  for(const [,slice,,field] of sources){
    const bad=structuredClone(state);
    bad[`khodar_pos_${slice}_v3`][0][field]=field==='shares' ? [{method:'cash',netPayout:6}] : 999;
    assert.throws(()=>audit.verify({state:bad}),/مصدر النقد أو البنك/);
    delete bad[`khodar_pos_${slice}_v3`];
    assert.throws(()=>audit.verify({state:bad}),/مصدر سيولة محلي مفقود/);
  }
  const wrongMethod=structuredClone(state);
  wrongMethod.khodar_pos_customer_payments_v3[0].method='bank';
  assert.throws(()=>audit.verify({state:wrongMethod}),/مصدر النقد أو البنك/);
  assert.throws(()=>audit.verify({state:{...state,khodar_pos_settings_v3:{openingCashDrawerFloat:101}}}),/عهدة افتتاحية/);
  audit.apply({entityType:'invoice',entityId:'invoice',action:'void',payload:{id:'invoice'}});
  assert.throws(()=>audit.verify({state}),/مصدر النقد أو البنك/);
  state.khodar_pos_invoices_v3=[{...state.khodar_pos_invoices_v3[0],status:'voided'}];
  audit.apply({entityType:'partner_drawing',entityId:'partner_drawing',action:'delete',payload:{id:'partner_drawing'}});
  assert.throws(()=>audit.verify({state}),/مصدر النقد أو البنك/);
  state.khodar_pos_partner_drawings_v3=[];
  assert.equal(audit.verify({state}).verifiedLiquidityRecords,9);
  state.khodar_pos_partner_drawings_v3=[{id:'extra',amount:1}];
  assert.throws(()=>audit.verify({state}),/مصدر النقد أو البنك/);
  assert.throws(()=>createLiquiditySourceAudit().verify({state:{khodar_pos_settings_v3:{openingCashDrawerFloat:1}}}),/عهدة افتتاحية/);
});

test('financial state cannot commit without a matching outbox or inbound provenance',async()=>{
  const backend=storage(),identity=user(),key='khodar_pos_products_v3';
  const store=new AtomicStore(identity,{[key]:[{id:'p',currentStockKg:4}]},backend);
  await store.acquire();
  try {
    const original=backend.getItem(store.key);
    assert.throws(()=>store.transact(()=>store.set(key,[{id:'p',currentStockKg:3}])),/بلا حدث مزامنة/);
    assert.equal(backend.getItem(store.key),original);
    assert.equal(store.read(key)[0].currentStockKg,4);
    let committed=false;
    await assert.rejects(store.transactDurable(()=>store.set(key,[{id:'p',currentStockKg:3}]),
      {commit:async()=>{committed=true;}}),/بلا حدث مزامنة/);
    assert.equal(committed,false);
    assert.throws(()=>store.transact(()=>{
      store.set(key,[{id:'p',currentStockKg:3}]);
      store.enqueue({id:'unrelated-expense',tenantId:identity.tenantId,entityType:'expense',entityId:'e',action:'create',payload:{id:'e'}});
    }),/بلا حدث مزامنة مرتبط/);
    assert.equal(store.value.outbox.length,0);
    store.transact(()=>{
      store.set(key,[{id:'p',currentStockKg:3}]);
      store.enqueue({id:'stock-event',tenantId:identity.tenantId,entityType:'product',entityId:'p',action:'update',payload:{id:'p',currentStockKg:3}});
    });
    assert.equal(store.read(key)[0].currentStockKg,3);
    const beforeInbound=backend.getItem(store.key);
    const inboundStock={id:'server-stock',tenantId:identity.tenantId,entityType:'product',entityId:'p',
      action:'update',payload:{currentStockKg:2}};
    assert.throws(()=>store.receive([inboundStock],0,
      ()=>store.set(key,[{id:'p',currentStockKg:2}])),/newer sync cursor/);
    assert.equal(backend.getItem(store.key),beforeInbound);
    store.receive([inboundStock],1,()=>store.set(key,[{id:'p',currentStockKg:2}]));
    assert.equal(store.read(key)[0].currentStockKg,2);
    const reopened=new AtomicStore(identity,{},backend);
    assert.equal(reopened.read(key)[0].currentStockKg,2);
    assert.deepEqual(reopened.value.outbox.map(item=>item.id),['stock-event']);
    assert.equal(reopened.value.cursor,1);
  } finally {await store.close();}
});

test('create event identity must match its financial record before local or inbound commit',async()=>{
  const backend=storage(),identity=user(),key='khodar_pos_products_v3';
  const store=new AtomicStore(identity,{[key]:[]},backend);
  await store.acquire();
  try {
    const original=backend.getItem(store.key);
    const mismatched={id:'bad-create',tenantId:identity.tenantId,entityType:'product',
      entityId:'claimed-product',action:'create',payload:{id:'different-product',currentStockKg:1}};
    assert.throws(()=>store.transact(()=>{
      store.set(key,[mismatched.payload]);
      store.enqueue(mismatched);
    }),/identity mismatch/);
    assert.throws(()=>store.receive([mismatched],1,()=>store.set(key,[mismatched.payload])),/identity mismatch/);
    assert.equal(backend.getItem(store.key),original);
    assert.equal(store.value.cursor,0);
  } finally {await store.close();}
});

test('a same-type event for another invoice cannot authorize a financial record change',async()=>{
  const backend=storage(),identity=user(),key='khodar_pos_invoices_v3';
  const store=new AtomicStore(identity,{[key]:[{id:'sale-1',total:10}]},backend);
  await store.acquire();
  try {
    const original=backend.getItem(store.key);
    const unrelated={id:'unrelated-sale-event',tenantId:identity.tenantId,entityType:'invoice',
      entityId:'sale-other',action:'update',payload:{id:'sale-other',total:11}};
    const mutate=()=>{
      store.set(key,[{id:'sale-1',total:11}]);
      store.enqueue(unrelated);
    };
    assert.throws(()=>store.transact(mutate),/بلا حدث يطابق معرّفه/);
    let committed=false;
    await assert.rejects(store.transactDurable(mutate,{commit:async()=>{committed=true;}}),/بلا حدث يطابق معرّفه/);
    assert.equal(committed,false);
    assert.equal(backend.getItem(store.key),original);
    assert.equal(store.read(key)[0].total,10);
    assert.deepEqual(store.value.outbox,[]);
    assert.throws(()=>store.transact(()=>{
      store.set(key,[{id:'sale-1',total:11}]);
      store.enqueue({...unrelated,id:'wrong-amount-event',entityId:'sale-1',payload:{id:'sale-1',total:12}});
    }),/بلا حدث يطابق معرّفه/);
    assert.equal(backend.getItem(store.key),original);
    store.transact(()=>{
      store.set(key,[{id:'sale-1',total:11}]);
      store.enqueue({...unrelated,id:'correct-sale-event',entityId:'sale-1',payload:{id:'sale-1',total:11}});
    });
    assert.equal(store.read(key)[0].total,11);
  } finally {await store.close();}
});

test('a return event cannot authorize an incorrect invoice return balance',async()=>{
  const backend=storage(),identity=user(),invoiceKey='khodar_pos_invoices_v3',returnKey='khodar_pos_sales_returns_v3';
  const invoice={id:'sale-1',items:[{productId:'p',netWeight:2,pricePerKg:5}]};
  const returned={id:'return-1',invoiceId:invoice.id,refundMethod:'cash',inventoryAction:'restock',
    totalRefundAmount:5,items:[{productId:'p',sourceLineIndex:0,returnedWeight:1}]};
  const updated={...invoice,items:[{...invoice.items[0],returnedWeight:1}],hasReturns:true,
    totalReturnedAmount:5,totalReturnedWeight:1};
  const returnEvent={id:'return-event',tenantId:identity.tenantId,entityType:'sales_return',
    entityId:returned.id,action:'create',payload:returned};
  const store=new AtomicStore(identity,{[invoiceKey]:[invoice],[returnKey]:[]},backend);
  await store.acquire();
  try {
    const original=backend.getItem(store.key);
    assert.throws(()=>store.transact(()=>{
      store.set(returnKey,[returned]);
      store.set(invoiceKey,[{...updated,totalReturnedAmount:4}]);
      store.enqueue(returnEvent);
    }),/بلا حدث يطابق معرّفه/);
    assert.equal(backend.getItem(store.key),original);
    assert.deepEqual(store.read(returnKey),[]);
    store.transact(()=>{
      store.set(returnKey,[returned]);
      store.set(invoiceKey,[updated]);
      store.enqueue(returnEvent);
    });
    assert.deepEqual(store.read(invoiceKey),[updated]);
    assert.deepEqual(store.value.outbox.map(item=>item.id),['return-event']);
  } finally {await store.close();}
});

test('a purchase return event cannot authorize an incorrect purchase quantity',async()=>{
  const backend=storage(),identity=user(),purchaseKey='khodar_pos_purchases_v3',returnKey='khodar_pos_purchase_returns_v3';
  const purchase={id:'purchase-1',productId:'p',supplierId:'s',quantityKg:10,costPerKg:2};
  const returned={id:'return-1',purchaseId:purchase.id,productId:'p',supplierId:'s',returnedKg:2,
    totalRefundAmount:4,refundMethod:'cash'};
  const updated={...purchase,returnedKg:2,totalReturnedAmount:4,hasReturns:true};
  const returnEvent={id:'purchase-return-event',tenantId:identity.tenantId,entityType:'purchase_return',
    entityId:returned.id,action:'create',payload:returned};
  const store=new AtomicStore(identity,{[purchaseKey]:[purchase],[returnKey]:[]},backend);
  await store.acquire();
  try {
    const original=backend.getItem(store.key);
    assert.throws(()=>store.transact(()=>{
      store.set(returnKey,[returned]);
      store.set(purchaseKey,[{...updated,returnedKg:1}]);
      store.enqueue(returnEvent);
    }),/بلا حدث يطابق معرّفه/);
    assert.equal(backend.getItem(store.key),original);
    store.transact(()=>{
      store.set(returnKey,[returned]);
      store.set(purchaseKey,[updated]);
      store.enqueue(returnEvent);
    });
    assert.deepEqual(store.read(purchaseKey),[updated]);
  } finally {await store.close();}
});

test('invoice event and inventory quantity must commit with the same stock effect',async()=>{
  const backend=storage(),identity=user(),productKey='khodar_pos_products_v3',invoiceKey='khodar_pos_invoices_v3';
  const product={id:'p',name:'Tomato',currentStockKg:10,branchStock:{main:10}};
  const invoice={id:'sale-1',branchId:'main',status:'active',items:[{productId:'p',netWeight:2}]};
  const saleEvent={id:'sale-quantity-event',tenantId:identity.tenantId,entityType:'invoice',
    entityId:invoice.id,action:'create',payload:invoice};
  const store=new AtomicStore(identity,{[productKey]:[product],[invoiceKey]:[]},backend);
  await store.acquire();
  try {
    const original=backend.getItem(store.key);
    const wrong=()=>{
      store.set(invoiceKey,[invoice]);
      store.set(productKey,[{...product,currentStockKg:9,branchStock:{main:9}}]);
      store.enqueue(saleEvent);
    };
    assert.throws(()=>store.transact(wrong),/مخزون المنتجات لا يطابق/);
    let durableCalled=false;
    await assert.rejects(store.transactDurable(wrong,{commit:async()=>{durableCalled=true;}}),/مخزون المنتجات لا يطابق/);
    assert.equal(durableCalled,false);
    assert.equal(backend.getItem(store.key),original);
    store.transact(()=>{
      store.set(invoiceKey,[invoice]);
      store.set(productKey,[{...product,currentStockKg:8,branchStock:{main:8}}]);
      store.enqueue(saleEvent);
    });
    assert.equal(store.read(productKey)[0].currentStockKg,8);
  } finally {await store.close();}
});

test('invoice and sales return in one commit must produce their combined stock effect',async()=>{
  const backend=storage(),identity=user();
  const productKey='khodar_pos_products_v3',invoiceKey='khodar_pos_invoices_v3',returnKey='khodar_pos_sales_returns_v3';
  const product={id:'p',name:'Tomato',currentStockKg:10,branchStock:{main:10}};
  const invoice={id:'sale-1',branchId:'main',status:'active',items:[{productId:'p',netWeight:2,pricePerKg:5}]};
  const returned={id:'return-1',invoiceId:invoice.id,refundMethod:'cash',inventoryAction:'restock',
    totalRefundAmount:5,items:[{productId:'p',sourceLineIndex:0,returnedWeight:1}]};
  const afterInvoice={...invoice,items:[{...invoice.items[0],returnedWeight:1}],hasReturns:true,
    totalReturnedAmount:5,totalReturnedWeight:1};
  const store=new AtomicStore(identity,{[productKey]:[product],[invoiceKey]:[],[returnKey]:[]},backend);
  await store.acquire();
  try {
    const original=backend.getItem(store.key);
    const post=stock=>store.transact(()=>{
      store.set(invoiceKey,[afterInvoice]);
      store.set(returnKey,[returned]);
      store.set(productKey,[{...product,currentStockKg:stock,branchStock:{main:stock}}]);
      store.enqueue({id:'sale-event',tenantId:identity.tenantId,entityType:'invoice',
        entityId:invoice.id,action:'create',payload:invoice});
      store.enqueue({id:'return-event',tenantId:identity.tenantId,entityType:'sales_return',
        entityId:returned.id,action:'create',payload:returned});
    });
    assert.throws(()=>post(8),/مخزون المنتجات لا يطابق/);
    assert.equal(backend.getItem(store.key),original);
    post(9);
    assert.equal(store.read(productKey)[0].currentStockKg,9);
    assert.deepEqual(store.value.outbox.map(event=>event.id),['sale-event','return-event']);
  } finally {await store.close();}
});

test('purchase and purchase return in one commit must preserve weighted stock cost',async()=>{
  const backend=storage(),identity=user();
  const productKey='khodar_pos_products_v3',purchaseKey='khodar_pos_purchases_v3',returnKey='khodar_pos_purchase_returns_v3';
  const product={id:'p',name:'Tomato',currentStockKg:10,branchStock:{main:10},costPerKg:2};
  const purchase={id:'purchase-1',productId:'p',productName:'Tomato',branchId:'main',quantityKg:5,costPerKg:4};
  const returned={id:'return-1',purchaseId:purchase.id,productId:'p',returnedKg:2,
    totalRefundAmount:8,refundMethod:'cash'};
  const afterPurchase={...purchase,returnedKg:2,totalReturnedAmount:8,hasReturns:true};
  const store=new AtomicStore(identity,{[productKey]:[product],[purchaseKey]:[],[returnKey]:[]},backend);
  await store.acquire();
  try {
    const original=backend.getItem(store.key);
    const post=cost=>store.transact(()=>{
      store.set(purchaseKey,[afterPurchase]);
      store.set(returnKey,[returned]);
      store.set(productKey,[{...product,currentStockKg:13,branchStock:{main:13},costPerKg:cost,lastPurchasePrice:4}]);
      store.enqueue({id:'purchase-event',tenantId:identity.tenantId,entityType:'purchase',
        entityId:purchase.id,action:'create',payload:purchase});
      store.enqueue({id:'return-event',tenantId:identity.tenantId,entityType:'purchase_return',
        entityId:returned.id,action:'create',payload:returned});
    });
    assert.throws(()=>post(2.5),/مخزون المنتجات لا يطابق/);
    assert.equal(backend.getItem(store.key),original);
    post(2.47);
    assert.equal(store.read(productKey)[0].costPerKg,2.47);
    assert.deepEqual(store.value.outbox.map(event=>event.id),['purchase-event','return-event']);
  } finally {await store.close();}
});

test('damage and branch transfer events cannot authorize incorrect stock effects',async()=>{
  const backend=storage(),identity=user();
  const productKey='khodar_pos_products_v3',damageKey='khodar_pos_damaged_v3',transferKey='khodar_pos_stock_transfers_v1';
  const product={id:'p',name:'Tomato',currentStockKg:10,branchStock:{main:8,other:2},costPerKg:2};
  const damage={id:'damage-1',productId:'p',branchId:'main',quantityKg:1,costPerKg:2,totalLoss:2};
  const transfer={id:'transfer-1',productId:'p',fromBranchId:'main',toBranchId:'other',quantityKg:2};
  const store=new AtomicStore(identity,{[productKey]:[product],[damageKey]:[],[transferKey]:[],
    khodar_pos_branches_v1:[{id:'main',isMain:true},{id:'other',isMain:false}]},backend);
  await store.acquire();
  try {
    const original=backend.getItem(store.key);
    const post=(stock,main)=>store.transact(()=>{
      store.set(damageKey,[damage]);
      store.set(transferKey,[transfer]);
      store.set(productKey,[{...product,currentStockKg:stock,branchStock:{main,other:4}}]);
      store.enqueue({id:'damage-event',tenantId:identity.tenantId,entityType:'damaged_item',
        entityId:damage.id,action:'create',payload:damage});
      store.enqueue({id:'transfer-event',tenantId:identity.tenantId,entityType:'stock_transfer',
        entityId:transfer.id,action:'create',payload:transfer});
    });
    assert.throws(()=>post(8,5),/مخزون المنتجات لا يطابق/);
    assert.equal(backend.getItem(store.key),original);
    post(9,5);
    assert.deepEqual(store.read(productKey)[0].branchStock,{main:5,other:4});
  } finally {await store.close();}
});

test('purchase-seeded inventory requires its product-create event in the same commit',async()=>{
  const backend=storage(),identity=user(),productKey='khodar_pos_products_v3',purchaseKey='khodar_pos_purchases_v3';
  const product={id:'p',name:'Tomato',currentStockKg:5,branchStock:{main:5},costPerKg:4};
  const purchase={id:'purchase-1',productId:'p',productName:'Tomato',branchId:'main',quantityKg:5,
    costPerKg:4,inventorySeededWithPurchase:true};
  const store=new AtomicStore(identity,{[productKey]:[],[purchaseKey]:[]},backend);
  await store.acquire();
  try {
    const original=backend.getItem(store.key);
    assert.throws(()=>store.transact(()=>{
      store.set(productKey,[product]);
      store.set(purchaseKey,[purchase]);
      store.enqueue({id:'purchase-event',tenantId:identity.tenantId,entityType:'purchase',
        entityId:purchase.id,action:'create',payload:purchase});
    }),/بلا حدث إنشاء صنف مرتبط/);
    assert.equal(backend.getItem(store.key),original);
    store.transact(()=>{
      store.set(productKey,[product]);
      store.set(purchaseKey,[purchase]);
      store.enqueue({id:'product-event',tenantId:identity.tenantId,entityType:'product',
        entityId:product.id,action:'create',payload:product});
      store.enqueue({id:'purchase-event',tenantId:identity.tenantId,entityType:'purchase',
        entityId:purchase.id,action:'create',payload:purchase});
    });
    assert.deepEqual(store.value.outbox.map(event=>event.id),['product-event','purchase-event']);
  } finally {await store.close();}
});

test('credit invoice cannot commit a mismatched customer receivable',async()=>{
  const backend=storage(),identity=user(),customerKey='khodar_pos_customers_v3',invoiceKey='khodar_pos_invoices_v3';
  const customer={id:'c',name:'Customer',balance:10};
  const invoice={id:'sale-1',customerId:'c',remainingDebt:5,status:'active',items:[]};
  const store=new AtomicStore(identity,{[customerKey]:[customer],[invoiceKey]:[]},backend);
  await store.acquire();
  try {
    const original=backend.getItem(store.key);
    const post=balance=>store.transact(()=>{
      store.set(customerKey,[{...customer,balance}]);
      store.set(invoiceKey,[invoice]);
      store.enqueue({id:'credit-sale-event',tenantId:identity.tenantId,entityType:'invoice',
        entityId:invoice.id,action:'create',payload:invoice});
    });
    assert.throws(()=>post(14),/رصيد العملاء لا يطابق/);
    assert.equal(backend.getItem(store.key),original);
    post(15);
    assert.equal(store.read(customerKey)[0].balance,15);
  } finally {await store.close();}
});

test('credit purchase cannot commit a mismatched supplier payable',async()=>{
  const backend=storage(),identity=user(),supplierKey='khodar_pos_suppliers_v3',purchaseKey='khodar_pos_purchases_v3';
  const supplier={id:'s',name:'Supplier',balance:10};
  const purchase={id:'purchase-1',supplierId:'s',creditAmount:5,quantityKg:1,costPerKg:5};
  const store=new AtomicStore(identity,{[supplierKey]:[supplier],[purchaseKey]:[]},backend);
  await store.acquire();
  try {
    const original=backend.getItem(store.key);
    const post=balance=>store.transact(()=>{
      store.set(supplierKey,[{...supplier,balance}]);
      store.set(purchaseKey,[purchase]);
      store.enqueue({id:'credit-purchase-event',tenantId:identity.tenantId,entityType:'purchase',
        entityId:purchase.id,action:'create',payload:purchase});
    });
    assert.throws(()=>post(14),/رصيد الموردين لا يطابق/);
    assert.equal(backend.getItem(store.key),original);
    post(15);
    assert.equal(store.read(supplierKey)[0].balance,15);
  } finally {await store.close();}
});

test('worker advance cannot commit a mismatched receivable balance',async()=>{
  const backend=storage(),identity=user(),workerKey='khodar_pos_workers_v3',transactionKey='khodar_pos_worker_transactions_v3';
  const worker={id:'w',name:'Worker',currentAdvance:10};
  const transaction={id:'advance-1',workerId:'w',type:'advance',amount:5};
  const store=new AtomicStore(identity,{[workerKey]:[worker],[transactionKey]:[]},backend);
  await store.acquire();
  try {
    const original=backend.getItem(store.key);
    const post=balance=>store.transact(()=>{
      store.set(workerKey,[{...worker,currentAdvance:balance}]);
      store.set(transactionKey,[transaction]);
      store.enqueue({id:'advance-event',tenantId:identity.tenantId,entityType:'worker_transaction',
        entityId:transaction.id,action:'create',payload:transaction});
    });
    assert.throws(()=>post(14),/رصيد سلف العامل لا يطابق/);
    assert.equal(backend.getItem(store.key),original);
    post(15);
    assert.equal(store.read(workerKey)[0].currentAdvance,15);
  } finally {await store.close();}
});

for(const phase of [1,2,3,4]) test(`interruption at precommit boundary ${phase} leaves no partial state or orphan queue`, async()=>{
  const backend=storage(),identity=user(),store=new AtomicStore(identity,initial,backend);
  await store.acquire();
  try {
    const before=backend.getItem(store.key);
    assert.throws(()=>post(store,phase),/Injected/);
    assert.equal(backend.getItem(store.key),before);
    const reopened=new AtomicStore(identity,{},backend);
    assert.deepEqual(reopened.value.state,initial);
    assert.deepEqual(reopened.value.outbox,[]);
  } finally { await store.close(); }
});
test('quota failure rolls back all business and outbox changes and propagates',async()=>{
  const backend=storage(),identity=user(),store=new AtomicStore(identity,initial,backend);
  await store.acquire();
  try {
    backend.setItem=()=>{throw new Error('QuotaExceededError');};
    assert.throws(()=>post(store),/Quota/);
    assert.deepEqual(store.value.state,initial);
    assert.deepEqual(new AtomicStore(identity,{},backend).value.outbox,[]);
  } finally { await store.close(); }
});
test('commit then reopen recovers business effects and exactly one pending event together',async()=>{
  const backend=storage(),identity=user(),store=new AtomicStore(identity,initial,backend);
  await store.acquire(); post(store); await store.close();
  const reopened=new AtomicStore(identity,{},backend); await reopened.acquire();
  try {
    assert.deepEqual(reopened.value.state,{invoices:[{id:'sale'}],stock:17,debt:15});
    assert.equal(reopened.value.outbox.length,1);
    // Lost server acknowledgement means the pending event survives unchanged.
    assert.equal(reopened.value.outbox[0].id,'sale-event');
    reopened.acknowledge(new Set(['sale-event']));
    assert.equal(reopened.value.outbox.length,0);
    assert.equal(reopened.read('stock'),17);
  } finally {await reopened.close();}
});
test('durable transaction exposes no business success or new state before storage acknowledgement',async()=>{
  const backend=storage(),identity=user(),store=new AtomicStore(identity,initial,backend);
  await store.acquire();
  try {
    let acknowledge;
    const durable={commit:(_key,snapshot,revision)=>{
      assert.equal(revision,store.value.revision);
      return new Promise(resolve=>{acknowledge=()=>resolve(snapshot);});
    }};
    const before=backend.getItem(store.key);
    const pending=store.transactDurable(()=>{store.set('stock',17);store.enqueue(event(identity));return {id:'sale'};},durable);
    assert.equal(store.read('stock'),20);
    assert.equal(store.value.outbox.length,0);
    assert.equal(backend.getItem(store.key),before);
    assert.throws(()=>store.transact(()=>store.set('debt',999)),/لم تكتمل/);
    acknowledge();
    assert.deepEqual(await pending,{id:'sale'});
    assert.equal(store.read('stock'),17);
    assert.deepEqual(store.value.outbox.map(item=>item.id),['sale-event']);
    assert.equal(new AtomicStore(identity,{},backend).read('stock'),17);
  } finally {await store.close();}
});
test('durable transaction failure retains prior state, outbox and local cache',async()=>{
  const backend=storage(),identity=user(),store=new AtomicStore(identity,initial,backend);
  await store.acquire();
  try {
    const before=backend.getItem(store.key);
    await assert.rejects(store.transactDurable(()=>{store.set('stock',17);store.enqueue(event(identity));},
      {commit:async()=>{throw new Error('Injected strict transaction abort');}}),/Injected strict transaction abort/);
    assert.equal(store.read('stock'),20);
    assert.equal(store.value.outbox.length,0);
    assert.equal(backend.getItem(store.key),before);
  } finally {await store.close();}
});
test('durable commit returning a different aggregate cannot publish financial success',async()=>{
  const backend=storage(),identity=user(),store=new AtomicStore(identity,initial,backend);
  await store.acquire();
  try {
    const before=backend.getItem(store.key);
    await assert.rejects(store.transactDurable(()=>{
      store.set('stock',17);
      store.enqueue(event(identity));
      return {id:'sale'};
    },{commit:async(_key,snapshot)=>({...snapshot,state:{...snapshot.state,stock:999}})}),/سجلًا مختلفًا/);
    assert.equal(store.read('stock'),20);
    assert.equal(store.value.outbox.length,0);
    assert.equal(backend.getItem(store.key),before);
    assert.equal(store.writable,false);
    assert.throws(()=>store.transact(()=>store.set('stock',1)),/الحفظ غير متاح/);
  } finally {await store.close();}
});
test('durable first-run seed rejects a different acknowledged aggregate',async()=>{
  const backend=storage(),identity=user(),store=new AtomicStore(identity,initial,backend,{durableFirst:true});
  try {
    await assert.rejects(store.acquire(undefined,{read:async()=>null,
      commit:async(_key,snapshot)=>({...snapshot,state:{...snapshot.state,stock:999}})}),/نفس السجل الأولي/);
    assert.equal(store.read('stock'),20);
    assert.equal(store.writable,false);
    assert.equal(backend.getItem(store.key),null);
  } finally {await store.close();}
});
test('durable acknowledgement and inbound cursor failures retain prior aggregate',async()=>{
  const backend=storage(),identity=user(),store=new AtomicStore(identity,initial,backend);
  await store.acquire();
  try {
    post(store);
    const before=JSON.stringify(store.value), raw=backend.getItem(store.key);
    const failed={commit:()=>{throw new Error('Injected database abort');}};
    store.durable=failed;
    await assert.rejects(store.acknowledgeDurable(new Set(['sale-event'])),/Injected database abort/);
    assert.equal(JSON.stringify(store.value),before);
    assert.equal(backend.getItem(store.key),raw);
    await assert.rejects(store.receiveDurable([{...event(identity),id:'inbound-receipt'}],3,
      ()=>store.set('debt',13)),/Injected database abort/);
    assert.equal(JSON.stringify(store.value),before);
    assert.equal(backend.getItem(store.key),raw);
  } finally {await store.close();}
});
test('durable acquire seeds first identity and later prefers committed database over stale cache',async()=>{
  const backend=storage(),identity=user(),rows=new Map();
  const durable={
    read:async key=>rows.get(key)??null,
    commit:async(key,snapshot,expected)=>{
      assert.equal(rows.get(key)?.revision??null,expected);
      rows.set(key,structuredClone(snapshot));
      return structuredClone(snapshot);
    }
  };
  const store=new AtomicStore(identity,initial,backend);
  assert.equal(await store.acquire(undefined,durable),true);
  try {
    assert.equal(rows.get(store.key).revision,0);
    assert.throws(()=>store.transact(()=>{}),/انتظار تأكيد/);
    await store.transactDurable(()=>{store.set('stock',17);store.enqueue(event(identity));});
  } finally {await store.close();}
  backend.setItem(store.key,JSON.stringify({...rows.get(store.key),revision:0,state:initial,outbox:[],applied:{}}));
  const reopened=new AtomicStore(identity,initial,backend);
  assert.equal(await reopened.acquire(undefined,durable),true);
  try {assert.equal(reopened.read('stock'),17);assert.equal(reopened.value.outbox.length,1);} finally {await reopened.close();}
});
test('durable acquire refuses to relabel an existing localStorage aggregate as verified',async()=>{
  const backend=storage(),identity=user(),old=new AtomicStore(identity,initial,backend);
  await old.acquire();post(old);await old.close();
  const raw=backend.getItem(old.key);
  const next=new AtomicStore(identity,initial,backend);
  await assert.rejects(next.acquire(undefined,{read:async()=>null,commit:async()=>{throw Error('must not seed');}}),/ترحيلًا متحققًا/);
  assert.equal(backend.getItem(old.key),raw);
});
test('durable-first reopen recovers authoritative state despite a corrupt compatibility cache',async()=>{
  const backend=storage(),identity=user(),key=scopedStorageKey('atomic_v1',identity);
  const saved={schema:1,identity,revision:4,state:{invoices:[{id:'sale'}],stock:17,debt:15},
    outbox:[event(identity)],cursor:8,applied:{'sale-event':true}};
  backend.setItem(key,'{corrupt-cache');
  backend.setItem(`braka_sync_cursor_v2_${identity.tenantId}_${identity.id}`,'999');
  const store=new AtomicStore(identity,initial,backend,{durableFirst:true});
  assert.equal(await store.acquire(undefined,{read:async()=>structuredClone(saved)}),true);
  try {
    assert.deepEqual(store.value,saved);
    assert.equal(backend.getItem(key),'{corrupt-cache');
    assert.throws(()=>store.transact(()=>{}),/انتظار تأكيد/);
  } finally {await store.close();}
});
test('an orphan legacy cursor cannot seed a new aggregate or skip financial events',async()=>{
  const backend=storage(),identity=user();
  const cursorKey=`braka_sync_cursor_v2_${identity.tenantId}_${identity.id}`;
  backend.setItem(cursorKey,'23');
  assert.throws(()=>new AtomicStore(identity,initial,backend),/مؤشر مزامنة قديم بلا سجل مالي مطابق/);
  const durableFirst=new AtomicStore(identity,initial,backend,{durableFirst:true});
  let seeded=false;
  await assert.rejects(durableFirst.acquire(undefined,{
    read:async()=>null,
    commit:async()=>{seeded=true;throw Error('must not seed');}
  }),/مؤشر مزامنة قديم بلا سجل مالي مطابق/);
  await durableFirst.close();
  assert.equal(seeded,false);
  assert.equal(backend.getItem(cursorKey),'23');
  assert.equal(backend.getItem(scopedStorageKey('atomic_v1',identity)),null);
});
test('durable authority cannot silently discard an event accounted only in stale local cache',async()=>{
  const backend=storage(),identity=user(),key=scopedStorageKey('atomic_v1',identity);
  const legacy={...event(identity),userId:identity.id};
  const cache={schema:1,identity,revision:2,state:initial,outbox:[legacy],cursor:0,applied:{}};
  const durableValue={...cache,revision:1,outbox:[],applied:{}};
  backend.setItem(key,JSON.stringify(cache));
  backend.setItem('khodar_offline_sync_queue',JSON.stringify([legacy]));
  const store=new AtomicStore(identity,initial,backend,{durableFirst:true});
  await assert.rejects(store.acquire(undefined,{read:async()=>structuredClone(durableValue)}),/غير مُرحّلة/);
  await store.close();
  assert.equal(backend.getItem(key),JSON.stringify(cache));
  assert.equal(JSON.parse(backend.getItem('khodar_offline_sync_queue')).length,1);
});
test('durable reopen preserves cache-only financial evidence even without a legacy queue',async()=>{
  for (const variant of ['newer-revision','same-revision-divergence','older-unknown-event',
    'older-ahead-cursor','older-applied-only','parseable-invalid']) {
    const backend=storage(),identity=user(),key=scopedStorageKey('atomic_v1',identity);
    const saved={schema:1,identity,revision:1,state:initial,outbox:[],cursor:0,applied:{}};
    const cache=structuredClone(saved);
    if (variant==='newer-revision') cache.revision=2;
    if (variant==='same-revision-divergence') cache.state.stock=19;
    if (variant==='older-unknown-event') {
      cache.revision=0;
      cache.outbox=[event(identity)];
      cache.applied['sale-event']=true;
    }
    if (variant==='older-ahead-cursor') { cache.revision=0;cache.cursor=2; }
    if (variant==='older-applied-only') { cache.revision=0;cache.applied['inbound-finance']=true; }
    if (variant==='parseable-invalid') Reflect.set(cache,'outbox','invalid-financial-queue');
    const raw=JSON.stringify(cache);
    backend.setItem(key,raw);
    const store=new AtomicStore(identity,initial,backend,{durableFirst:true});
    try {
      await assert.rejects(store.acquire(undefined,{read:async()=>structuredClone(saved)}),
        /نسخة محلية أحدث أو مختلفة|حدث مالي موجود في النسخة المحلية فقط|مؤشر أو حدث مستلم|سجل محلي غير صالح/);
      assert.equal(backend.getItem(key),raw);
    } finally {await store.close();}
  }
});
test('owner recovery archives a divergent cache before reopening the durable record',async()=>{
  const backend=storage(),identity=user(),key=scopedStorageKey('atomic_v1',identity);
  const cache={schema:1,identity,revision:10,state:{...initial,stock:20},outbox:[],cursor:3,
    applied:{a:true,b:true,c:true}};
  const saved={schema:1,identity,revision:8,state:{...initial,stock:17},outbox:[],cursor:5,
    applied:{a:true,b:true,c:true,d:true,e:true}};
  const raw=JSON.stringify(cache);
  backend.setItem(key,raw);
  const archives=[];
  const durable={read:async()=>structuredClone(saved),archiveCache:async(k,bytes,revision)=>{
    assert.equal(k,key);assert.equal(bytes,raw);assert.equal(revision,8);
    archives.push(bytes);return 'archive-key';
  }};
  const blocked=new AtomicStore(identity,initial,backend,{durableFirst:true});
  await assert.rejects(blocked.acquire(undefined,durable),/نسخة محلية أحدث/);
  assert.equal(await blocked.archiveConflictingCache(durable),'archive-key');
  assert.deepEqual(archives,[raw]);
  assert.equal(backend.getItem(key),null);
  await blocked.close();
  const reopened=new AtomicStore(identity,initial,backend,{durableFirst:true});
  assert.equal(await reopened.acquire(undefined,durable),true);
  try{assert.equal(reopened.value.revision,8);assert.equal(reopened.read('stock'),17);}
  finally{await reopened.close();}
});
test('recovery preserves the cache when archiving fails or financial events are pending',async()=>{
  const backend=storage(),identity=user(),key=scopedStorageKey('atomic_v1',identity);
  const saved={schema:1,identity,revision:4,state:initial,outbox:[],cursor:2,applied:{a:true,b:true}};
  const cache={...saved,revision:5,cursor:1,applied:{a:true}};
  const raw=JSON.stringify(cache);backend.setItem(key,raw);
  const store=new AtomicStore(identity,initial,backend,{durableFirst:true});
  await assert.rejects(store.archiveConflictingCache({read:async()=>saved,
    archiveCache:async()=>{throw Error('disk full');}}),/disk full/);
  assert.equal(backend.getItem(key),raw);
  cache.outbox=[event(identity)];backend.setItem(key,JSON.stringify(cache));
  await assert.rejects(store.archiveConflictingCache({read:async()=>saved,
    archiveCache:async()=>assert.fail('must not archive')}),/معلقة/);
  assert.equal(backend.getItem(key),JSON.stringify(cache));
  cache.outbox=[];
  cache.state={...initial,khodar_pos_invoices_v3:[{id:'local-only-invoice'}]};
  backend.setItem(key,JSON.stringify(cache));
  await assert.rejects(store.archiveConflictingCache({read:async()=>saved,
    archiveCache:async()=>assert.fail('must not archive')}),/سجلات مالية/);
  assert.equal(backend.getItem(key),JSON.stringify(cache));
});
test('explicit scoped aggregate adoption preserves revision, business state and pending outbox',async()=>{
  const backend=storage(),identity=user(),rows=new Map(),store=new AtomicStore(identity,initial,backend);
  await store.acquire();post(store);
  const raw=backend.getItem(store.key),before=structuredClone(store.value);
  const durable={
    adoptIfEmpty:async(key,snapshot)=>{
      if(rows.has(key))throw Error('existing durable record');
      rows.set(key,structuredClone(snapshot));return structuredClone(snapshot);
    },
    read:async key=>structuredClone(rows.get(key)??null),
    commit:async(key,snapshot,expected)=>{
      assert.equal(rows.get(key)?.revision,expected);
      rows.set(key,structuredClone(snapshot));return structuredClone(snapshot);
    }
  };
  try {
    assert.deepEqual(await store.adoptExistingAggregate(durable),before);
    assert.equal(backend.getItem(store.key),raw,'source is never deleted during adoption');
    assert.equal(rows.get(store.key).revision,before.revision);
    assert.deepEqual(rows.get(store.key).outbox.map(item=>item.id),['sale-event']);
    assert.throws(()=>store.transact(()=>store.set('debt',999)),/انتظار تأكيد/);
    await store.transactDurable(()=>store.set('debt',14));
  } finally {await store.close();}
  const reopened=new AtomicStore(identity,initial,backend);
  assert.equal(await reopened.acquire(undefined,durable),true);
  try {assert.equal(reopened.read('debt'),14);assert.deepEqual(reopened.value.outbox.map(item=>item.id),['sale-event']);}
  finally {await reopened.close();}
});
test('failed scoped aggregate adoption leaves original bytes and blocks further legacy writes',async()=>{
  const backend=storage(),identity=user(),store=new AtomicStore(identity,initial,backend);
  await store.acquire();post(store);
  const raw=backend.getItem(store.key);
  try {
    await assert.rejects(store.adoptExistingAggregate({adoptIfEmpty:async()=>{throw Error('Injected database abort');}}),/Injected database abort/);
    assert.equal(backend.getItem(store.key),raw);
    assert.equal(store.writable,false);
    assert.throws(()=>post(store),/الحفظ غير متاح/);
  } finally {await store.close();}
});
test('durable adoption rejects duplicated, unapplied and foreign pending events without replacing source',async()=>{
  for (const damage of ['duplicate','unapplied','foreign']) {
    const backend=storage(),identity=user(),original=new AtomicStore(identity,initial,backend);
    await original.acquire();post(original);await original.close();
    const damaged=structuredClone(original.value);
    if(damage==='duplicate') damaged.outbox.push(structuredClone(damaged.outbox[0]));
    if(damage==='unapplied') delete damaged.applied['sale-event'];
    if(damage==='foreign') damaged.outbox[0].payload.tenantId='foreign-tenant';
    const raw=JSON.stringify(damaged);
    backend.setItem(original.key,raw);
    const legacy=new AtomicStore(identity,initial,backend);
    await legacy.acquire();
    let adopted=false;
    try {
      await assert.rejects(legacy.adoptExistingAggregate({adoptIfEmpty:async()=>{adopted=true;}}),/طابور السجل المراد ترحيله غير متسق/);
      assert.equal(adopted,false,damage);
      assert.equal(legacy.writable,false,damage);
      assert.equal(backend.getItem(original.key),raw,damage);
    } finally {await legacy.close();}
    const durableFirst=new AtomicStore(identity,initial,backend,{durableFirst:true});
    await assert.rejects(durableFirst.acquire(undefined,{read:async()=>structuredClone(damaged)}),/طابور السجل المراد ترحيله غير متسق/);
    await durableFirst.close();
    assert.equal(backend.getItem(original.key),raw,damage);
  }
});
test('durable migration rejects pending financial events detached from final local records',async()=>{
  for (const damage of ['missing-create-record','undeleted-record']) {
    const backend=storage(),identity=user(),key='khodar_pos_invoices_v3';
    const original=new AtomicStore(identity,{[key]:[]},backend);
    await original.acquire();
    original.transact(()=>{
      original.set(key,[{id:'sale'}]);
      original.enqueue(event(identity));
    });
    await original.close();
    const damaged=structuredClone(original.value);
    if (damage==='missing-create-record') damaged.state[key]=[];
    else {
      damaged.outbox.push({id:'delete-event',tenantId:identity.tenantId,entityType:'invoice',
        entityId:'sale',action:'delete',payload:{id:'sale'}});
      damaged.applied['delete-event']=true;
    }
    const raw=JSON.stringify(damaged);
    backend.setItem(original.key,raw);
    const legacy=new AtomicStore(identity,{[key]:[]},backend);
    await legacy.acquire();
    let adopted=false;
    try {
      await assert.rejects(legacy.adoptExistingAggregate({adoptIfEmpty:async()=>{adopted=true;}}),/بلا سجل محلي مطابق/);
      assert.equal(adopted,false);
      assert.equal(legacy.writable,false);
      assert.equal(backend.getItem(original.key),raw);
    } finally {await legacy.close();}
  }
});
test('migrated pending finance event survives lost acknowledgement and replays without double effects',async()=>{
  const backend=storage(),identity=user(),rows=new Map(),legacy=new AtomicStore(identity,initial,backend);
  const durable={
    adoptIfEmpty:async(key,snapshot)=>{
      if(rows.has(key)) throw Error('already migrated');
      rows.set(key,structuredClone(snapshot));return structuredClone(snapshot);
    },
    read:async key=>structuredClone(rows.get(key)??null),
    commit:async(key,snapshot,expected)=>{
      if(rows.get(key)?.revision!==expected) throw Error('stale revision');
      rows.set(key,structuredClone(snapshot));return structuredClone(snapshot);
    }
  };
  await legacy.acquire();post(legacy);
  const sourceBytes=backend.getItem(legacy.key);
  await legacy.adoptExistingAggregate(durable);
  const serverIds=new Set();
  for(const item of legacy.value.outbox) serverIds.add(item.id); // Server accepted; response disappears.
  await legacy.close();
  const reopened=new AtomicStore(identity,initial,backend,{durableFirst:true});
  await reopened.acquire(undefined,durable);
  try {
    assert.deepEqual(reopened.value.outbox.map(item=>item.id),['sale-event']);
    assert.deepEqual(reopened.value.state,{invoices:[{id:'sale'}],stock:17,debt:15});
    for(const item of reopened.value.outbox) serverIds.add(item.id); // Idempotent retry.
    assert.equal(serverIds.size,1);
    await reopened.acknowledgeDurable(new Set(['sale-event']));
    await reopened.receiveDurable([{...event(identity),id:'sale-event'}],1,()=>{throw Error('own sale was applied twice');});
    assert.deepEqual(reopened.value.state,{invoices:[{id:'sale'}],stock:17,debt:15});
    assert.equal(reopened.value.outbox.length,0);
    assert.equal(reopened.value.cursor,1);
  } finally {await reopened.close();}
  const last=new AtomicStore(identity,initial,backend,{durableFirst:true});
  await last.acquire(undefined,durable);
  try {assert.equal(last.value.cursor,1);assert.equal(last.value.outbox.length,0);assert.equal(last.read('debt'),15);}
  finally {await last.close();}
  assert.equal(backend.getItem(legacy.key)===sourceBytes,false,'durable acknowledgement updates the compatibility cache only after migration');
});
test('cloud-checked adoption binds the durable copy to an applied server prefix',async()=>{
  const backend=storage(),identity=user(),legacy=new AtomicStore(identity,{...migrationState(identity),
    khodar_pos_invoices_v3:[{id:'sale'}]},backend);
  await legacy.acquire();post(legacy);
  legacy.receive([{id:'remote-receipt',tenantId:identity.tenantId}],5,()=>legacy.set('debt',13));
  const raw=backend.getItem(legacy.key);
  let adopted=false;
  const durable={adoptIfEmpty:async(_key,snapshot)=>{adopted=true;return structuredClone(snapshot);}};
  const page={success:true,fullTenantVisibility:true,events:[{id:'remote-receipt',tenantId:identity.tenantId,sequence:5}],
    nextCursor:5,hasMore:false};
  try {
    const result=await legacy.adoptCloudCheckedAggregate(durable,async()=>page,async()=>branchManifest(legacy.value));
    assert.equal(result.audit.verifiedThrough,5);
    assert.equal(result.branchAudit.branchCount,1);
    assert.equal(result.saved.state.debt,13);
    assert.deepEqual(result.saved.outbox.map(item=>item.id),['sale-event']);
    assert.equal(adopted,true);
    assert.equal(backend.getItem(legacy.key),raw);
  } finally {await legacy.close();}
});
test('cloud checkpoint rejects mismatched immutable payment payloads and deletion state',async()=>{
  const identity=user();
  const payment={id:'payment-1',customerId:'customer-1',amount:10};
  const customer={id:'customer-1',balance:0};
  const snapshot={identity,cursor:5,applied:{'cloud-customer':true,'cloud-payment':true},outbox:[],
    state:{khodar_pos_customer_payments_v3:[payment],khodar_pos_customers_v3:[{...customer,balance:-10}]}};
  const page={success:true,fullTenantVisibility:true,nextCursor:5,hasMore:false,
    events:[{id:'cloud-customer',tenantId:identity.tenantId,sequence:4,
      entityType:'customer',entityId:customer.id,action:'create',payload:customer},
      {id:'cloud-payment',tenantId:identity.tenantId,sequence:5,
      entityType:'customer_payment',entityId:payment.id,action:'create',payload:payment}]};
  assert.equal((await verifyCloudCheckpoint(snapshot,async()=>page)).verifiedThrough,5);
  const lostAck={...snapshot,outbox:[structuredClone(page.events[1])]};
  const beforeAudit=JSON.stringify(lostAck);
  const lostAckAudit=await verifyCloudCheckpoint(lostAck,async()=>page);
  assert.equal(lostAckAudit.verifiedAcceptedPendingEvents,1);
  assert.equal(lostAckAudit.verifiedCustomerBalances,1);
  assert.equal(JSON.stringify(lostAck),beforeAudit);
  await assert.rejects(verifyCloudCheckpoint({...lostAck,state:{...lostAck.state,
    khodar_pos_customers_v3:[{...customer,balance:-20}]}},async()=>page),/رصيد عميل محلي لا يطابق/);
  await assert.rejects(verifyCloudCheckpoint({...lostAck,state:{...lostAck.state,
    khodar_pos_customer_payments_v3:[{...payment,amount:20}]}},async()=>page),/لا يطابق آخر حركة/);
  await assert.rejects(verifyCloudCheckpoint({...snapshot,outbox:[{
    ...page.events[1],payload:{...payment,amount:99}
  }]},async()=>page),/تختلف عن الحركة المقبولة/);
  await assert.rejects(verifyCloudCheckpoint({...snapshot,state:{}},async()=>page),/سجل مالي محلي مفقود/);
  await assert.rejects(verifyCloudCheckpoint({...snapshot,state:{khodar_pos_customer_payments_v3:[{...payment,amount:20}]}},
    async()=>page),/لا يطابق آخر حركة/);
  await assert.rejects(verifyCloudCheckpoint({...snapshot,state:{khodar_pos_customer_payments_v3:[]}},
    async()=>page),/لا يطابق آخر حركة/);
  const deleted={...page,events:[{...page.events[0],sequence:3},{...page.events[1],sequence:4},
    {...page.events[1],id:'cloud-delete',sequence:5,action:'delete',payload:{id:payment.id}}]};
  const deletedSnapshot={...snapshot,applied:{...snapshot.applied,'cloud-delete':true}};
  await assert.rejects(verifyCloudCheckpoint(deletedSnapshot,async()=>deleted),/لا يطابق آخر حركة/);
  assert.equal((await verifyCloudCheckpoint({...deletedSnapshot,state:{...snapshot.state,
    khodar_pos_customer_payments_v3:[],khodar_pos_customers_v3:[customer]}},
    async()=>deleted)).verifiedThrough,5);
  const pendingDelete={...snapshot,state:{...snapshot.state,khodar_pos_customer_payments_v3:[],
    khodar_pos_customers_v3:[customer]},outbox:[{
    id:'local-delete',tenantId:identity.tenantId,entityType:'customer_payment',entityId:payment.id,action:'delete',payload:{id:payment.id}
  }]};
  const pendingAudit=await verifyCloudCheckpoint(pendingDelete,async()=>page);
  assert.equal(pendingAudit.reconciledPendingEvents,1);
  assert.equal(pendingAudit.verifiedCustomerBalances,1);
  await assert.rejects(verifyCloudCheckpoint({...pendingDelete,state:{...pendingDelete.state,
    khodar_pos_customers_v3:[{...customer,balance:-10}]}},async()=>page),/رصيد عميل محلي لا يطابق/);
});
test('customer balance migration audit replays credit, receipt, return and reversals in minor units',async()=>{
  const identity=user(),customer={id:'customer-1',balance:5};
  const invoice={id:'invoice-1',customerId:customer.id,remainingDebt:20,status:'active'};
  const receipt={id:'receipt-1',customerId:customer.id,amount:7};
  const returned={id:'return-1',customerId:customer.id,refundMethod:'credit_deduction',totalRefundAmount:3};
  const descriptions=[
    ['customer',customer.id,'create',customer],
    ['invoice',invoice.id,'create',invoice],
    ['customer_payment',receipt.id,'create',receipt],
    ['sales_return',returned.id,'create',returned],
    ['customer_payment',receipt.id,'delete',{id:receipt.id}],
    ['sales_return',returned.id,'delete',{id:returned.id}],
    ['invoice',invoice.id,'void',{id:invoice.id,status:'voided'}]
  ];
  const events=descriptions.map(([entityType,entityId,action,payload],index)=>({
    id:`history-${index}`,tenantId:identity.tenantId,sequence:index+1,entityType,entityId,action,payload
  }));
  const snapshot={identity,cursor:7,applied:Object.fromEntries(events.map(item=>[item.id,true])),outbox:[],
    state:{khodar_pos_customers_v3:[customer],khodar_pos_customer_payments_v3:[],
      khodar_pos_invoices_v3:[{...invoice,status:'voided'}],khodar_pos_sales_returns_v3:[]}};
  const page={success:true,fullTenantVisibility:true,events,nextCursor:7,hasMore:false};
  assert.equal((await verifyCloudCheckpoint(snapshot,async()=>page)).verifiedCustomerBalances,1);
  await assert.rejects(verifyCloudCheckpoint({...snapshot,state:{...snapshot.state,
    khodar_pos_customers_v3:[{...customer,balance:6}]}},async()=>page),/رصيد عميل محلي لا يطابق/);
  await assert.rejects(verifyCloudCheckpoint({...snapshot,applied:{...snapshot.applied,'bad-receipt':true},
    cursor:8},async()=>({...page,nextCursor:8,events:[...events,{id:'bad-receipt',tenantId:identity.tenantId,
      sequence:8,entityType:'customer_payment',entityId:'bad-receipt',action:'create',
      payload:{id:'bad-receipt',amount:1}}]})),/إيصال عميل يشير إلى عميل بلا معرّف/);
});
test('supplier balance migration audit replays credit purchase, payment, return and reversals in minor units',async()=>{
  const identity=user(),supplier={id:'supplier-1',balance:5};
  const purchase={id:'purchase-1',supplierId:supplier.id,creditAmount:20};
  const payment={id:'supplier-payment-1',supplierId:supplier.id,amount:7};
  const returned={id:'purchase-return-1',purchaseId:purchase.id,supplierId:supplier.id,
    refundMethod:'supplier_debt_deduction',totalRefundAmount:3};
  const descriptions=[
    ['supplier',supplier.id,'create',supplier],
    ['purchase',purchase.id,'create',purchase],
    ['supplier_payment',payment.id,'create',payment],
    ['purchase_return',returned.id,'create',returned],
    ['supplier_payment',payment.id,'delete',{id:payment.id}],
    ['purchase_return',returned.id,'delete',{id:returned.id}],
    ['purchase',purchase.id,'delete',{id:purchase.id}]
  ];
  const events=descriptions.map(([entityType,entityId,action,payload],index)=>({
    id:`supplier-history-${index}`,tenantId:identity.tenantId,sequence:index+1,entityType,entityId,action,payload
  }));
  const snapshot={identity,cursor:7,applied:Object.fromEntries(events.map(item=>[item.id,true])),outbox:[],
    state:{khodar_pos_suppliers_v3:[supplier],khodar_pos_supplier_payments_v3:[],
      khodar_pos_purchases_v3:[],khodar_pos_purchase_returns_v3:[]}};
  const page={success:true,fullTenantVisibility:true,events,nextCursor:7,hasMore:false};
  assert.equal((await verifyCloudCheckpoint(snapshot,async()=>page)).verifiedSupplierBalances,1);
  await assert.rejects(verifyCloudCheckpoint({...snapshot,state:{...snapshot.state,
    khodar_pos_suppliers_v3:[{...supplier,balance:6}]}},async()=>page),/رصيد مورد محلي لا يطابق/);
});
test('inventory migration audit replays purchase, purchase return, invoice and sales return stock effects',async()=>{
  const identity=user();
  const purchaseProduct={id:'purchase-product',name:'Purchase product',currentStockKg:0,costPerKg:0,
    branchStock:{main:0}};
  const saleProduct={id:'sale-product',name:'Sale product',currentStockKg:5,costPerKg:2,
    branchStock:{main:5}};
  const purchase={id:'purchase-stock',productId:purchaseProduct.id,productName:purchaseProduct.name,
    quantityKg:4,costPerKg:3,totalCost:12,creditAmount:12,branchId:'main',supplierId:'supplier-stock'};
  const supplier={id:'supplier-stock',balance:0};
  const purchaseReturn={id:'purchase-return-stock',purchaseId:purchase.id,productId:purchaseProduct.id,
    productName:purchaseProduct.name,returnedKg:1,refundMethod:'supplier_debt_deduction',totalRefundAmount:3};
  const invoice={id:'invoice-stock',customerId:'customer-stock',remainingDebt:15,status:'active',
    branchId:'main',items:[{productId:saleProduct.id,name:saleProduct.name,netWeight:3,pricePerKg:5,total:15}]};
  const customer={id:'customer-stock',balance:0};
  const salesReturn={id:'sales-return-stock',invoiceId:invoice.id,customerId:'customer-stock',
    refundMethod:'credit_deduction',inventoryAction:'restock',totalRefundAmount:5,
    items:[{productId:saleProduct.id,name:saleProduct.name,returnedWeight:1,sourceLineIndex:0}]};
  const descriptions=[
    ['supplier',supplier.id,'create',supplier],
    ['product',purchaseProduct.id,'create',purchaseProduct],
    ['product',saleProduct.id,'create',saleProduct],
    ['purchase',purchase.id,'create',purchase],
    ['purchase_return',purchaseReturn.id,'create',purchaseReturn],
    ['customer',customer.id,'create',customer],
    ['invoice',invoice.id,'create',invoice],
    ['sales_return',salesReturn.id,'create',salesReturn]
  ];
  const events=descriptions.map(([entityType,entityId,action,payload],index)=>({
    id:`inventory-history-${index}`,tenantId:identity.tenantId,sequence:index+1,entityType,entityId,action,payload
  }));
  const expectedPurchaseProduct={...purchaseProduct,currentStockKg:3,costPerKg:3,branchStock:{main:3}};
  const expectedSaleProduct={...saleProduct,currentStockKg:3,branchStock:{main:3}};
  const snapshot={identity,cursor:8,applied:Object.fromEntries(events.map(item=>[item.id,true])),outbox:[],
    state:{khodar_pos_products_v3:[expectedPurchaseProduct,expectedSaleProduct],
      khodar_pos_invoices_v3:[invoice],khodar_pos_sales_returns_v3:[salesReturn],
      khodar_pos_purchases_v3:[purchase],khodar_pos_purchase_returns_v3:[purchaseReturn],
      khodar_pos_customers_v3:[{id:'customer-stock',balance:10}],
      khodar_pos_suppliers_v3:[{...supplier,balance:9}]}};
  const page={success:true,fullTenantVisibility:true,events,nextCursor:8,hasMore:false};
  const verified=await verifyCloudCheckpoint(snapshot,async()=>page);
  assert.equal(verified.verifiedInventoryProducts,2);
  const lostAck={...snapshot,outbox:structuredClone(events)};
  const originalQueue=JSON.stringify(lostAck.outbox);
  const retried=await verifyCloudCheckpoint(lostAck,async()=>page);
  assert.equal(retried.verifiedAcceptedPendingEvents,events.length);
  assert.equal(retried.verifiedInventoryProducts,2);
  assert.equal(retried.verifiedSupplierBalances,1);
  assert.equal(retried.verifiedCustomerBalances,1);
  assert.equal(JSON.stringify(lostAck.outbox),originalQueue);
  const prefix={...page,events:events.slice(0,4),nextCursor:4};
  const mixed={...lostAck,cursor:4};
  const mixedAudit=await verifyCloudCheckpoint(mixed,async()=>prefix);
  assert.equal(mixedAudit.verifiedAcceptedPendingEvents,4);
  assert.equal(mixedAudit.reconciledPendingEvents,4);
  assert.equal(mixedAudit.verifiedSupplierBalances,1);
  assert.equal(mixedAudit.verifiedCustomerBalances,1);
  assert.equal(mixedAudit.verifiedInventoryProducts,2);
  assert.equal(JSON.stringify(mixed.outbox),originalQueue);
  await assert.rejects(verifyCloudCheckpoint({...mixed,state:{...snapshot.state,
    khodar_pos_suppliers_v3:[{...supplier,balance:12}]}},async()=>prefix),/رصيد مورد محلي لا يطابق/);
  await assert.rejects(verifyCloudCheckpoint({...mixed,state:{...snapshot.state,
    khodar_pos_products_v3:[{...expectedPurchaseProduct,currentStockKg:4},expectedSaleProduct]}},
    async()=>prefix),/مخزون صنف محلي لا يطابق/);
  await assert.rejects(verifyCloudCheckpoint({...mixed,outbox:[...events.slice(0,4),...events.slice(4).reverse()]},
    async()=>prefix),/بلا رصيد افتتاحي موثوق/);
  await assert.rejects(verifyCloudCheckpoint({...lostAck,state:{...snapshot.state,
    khodar_pos_suppliers_v3:[{...supplier,balance:18}]}},async()=>page),/رصيد مورد محلي لا يطابق/);
  await assert.rejects(verifyCloudCheckpoint({...lostAck,state:{...snapshot.state,
    khodar_pos_products_v3:[{...expectedPurchaseProduct,currentStockKg:4},expectedSaleProduct]}},
    async()=>page),/مخزون صنف محلي لا يطابق/);
  await assert.rejects(verifyCloudCheckpoint({...snapshot,state:{...snapshot.state,
    khodar_pos_products_v3:[{...expectedPurchaseProduct,currentStockKg:4},expectedSaleProduct]}},
    async()=>page),/مخزون صنف محلي لا يطابق/);
});
test('inventory migration reconciles branch transfer, damage and reversal and rejects unproven rows',async()=>{
  const identity=user();
  const product={id:'p',currentStockKg:10,costPerKg:2,branchStock:{main:10,other:0}};
  const damage={id:'d',productId:'p',branchId:'other',quantityKg:1,costPerKg:2,totalLoss:2};
  const descriptions=[
    ['branch','main','create',{id:'main',isMain:true}],
    ['branch','other','create',{id:'other'}],
    ['product','p','create',product],
    ['stock_transfer','t','create',{id:'t',productId:'p',fromBranchId:'main',toBranchId:'other',quantityKg:3}],
    ['damaged_item','d','create',damage]
  ];
  const events=descriptions.map(([entityType,entityId,action,payload],index)=>({
    id:`stock-${index}`,tenantId:identity.tenantId,sequence:index+1,entityType,entityId,action,payload
  }));
  const snapshot={identity,cursor:5,applied:Object.fromEntries(events.map(e=>[e.id,true])),outbox:[],
    state:{khodar_pos_products_v3:[{...product,currentStockKg:9,branchStock:{main:7,other:2}}]}};
  const page={success:true,fullTenantVisibility:true,events,nextCursor:5,hasMore:false};
  assert.equal((await verifyCloudCheckpoint(snapshot,async()=>page)).verifiedInventoryProducts,1);
  const bad=structuredClone(snapshot);
  bad.state.khodar_pos_products_v3[0].branchStock={main:8,other:1};
  await assert.rejects(verifyCloudCheckpoint(bad,async()=>page),/مخزون صنف محلي لا يطابق/);
  bad.state.khodar_pos_products_v3=structuredClone(snapshot.state.khodar_pos_products_v3);
  bad.state.khodar_pos_products_v3.push({id:'unproven',currentStockKg:100,costPerKg:2,branchStock:{main:100,other:0}});
  await assert.rejects(verifyCloudCheckpoint(bad,async()=>page),/أصناف محلية بلا أصل/);
  events.push({id:'undo-damage',tenantId:identity.tenantId,sequence:6,
    entityType:'damaged_item',entityId:'d',action:'delete',payload:{id:'d'}});
  snapshot.cursor=6;snapshot.applied['undo-damage']=true;page.nextCursor=6;
  snapshot.state.khodar_pos_products_v3=[{...product,branchStock:{main:7,other:3}}];
  assert.equal((await verifyCloudCheckpoint(snapshot,async()=>page)).verifiedInventoryProducts,1);
  events.push({id:'delete-product',tenantId:identity.tenantId,sequence:7,
    entityType:'product',entityId:'p',action:'delete',payload:{id:'p'}});
  snapshot.cursor=7;snapshot.applied['delete-product']=true;page.nextCursor=7;
  await assert.rejects(verifyCloudCheckpoint(snapshot,async()=>page),/أصناف محلية بلا أصل/);
  snapshot.state.khodar_pos_products_v3=[];
  assert.equal((await verifyCloudCheckpoint(snapshot,async()=>page)).verifiedInventoryProducts,0);
});

test('failed cloud-prefix audit cannot start migration or resume crash-unsafe writes',async()=>{
  const backend=storage(),identity=user(),legacy=new AtomicStore(identity,migrationState(identity),backend);
  await legacy.acquire();post(legacy);
  legacy.receive([{id:'known',tenantId:identity.tenantId}],5,()=>legacy.set('debt',13));
  const raw=backend.getItem(legacy.key);
  let adopted=false;
  try {
    await assert.rejects(legacy.adoptCloudCheckedAggregate({adoptIfEmpty:async()=>{adopted=true;}},async()=>({
      success:true,fullTenantVisibility:true,events:[{id:'missing',tenantId:identity.tenantId,sequence:5}],
      nextCursor:5,hasMore:false
    }),async()=>branchManifest(legacy.value)),/لم تُطبّق محليًا/);
    assert.equal(adopted,false);
    assert.equal(legacy.writable,false);
    assert.equal(backend.getItem(legacy.key),raw);
    assert.throws(()=>post(legacy),/الحفظ غير متاح/);
  } finally {await legacy.close();}
});
test('cloud-prefix audit paginates and refuses a cursor beyond the server history',async()=>{
  const identity=user(),pages=new Map([
    [0,{success:true,fullTenantVisibility:true,events:[{id:'first',tenantId:identity.tenantId,sequence:2}],nextCursor:2,hasMore:true}],
    [2,{success:true,fullTenantVisibility:true,events:[{id:'second',tenantId:identity.tenantId,sequence:5}],nextCursor:5,hasMore:false}]
  ]);
  const snapshot={identity,cursor:5,applied:{first:true,second:true},state:{},outbox:[]};
  const seen=[];
  const read=async({cursor})=>{seen.push(cursor);return pages.get(cursor);};
  const result=await verifyCloudCheckpoint(snapshot,read);
  assert.deepEqual(seen,[0,2]);
  assert.equal(result.observedEvents,2);
  await assert.rejects(verifyCloudCheckpoint({...snapshot,cursor:6},read),/المؤشر المحلي يتجاوز سجل الخادم/);
  await assert.rejects(verifyCloudCheckpoint(snapshot,async()=>({...pages.get(0),nextCursor:3})),/تخفي أحداثًا/);
});
test('branch migration audit rejects stale, filtered, missing, changed and pending branches',async()=>{
  const identity=user(),snapshot={identity,cursor:5,state:migrationState(identity),outbox:[]};
  const manifest=branchManifest(snapshot);
  assert.deepEqual(await verifyServerBranches(snapshot,async()=>manifest),{branchCount:1,verifiedAtSequence:5});
  await assert.rejects(verifyServerBranches(snapshot,async()=>({...manifest,latestSequence:6})),/نفس مؤشر المزامنة/);
  await assert.rejects(verifyServerBranches(snapshot,async()=>({...manifest,fullTenantVisibility:false})),/نفس مؤشر المزامنة/);
  await assert.rejects(verifyServerBranches(snapshot,async()=>({...manifest,branches:[]})),/لا تطابق/);
  await assert.rejects(verifyServerBranches(snapshot,async()=>({...manifest,branches:[{...manifest.branches[0],name:'Changed'}]})),/لا تطابق/);
  await assert.rejects(verifyServerBranches({...snapshot,outbox:[{entityType:'branch'}]},async()=>manifest),/لم تُحسم/);
  await assert.rejects(verifyServerBranches({...snapshot,state:{...snapshot.state,khodar_pos_branches_v1:[
    {...snapshot.state.khodar_pos_branches_v1[0],tenantId:'tenant-demo'}]}},async()=>manifest),/لا تطابق/);
});
test('failed branch migration audit leaves legacy source and durable destination untouched',async()=>{
  const backend=storage(),identity=user(),legacy=new AtomicStore(identity,migrationState(identity),backend);
  await legacy.acquire();
  const raw=backend.getItem(legacy.key);
  let adopted=false;
  try {
    await assert.rejects(legacy.adoptCloudCheckedAggregate({adoptIfEmpty:async()=>{adopted=true;}},
      async()=>({success:true,fullTenantVisibility:true,events:[],nextCursor:0,hasMore:false}),
      async()=>({...branchManifest(legacy.value),branches:[]})),/لا تطابق/);
    assert.equal(adopted,false);
    assert.equal(legacy.writable,false);
    assert.equal(backend.getItem(legacy.key),raw);
  } finally {await legacy.close();}
});
test('cloud-checked adoption rejects a noncooperating source change during network audit',async()=>{
  const backend=storage(),identity=user(),legacy=new AtomicStore(identity,{...migrationState(identity),
    khodar_pos_invoices_v3:[{id:'sale'}]},backend);
  await legacy.acquire();post(legacy);
  const oldRaw=backend.getItem(legacy.key);
  let adopted=false;
  try {
    await assert.rejects(legacy.adoptCloudCheckedAggregate({adoptIfEmpty:async()=>{adopted=true;}},async()=>{
      backend.setItem(legacy.key,`${oldRaw} `);
      return {success:true,fullTenantVisibility:true,events:[],nextCursor:0,hasMore:false};
    },async()=>branchManifest(legacy.value)),/تغير السجل المحلي أثناء فحص الخادم/);
    assert.equal(adopted,false);
    assert.equal(legacy.writable,false);
    assert.equal(backend.getItem(legacy.key),`${oldRaw} `);
  } finally {await legacy.close();}
});
test('inbound business changes, applied IDs and cursor commit or roll back together',async()=>{
  const backend=storage(),identity=user(),store=new AtomicStore(identity,initial,backend);
  await store.acquire();
  try {
    assert.throws(()=>store.receive([event(identity)],1,()=>{store.set('stock',17);throw new Error('Injected stop');}),/Injected/);
    assert.equal(store.value.cursor,0);assert.equal(store.read('stock'),20);
    assert.deepEqual(store.value.applied,{});
    store.receive([event(identity)],1,()=>store.set('stock',17));
    const reopened=new AtomicStore(identity,{},backend);
    assert.equal(reopened.value.cursor,1);assert.equal(reopened.read('stock'),17);
    store.receive([event(identity)],1,()=>{throw new Error('Must not reapply');});
    assert.throws(()=>store.receive([{...event(identity),id:'foreign',tenantId:'other'}],2,()=>{}),/tenant/);
    assert.equal(store.value.cursor,1);
  } finally {await store.close();}
});
test('a second window cannot write while the first owns the native exclusive lock',async()=>{
  const backend=storage(),identity=user(),a=new AtomicStore(identity,initial,backend),b=new AtomicStore(identity,initial,backend);
  assert.equal(await a.acquire(),true);assert.equal(await b.acquire(),false);
  assert.throws(()=>post(b));post(a);await a.close();
  assert.equal(await b.acquire(),true);
  try {assert.equal(b.read('stock'),17);assert.equal(b.value.outbox.length,1);} finally {await b.close();}
});
test('corrupt aggregate never falls back to stale legacy data',()=>{
  const backend=storage(),identity=user(),store=new AtomicStore(identity,initial,backend);
  backend.setItem(store.key,'{broken');
  assert.throws(()=>new AtomicStore(identity,initial,backend));
  assert.equal(backend.getItem(store.key),'{broken');
});
test('unowned legacy queue is preserved and cannot be silently adopted by another account',()=>{
  const backend=storage(),identity=user(),raw=JSON.stringify([{id:'old-sale',tenantId:identity.tenantId,entityType:'invoice'}]);
  backend.setItem('khodar_offline_sync_queue',raw);
  assert.throws(()=>new AtomicStore(identity,initial,backend),/بلا مالك موثوق/);
  assert.equal(backend.getItem('khodar_offline_sync_queue'),raw);
  backend.setItem('khodar_offline_sync_queue',JSON.stringify([{id:'old-sale',tenantId:identity.tenantId,userId:identity.id,entityType:'invoice'}]));
  assert.throws(()=>new AtomicStore(identity,initial,backend),/دون إثبات أثره المالي المحلي/);
  const colleague={id:crypto.randomUUID(),tenantId:identity.tenantId};
  assert.deepEqual(new AtomicStore(colleague,initial,backend).value.outbox,[]);
  assert.equal(backend.getItem('khodar_offline_sync_queue')?.includes('old-sale'),true);
});
test('an existing aggregate cannot hide newly found same-account legacy financial events',async()=>{
  const backend=storage(),identity=user(),store=new AtomicStore(identity,initial,backend);
  await store.acquire();post(store);await store.close();
  const raw=backend.getItem(store.key);
  const oldEvent={id:'unmigrated-receipt',tenantId:identity.tenantId,userId:identity.id,entityType:'customer_payment',action:'create'};
  backend.setItem('khodar_offline_sync_queue',JSON.stringify([oldEvent]));
  assert.throws(()=>new AtomicStore(identity,{},backend),/غير مُرحّلة/);
  assert.equal(backend.getItem(store.key),raw);
  assert.equal(JSON.parse(backend.getItem('khodar_offline_sync_queue')).length,1);
  backend.setItem('khodar_offline_sync_queue',JSON.stringify([{...store.value.outbox[0],userId:identity.id}]));
  assert.equal(new AtomicStore(identity,{},backend).value.outbox.length,1,'already committed event is not adopted twice');
  backend.setItem('khodar_offline_sync_queue',JSON.stringify([{...store.value.outbox[0],userId:identity.id,payload:{id:'sale',amount:999}}]));
  assert.throws(()=>new AtomicStore(identity,{},backend),/تعارض حركة قديمة/);
  backend.setItem('khodar_offline_sync_queue',JSON.stringify([{...oldEvent,userId:'colleague'}]));
  assert.equal(new AtomicStore(identity,{},backend).value.outbox.length,1,'another account queue is not adopted');
});
test('unscoped legacy financial records cannot be replaced by seeded state',()=>{
  const backend=storage(),identity=user();
  const raw=JSON.stringify([{id:'legacy-invoice',finalTotal:120}]);
  backend.setItem('khodar_pos_invoices_v3',raw);
  assert.throws(()=>new AtomicStore(identity,initial,backend),/بيانات مالية قديمة بلا هوية موثوقة/);
  assert.equal(backend.getItem('khodar_pos_invoices_v3'),raw);
  assert.equal(backend.getItem(scopedStorageKey('atomic_v1',identity)),null);
  assert.deepEqual(new AtomicStore(null,initial,backend).value.state,initial,'anonymous login must remain accessible for authenticated recovery');
  backend.setItem('khodar_offline_sync_queue','{corrupt');
  assert.deepEqual(new AtomicStore(null,initial,backend).value.state,initial,'corrupt legacy queue must not block login screen');
});
test('scoped legacy financial records without an aggregate cannot silently lose their sync provenance',async()=>{
  const backend=storage(),identity=user();
  const oldKey=scopedStorageKey('khodar_pos_invoices_v3',identity);
  const raw=JSON.stringify([{id:'legacy-sale',finalTotal:150}]);
  backend.setItem(oldKey,raw);
  assert.throws(()=>new AtomicStore(identity,initial,backend),/بيانات مالية قديمة للحساب بلا سجل تجميعي/);
  const durableFirst=new AtomicStore(identity,initial,backend,{durableFirst:true});
  let seeded=false;
  await assert.rejects(durableFirst.acquire(undefined,{read:async()=>null,commit:async()=>{seeded=true;}}),/بيانات مالية قديمة للحساب بلا سجل تجميعي/);
  await durableFirst.close();
  assert.equal(seeded,false);
  assert.equal(backend.getItem(oldKey),raw);
  assert.equal(backend.getItem(scopedStorageKey('atomic_v1',identity)),null);
});
test('tenant-owned branches are queued exactly once in the aggregate',async()=>{
  const backend=storage(),identity=user(),state={...initial,branches:[{id:'main',tenantId:identity.tenantId,name:'Main',isMain:true,status:'active'}]};
  const store=new AtomicStore(identity,state,backend);await store.acquire();
  try {
    store.transact(()=>store.enqueue({id:'earlier-sale',tenantId:identity.tenantId,entityType:'invoice',entityId:'sale',action:'create',payload:{id:'sale'}}));
    const before=backend.getItem(store.key);
    store.bootstrapBranches('branches');
    assert.equal(store.read('branches')[0].tenantId,identity.tenantId);
    assert.equal(store.value.outbox.length,2);
    assert.equal(store.value.outbox[0].entityType,'branch');
    assert.equal(store.value.outbox[1].id,'earlier-sale');
    const committed=backend.getItem(store.key);assert.notEqual(committed,before);
    store.bootstrapBranches('branches');
    assert.equal(store.value.outbox.length,2);
    assert.equal(backend.getItem(store.key),committed);
    const reopened=new AtomicStore(identity,{},backend);
    assert.equal(reopened.value.outbox.length,2);
    assert.equal(reopened.read('branches')[0].tenantId,identity.tenantId);
  } finally {await store.close();}
});
test('fresh replica does not re-register a branch already recorded by the server',async()=>{
  const backend=storage(),identity=user(),branch={id:'main',tenantId:identity.tenantId,name:'Main',isMain:true,status:'active'};
  const state={...initial,branches:[branch],[SYNC_HEADS_STATE_KEY]:{
    'domain:branches':'server-branch-event','record:branch:main':'server-branch-event'
  }};
  const store=new AtomicStore(identity,state,backend);await store.acquire();
  try {
    store.bootstrapBranches('branches');
    assert.deepEqual(store.read('branches'),[branch]);
    assert.deepEqual(store.value.outbox,[],'fresh device must not duplicate a server-registered branch event');
  } finally {await store.close();}
});
test('server branch manifest prevents a fresh empty-head replica from blocking its first pull',async()=>{
  const backend=storage(),identity=user(),branch={id:'main',tenantId:identity.tenantId,name:'Main',isMain:true,status:'active'};
  const store=new AtomicStore(identity,{...initial,branches:[branch],[SYNC_HEADS_STATE_KEY]:{}},backend);await store.acquire();
  try {
    store.bootstrapBranches('branches',{'record:branch:main':'server-branch-event','domain:branches':'server-branch-event'});
    assert.deepEqual(store.value.outbox,[]);
    assert.equal(store.value.cursor,0,'manifest hint must not skip the actual event-log pull');
  } finally {await store.close();}
});
test('branch bootstrap quota failure leaves branch ownership and queue untouched',async()=>{
  const backend=storage(),identity=user(),store=new AtomicStore(identity,{branches:[{id:'main',tenantId:identity.tenantId,name:'Main'}]},backend);
  await store.acquire();const before=backend.getItem(store.key),write=backend.setItem;
  try {
    backend.setItem=()=>{throw new Error('Quota');};
    assert.throws(()=>store.bootstrapBranches('branches'),/Quota/);
    assert.equal(backend.getItem(store.key),before);
    assert.equal(store.read('branches')[0].tenantId,identity.tenantId);
    assert.equal(store.value.outbox.length,0);
  } finally {backend.setItem=write;await store.close();}
});
test('more than 100 inherited branches bootstrap in resumable server-sized commit groups',async()=>{
  const backend=storage(),identity=user();
  const branches=Array.from({length:101},(_,i)=>({id:`branch-${i}`,tenantId:identity.tenantId,name:`Branch ${i}`}));
  const store=new AtomicStore(identity,{branches},backend);await store.acquire();
  try {
    store.bootstrapBranches('branches');
    assert.equal(store.value.outbox.length,101);
    assert.equal(new Set(store.value.outbox.map(e=>e.groupId)).size,2);
    await store.close();
    const reopened=new AtomicStore(identity,{},backend);await reopened.acquire();
    try {reopened.bootstrapBranches('branches');assert.equal(reopened.value.outbox.length,101);} finally {await reopened.close();}
  } finally {await store.close();}
});
test('durable branch bootstrap resumes after failed second batch without duplicate events',async()=>{
  const backend=storage(),identity=user(),rows=new Map();
  const branches=Array.from({length:101},(_,i)=>({id:`branch-${i}`,tenantId:identity.tenantId,name:`Branch ${i}`}));
  let failSecond=true;
  const durable={
    read:async key=>structuredClone(rows.get(key)??null),
    commit:async(key,snapshot,expected)=>{
      assert.equal(rows.get(key)?.revision??null,expected);
      if(failSecond && snapshot.outbox.length===101){failSecond=false;throw Error('Injected durable branch abort');}
      rows.set(key,structuredClone(snapshot));return structuredClone(snapshot);
    }
  };
  const store=new AtomicStore(identity,{branches},backend);
  assert.equal(await store.acquire(undefined,durable),true);
  try {
    await assert.rejects(store.bootstrapBranchesDurable('branches'),/Injected durable branch abort/);
    assert.equal(store.value.outbox.length,100);
    assert.equal(rows.get(store.key).outbox.length,100);
    await store.bootstrapBranchesDurable('branches');
    assert.equal(store.value.outbox.length,101);
    assert.equal(new Set(store.value.outbox.map(event=>event.id)).size,101);
    assert.equal(store.read('branches').every(branch=>branch.tenantId===identity.tenantId),true);
  } finally {await store.close();}
  const reopened=new AtomicStore(identity,{branches},backend);
  assert.equal(await reopened.acquire(undefined,durable),true);
  try {assert.equal(reopened.value.outbox.length,101);assert.equal(reopened.read('branches').length,101);}
  finally {await reopened.close();}
});
test('mount cancellation followed by remount cannot retain a stale writer lock',async()=>{
  const backend=storage(),store=new AtomicStore(user(),initial,backend);
  const cancelled=store.acquire();
  const closing=store.close();
  const next=store.acquire();
  await cancelled;await closing;
  assert.equal(await next,true);
  try {post(store);assert.equal(store.read('stock'),17);} finally {await store.close();}
});
test('closing during a pending durable read releases the writer lock without seeding',async()=>{
  const backend=storage(),identity=user(),store=new AtomicStore(identity,initial,backend);
  let finishRead, readStarted;
  const started=new Promise(resolve=>{readStarted=resolve;});
  const durable={read:()=>{readStarted();return new Promise(resolve=>{finishRead=resolve;});},
    commit:async()=>{throw Error('cancelled acquisition must not seed');}};
  const ready=store.acquire(undefined,durable);
  await started;
  const closing=store.close();
  finishRead(null);
  assert.equal(await ready,false);
  await closing;
  const next=new AtomicStore(identity,initial,backend);
  assert.equal(await next.acquire(),true);
  await next.close();
});

test('failed cursor commit preserves received business state and permits exactly one retry',async()=>{
  const backend=storage(),identity=user(),store=new AtomicStore(identity,initial,backend);
  await store.acquire();
  const write=backend.setItem;
  try {
    const before=backend.getItem(store.key);
    backend.setItem=()=>{throw new Error('Cursor commit quota failure');};
    const apply=()=>{store.set('stock',17);store.set('debt',15);store.set('invoices',[{id:'sale'}]);};
    assert.throws(()=>store.receive([event(identity)],1,apply),/quota/);
    assert.equal(backend.getItem(store.key),before);
    assert.deepEqual(new AtomicStore(identity,{},backend).value.state,initial);
    backend.setItem=write;
    store.receive([event(identity)],1,apply);
    store.receive([event(identity)],1,()=>{throw new Error('Duplicate application');});
    assert.equal(store.read('stock'),17);assert.equal(store.read('debt'),15);
    assert.equal(store.value.cursor,1);
  } finally {backend.setItem=write;await store.close();}
});

test('failed acknowledgement commit retains pending event across reopen',async()=>{
  const backend=storage(),identity=user(),store=new AtomicStore(identity,initial,backend);
  await store.acquire();post(store);
  const write=backend.setItem;
  try {
    backend.setItem=()=>{throw new Error('Acknowledgement quota failure');};
    assert.throws(()=>store.acknowledge(new Set(['sale-event'])),/quota/);
    const recovered=new AtomicStore(identity,{},backend);
    assert.equal(recovered.value.outbox.length,1);
    assert.equal(recovered.read('stock'),17);assert.equal(recovered.read('debt'),15);
    backend.setItem=write;
    store.acknowledge(new Set(['sale-event']));
    assert.equal(store.value.outbox.length,0);
    assert.equal(store.read('stock'),17);
  } finally {backend.setItem=write;await store.close();}
});

test('client chains causal heads and rolls back stale inbound device events',async()=>{
  const identity=user(),backend=storage();
  const store=new AtomicStore(identity,{...initial,[SYNC_HEADS_STATE_KEY]:{}},backend);await store.acquire();
  try {
    store.transact(()=>{
      store.enqueue({id:'causal-sale-1',tenantId:identity.tenantId,entityType:'invoice',entityId:'sale-1',action:'create',payload:{id:'sale-1'}});
      store.enqueue({id:'causal-sale-2',tenantId:identity.tenantId,entityType:'invoice',entityId:'sale-2',action:'create',payload:{id:'sale-2'}});
    });
    const [first,second]=store.value.outbox;
    assert.equal(first.conflictPolicyVersion,1);
    assert.equal(first.preconditions['domain:inventory'],null);
    assert.equal(second.preconditions['domain:inventory'],first.id);
    const receiverIdentity={id:crypto.randomUUID(),tenantId:identity.tenantId};
    const receiverBackend=storage(),receiver=new AtomicStore(receiverIdentity,{...initial,[SYNC_HEADS_STATE_KEY]:{}},receiverBackend);
    await receiver.acquire();
    try {
      receiver.receive([first,second],2,()=>{});
      const stale=attachConflictPreconditions({id:'stale-device-sale',tenantId:identity.tenantId,entityType:'invoice',entityId:'stale',action:'create',payload:{id:'stale'}},{});
      const before=receiverBackend.getItem(receiver.key);
      assert.throws(()=>receiver.receive([stale],3,()=>{}),/تعارض سببي/);
      assert.equal(receiverBackend.getItem(receiver.key),before);
      assert.equal(receiver.value.cursor,2);
    } finally {await receiver.close();}
  } finally {await store.close();}
});

test('pre-policy outbox upgrades atomically only at the exact server sequence',async()=>{
  const identity=user(),backend=storage(),store=new AtomicStore(identity,initial,backend);await store.acquire();
  try {
    post(store);
    const before=backend.getItem(store.key);
    assert.throws(()=>store.initializeConflictPolicy({'domain:inventory':'remote-head'},1),/أحدث/);
    assert.equal(backend.getItem(store.key),before);
    assert.equal(store.initializeConflictPolicy({'domain:inventory':'remote-head'},0),true);
    const queued=store.value.outbox[0];
    assert.equal(queued.conflictPolicyVersion,1);
    assert.equal(queued.preconditions['domain:inventory'],'remote-head');
    assert.equal(store.value.state[SYNC_HEADS_STATE_KEY]['domain:inventory'],queued.id);
    const raw=backend.getItem(store.key);
    assert.equal(store.initializeConflictPolicy({},0),false);
    assert.equal(backend.getItem(store.key),raw);
  } finally {await store.close();}
});
