import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { seedAggregate } from './aggregate-fixture.mjs';
import { attachConflictPreconditions, SYNC_HEADS_STATE_KEY } from '../src/services/syncConflictPolicy.js';
const locks=globalThis.navigator.locks;
const storage=()=>({values:new Map(),getItem(k){return this.values.get(k)??null;},setItem(k,v){this.values.set(k,String(v));},removeItem(k){this.values.delete(k);},
  clear(){this.values.clear();},key(index){return [...this.values.keys()][index]??null;},get length(){return this.values.size;}});
const installBrowserDoubles=()=>{
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false,locks}});
  Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener(){},removeEventListener(){},location:{origin:'https://test.invalid'}}});
  Object.defineProperty(globalThis,'document',{configurable:true,value:{addEventListener(){},removeEventListener(){},visibilityState:'hidden'}});
};

test('explicit inventory adjustment synchronizes, replays, reverses and rolls back with its event',async()=>{
  installBrowserDoubles();
  const bundle=await build({stdin:{contents:"export {useAppStore} from './src/store/useAppStore.js';export {cloudflareSync} from './src/services/cloudflareSync.js';export {setSessionToken,setSessionUser} from './src/services/authSession.js';",resolveDir:process.cwd()},bundle:true,write:false,define:{'import.meta.env':'{}'},format:'cjs',platform:'node',packages:'external'});
  const loaded={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
  const {useAppStore,cloudflareSync,setSessionToken,setSessionUser}=loaded.exports;
  const seed=()=>{const target=storage();seedAggregate(target,{id:'u',tenantId:'A'},{products_v3:[{
    id:'p',name:'Tomato',currentStockKg:10,costPerKg:2,branchStock:{main:10}}],
    branches_v1:[{id:'main',name:'Main',tenantId:'A',isMain:true}],active_branch_id_v1:'main'});return target;};
  let app,root;function Harness(){app=useAppStore();return null;}
  const mount=async target=>{globalThis.localStorage=target;globalThis.sessionStorage=storage();setSessionToken('test');
    setSessionUser({id:'u',tenantId:'A',role:'company_owner',branchId:'main',allowedBranches:2,sessionExpiresAt:new Date(Date.now()+60000).toISOString()});
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));await Promise.resolve();});};
  const unmount=()=>act(async()=>{root?.unmount();});const sender=seed(),receiver=seed();
  try{
    await mount(sender);const repo=cloudflareSync.repository,raw=sender.getItem(repo.key),enqueue=repo.enqueue;
    repo.enqueue=function(event){if(event.entityType==='product')throw Error('Injected adjustment event failure');return enqueue.call(this,event);};
    await act(async()=>{assert.throws(()=>app.updateProduct('p',{currentStockKg:12,branchStock:{main:12}}),/Injected adjustment event failure/);});
    repo.enqueue=enqueue;assert.equal(sender.getItem(repo.key),raw);
    const start=repo.value.outbox.length;
    await act(async()=>{app.updateProduct('p',{currentStockKg:12,branchStock:{main:12}});});
    assert.deepEqual({stock:app.products[0].currentStockKg,branch:app.products[0].branchStock.main},{stock:12,branch:12});
    const create=structuredClone(repo.value.outbox.slice(start));assert.equal(create.length,1);
    await unmount();await mount(receiver);
    await act(async()=>{cloudflareSync.updateHandler(create,create.length);});
    assert.equal(app.products[0].currentStockKg,12);const once=JSON.stringify(cloudflareSync.repository.value);
    await act(async()=>{cloudflareSync.updateHandler(create,create.length);});assert.equal(JSON.stringify(cloudflareSync.repository.value),once);
    await unmount();await mount(sender);const reverseStart=cloudflareSync.repository.value.outbox.length;
    await act(async()=>{app.updateProduct('p',{currentStockKg:10,branchStock:{main:10}});});
    const reverse=structuredClone(cloudflareSync.repository.value.outbox.slice(reverseStart));
    await unmount();await mount(receiver);
    await act(async()=>{cloudflareSync.updateHandler(reverse,create.length+reverse.length);});
    assert.deepEqual({stock:app.products[0].currentStockKg,branch:app.products[0].branchStock.main},{stock:10,branch:10});
  }finally{await unmount();cloudflareSync.stopAutoSync();delete globalThis.window;delete globalThis.document;}
});

test('expense, payroll, profit distribution and opening float reconcile across replica, replay and reversal',async()=>{
  installBrowserDoubles();
  const bundle=await build({stdin:{contents:"export {useAppStore} from './src/store/useAppStore.js';export {cloudflareSync} from './src/services/cloudflareSync.js';export {setSessionToken,setSessionUser} from './src/services/authSession.js';",resolveDir:process.cwd()},bundle:true,write:false,define:{'import.meta.env':'{}'},format:'cjs',platform:'node',packages:'external'});
  const loaded={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
  const {useAppStore,cloudflareSync,setSessionToken,setSessionUser}=loaded.exports;
  const seed=()=>{const target=storage();seedAggregate(target,{id:'u',tenantId:'A'},{
    products_v3:[],customers_v3:[],suppliers_v3:[],workers_v3:[{id:'w',name:'Worker',currentAdvance:0}],
    partners_v3:[{id:'partner',name:'Partner',sharePercentage:100,initialCapital:0}],
    branches_v1:[{id:'main',name:'Main',tenantId:'A',isMain:true}],active_branch_id_v1:'main'});return target;};
  let app,root;function Harness(){app=useAppStore();return null;}
  const mount=async target=>{globalThis.localStorage=target;globalThis.sessionStorage=storage();setSessionToken('test');
    setSessionUser({id:'u',tenantId:'A',role:'company_owner',branchId:'main',allowedBranches:2,sessionExpiresAt:new Date(Date.now()+60000).toISOString()});
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));await Promise.resolve();});};
  const unmount=()=>act(async()=>{root?.unmount();});
  const sender=seed(),receiver=seed();
  try{
    await mount(sender);const before=cloudflareSync.repository.value.outbox.length;
    let cashExpense,bankExpense,salary,distribution;
    await act(async()=>{
      app.updateSettings({openingCashDrawerFloat:100});
      cashExpense=app.addExpense({id:'expense-cash',title:'Cash expense',amount:11,paymentMethod:'cash',branchId:'main'});
      bankExpense=app.addExpense({id:'expense-bank',title:'Bank expense',amount:13,paymentMethod:'bank',branchId:'main'});
      salary=app.recordWorkerTransactionWithUpdate('w',{currentAdvance:0},{id:'salary',workerId:'w',workerName:'Worker',type:'salary_payment',amount:20,paymentMethod:'bank'});
      distribution=app.recordProfitDistribution({id:'distribution',totalDistributedAmount:16,shares:[
        {partnerId:'partner',method:'cash',netPayout:7},{partnerId:'partner',method:'bank',netPayout:9}]});
    });
    assert.deepEqual({cash:app.getFinancialPosition().cashBalance,bank:app.getFinancialPosition().bankBalance},{cash:82,bank:-42});
    assert.equal(app.expenses.filter(row=>row.workerTransactionId===salary.id).length,1);
    const created=structuredClone(cloudflareSync.repository.value.outbox.slice(before));
    assert.deepEqual(new Set(created.map(event=>event.entityType)),new Set(['settings','expense','worker_transaction','worker','profit_distribution']));
    await unmount();await mount(receiver);
    await act(async()=>{cloudflareSync.updateHandler(created,created.length);});
    assert.deepEqual({cash:app.getFinancialPosition().cashBalance,bank:app.getFinancialPosition().bankBalance},{cash:82,bank:-42});
    assert.equal(app.profitDistributions.some(row=>row.id===distribution.id),true);
    const received=JSON.stringify(cloudflareSync.repository.value);
    await act(async()=>{cloudflareSync.updateHandler(created,created.length);});
    assert.equal(JSON.stringify(cloudflareSync.repository.value),received);
    await unmount();await mount(sender);const reversalStart=cloudflareSync.repository.value.outbox.length;
    await act(async()=>{
      app.deleteExpense(cashExpense.id);app.deleteExpense(bankExpense.id);app.deleteWorkerTransaction(salary.id);
      app.deleteProfitDistribution(distribution.id);app.updateSettings({openingCashDrawerFloat:0});
    });
    assert.deepEqual({cash:app.getFinancialPosition().cashBalance,bank:app.getFinancialPosition().bankBalance},{cash:0,bank:0});
    assert.equal(app.expenses.some(row=>row.workerTransactionId===salary.id),false);
    const reversed=structuredClone(cloudflareSync.repository.value.outbox.slice(reversalStart));
    await unmount();await mount(receiver);
    await act(async()=>{cloudflareSync.updateHandler(reversed,created.length+reversed.length);});
    assert.deepEqual({cash:app.getFinancialPosition().cashBalance,bank:app.getFinancialPosition().bankBalance},{cash:0,bank:0});
    assert.equal(app.expenses.some(row=>[cashExpense.id,bankExpense.id].includes(row.id)||row.workerTransactionId===salary.id),false);
    assert.equal(app.profitDistributions.some(row=>row.id===distribution.id),false);
    const restored=JSON.stringify(cloudflareSync.repository.value);
    await act(async()=>{cloudflareSync.updateHandler(reversed,created.length+reversed.length);});
    assert.equal(JSON.stringify(cloudflareSync.repository.value),restored);
    await unmount();await mount(sender);const repo=cloudflareSync.repository,raw=sender.getItem(repo.key),enqueue=repo.enqueue;
    repo.enqueue=function(event){if(event.entityType==='profit_distribution')throw Error('Injected distribution event failure');return enqueue.call(this,event);};
    await act(async()=>{assert.throws(()=>app.recordProfitDistribution({id:'failed-distribution',totalDistributedAmount:1,shares:[{partnerId:'partner',method:'cash',netPayout:1}]}),/Injected distribution event failure/);});
    repo.enqueue=enqueue;assert.equal(sender.getItem(repo.key),raw);
  }finally{await unmount();cloudflareSync.stopAutoSync();delete globalThis.window;delete globalThis.document;}
});

test('purchase, party payments and employee advances reconcile on sender, receiver and reversal',async()=>{
  installBrowserDoubles();
  const bundle=await build({stdin:{contents:"export {useAppStore} from './src/store/useAppStore.js';export {cloudflareSync} from './src/services/cloudflareSync.js';export {setSessionToken,setSessionUser} from './src/services/authSession.js';",resolveDir:process.cwd()},bundle:true,write:false,define:{'import.meta.env':'{}'},format:'cjs',platform:'node',packages:'external'});
  const loaded={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
  const {useAppStore,cloudflareSync,setSessionToken,setSessionUser}=loaded.exports;
  const previousFetch=globalThis.fetch;
  let app,root;function Harness(){app=useAppStore();return null;}
  const seed=()=>{
    const data=storage();
    seedAggregate(data,{id:'u',tenantId:'A'},{products_v3:[{id:'p',name:'Tomato',currentStockKg:20,costPerKg:2,branchStock:{main:20}}],customers_v3:[{id:'c',name:'Customer',balance:30}],suppliers_v3:[{id:'s',name:'Supplier',balance:0}],workers_v3:[{id:'w',name:'Worker',currentAdvance:0}],branches_v1:[{id:'main',name:'Main',tenantId:'A',isMain:true},{id:'other',name:'Other',tenantId:'A'}],active_branch_id_v1:'main'});
    return data;
  };
  const mount=async data=>{
    globalThis.localStorage=data;globalThis.sessionStorage=storage();setSessionToken('test');setSessionUser({id:'u',tenantId:'A',role:'company_owner',allowedBranches:3,branchId:'all',sessionExpiresAt:new Date(Date.now()+60000).toISOString()});
    const snapshot=JSON.parse(data.getItem('braka:A:u:atomic_v1'));
    globalThis.fetch=async url=>String(url).includes('/api/branches')
      ? Response.json({success:true,tenantId:'A',fullTenantVisibility:true,latestSequence:snapshot.cursor,conflictHeads:snapshot.state[SYNC_HEADS_STATE_KEY]||{},branches:snapshot.state.khodar_pos_branches_v1})
      : Response.json({success:true,events:[],nextCursor:snapshot.cursor,hasMore:false,conflictHeads:snapshot.state[SYNC_HEADS_STATE_KEY]||{}});
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));await Promise.resolve();});
  };
  const unmount=()=>act(async()=>{root?.unmount();});
  const balances=()=>({stock:app.products[0].currentStockKg,branch:app.products[0].branchStock.main,cost:app.products[0].costPerKg,customer:app.customers[0].balance,supplier:app.suppliers[0].balance,advance:app.workers[0].currentAdvance});
  const sender=seed(),receiver=seed();
  try {
    await mount(sender);let purchase,receipt,payment,advance;
    await act(async()=>{
      purchase=app.addPurchase({id:'purchase',productId:'p',productName:'Tomato',quantityKg:5,costPerKg:4,totalCost:20,paymentMethod:'credit',supplierId:'s',branchId:'main'});
      receipt=app.recordCustomerPayment('c',7,'Receipt','cash','receipt');
      payment=app.recordSupplierPayment({id:'payment',supplierId:'s',amount:8,paymentMethod:'bank'});
      advance=app.addWorkerTransaction({workerId:'w',type:'advance',amount:10});
    });
    const expected={stock:25,branch:25,cost:2.4,customer:23,supplier:12,advance:10};
    assert.deepEqual(balances(),expected);
    assert.equal(app.getFinancialPosition().cashBalance,-3); // receipt 7 - advance 10
    assert.equal(app.getFinancialPosition().bankBalance,-8);
    const backup=app.getBackupSnapshot();
    const beforeUnsafeRestore=sender.getItem(cloudflareSync.repository.key);
    await act(async()=>{
      assert.throws(()=>app.resetToSampleData(),/استعادة معتمدة/);
    });
    assert.equal(sender.getItem(cloudflareSync.repository.key),beforeUnsafeRestore);
    assert.equal(backup.invoices.length,0);
    assert.equal(backup.purchases.length,1);
    assert.equal(backup.workerTransactions.length,1);
    assert.equal(backup.suppliers[0].balance,12);
    await act(async()=>{
      assert.equal(app.importBackupJSON(JSON.stringify({...backup,tenantId:'B'})).success,false);
      assert.equal(app.importBackupJSON(JSON.stringify({...backup,purchases:undefined})).success,false);
    });
    assert.deepEqual(balances(),expected);
    const creates=structuredClone(cloudflareSync.repository.value.outbox);
    await unmount();await mount(receiver);
    await act(async()=>{cloudflareSync.updateHandler(creates,creates.length);});
    assert.deepEqual(balances(),expected);
    assert.equal(app.getFinancialPosition().cashBalance,-3);
    assert.equal(app.getFinancialPosition().bankBalance,-8);
    await act(async()=>{cloudflareSync.updateHandler(creates,creates.length);});
    assert.deepEqual(balances(),expected);
    await unmount();await mount(sender);
    await act(async()=>{app.deletePurchase(purchase.id);app.deleteCustomerPayment(receipt.id);app.deleteSupplierPayment(payment.id);app.deleteWorkerTransaction(advance.id);});
    const initial={stock:20,branch:20,cost:2,customer:30,supplier:0,advance:0};
    assert.deepEqual(balances(),initial);
    const reversals=structuredClone(cloudflareSync.repository.value.outbox.filter(e=>e.action==='delete'));
    await unmount();await mount(receiver);
    await act(async()=>{cloudflareSync.updateHandler(reversals,creates.length+reversals.length);});
    assert.deepEqual(balances(),initial);
    assert.equal(app.getFinancialPosition().cashBalance,0);
    assert.equal(app.getFinancialPosition().bankBalance,0);
    await unmount();await mount(receiver);assert.deepEqual(balances(),initial);
    await unmount(); await mount(sender);
    let automatic;
    const repository=cloudflareSync.repository;
    const originalEnqueue=repository.enqueue;
    const beforeFailure=sender.getItem(repository.key);
    for (const failedEntity of ['supplier','purchase']) {
      repository.enqueue=function(event) {
        if(event.entityType===failedEntity) throw new Error('Injected outbox failure');
        return originalEnqueue.call(this,event);
      };
      await act(async()=>{
        assert.throws(()=>app.addPurchase({id:'failed-automatic-purchase',productId:'p',productName:'Tomato',quantityKg:5,costPerKg:4,totalCost:20,paymentMethod:'credit',supplierName:'Failed supplier',branchId:'main'}),/Injected outbox failure/);
      });
      assert.equal(sender.getItem(repository.key),beforeFailure,'business state and both events must roll back together');
      assert.equal(app.suppliers.some(s=>s.name==='Failed supplier'),false);
    }
    repository.enqueue=originalEnqueue;
    await unmount(); await mount(sender);
    await act(async()=>{
      automatic=app.addPurchase({id:'automatic-purchase',productId:'p',productName:'Tomato',quantityKg:5,costPerKg:4,totalCost:20,paymentMethod:'credit',supplierName:'Automatic supplier',branchId:'main'});
    });
    const automaticEvents=structuredClone(cloudflareSync.repository.value.outbox.filter(e=>e.entityId===automatic.id || e.entityId===automatic.supplierId));
    assert.equal(automaticEvents.filter(e=>e.entityType==='supplier' && e.action==='create').length,1,'automatic supplier needs its own event');
    assert.equal(automaticEvents.length,2);
    await unmount(); await mount(receiver);
    const cursor=cloudflareSync.repository.value.cursor+automaticEvents.length;
    await act(async()=>{cloudflareSync.updateHandler(automaticEvents,cursor);});
    assert.equal(app.suppliers.find(s=>s.id===automatic.supplierId).balance,20);
    assert.equal(app.purchases.find(p=>p.id===automatic.id).supplierId,automatic.supplierId);
    assert.equal(app.products[0].currentStockKg,25);
    assert.equal(app.products[0].branchStock.main,25);
    assert.equal(app.products[0].costPerKg,2.4);
    await act(async()=>{cloudflareSync.updateHandler(automaticEvents,cursor);});
    assert.equal(app.suppliers.find(s=>s.id===automatic.supplierId).balance,20);
    await unmount(); await mount(sender);
    await act(async()=>{app.deletePurchase(automatic.id);});
    const reversal=structuredClone(cloudflareSync.repository.value.outbox.filter(e=>e.entityId===automatic.id && e.action==='delete'));
    await unmount(); await mount(receiver);
    await act(async()=>{cloudflareSync.updateHandler(reversal,cursor+1);});
    assert.equal(app.suppliers.find(s=>s.id===automatic.supplierId).balance,0);
    assert.equal(app.products[0].currentStockKg,20);
    assert.equal(app.products[0].costPerKg,2);
    await unmount(); await mount(sender);
    const beforeTransfer=sender.getItem(cloudflareSync.repository.key);
    await act(async()=>{
      for(const quantityKg of [21,Infinity,-1]) assert.throws(()=>app.transferStockBetweenBranches({fromBranchId:'main',toBranchId:'other',productId:'p',quantityKg}));
    });
    assert.equal(sender.getItem(cloudflareSync.repository.key),beforeTransfer);
    const transferRepository=cloudflareSync.repository;
    const transferEnqueue=transferRepository.enqueue;
    transferRepository.enqueue=()=>{throw new Error('Transfer outbox failure');};
    await act(async()=>{
      assert.throws(()=>app.transferStockBetweenBranches({fromBranchId:'main',toBranchId:'other',productId:'p',quantityKg:3}),/Transfer outbox failure/);
    });
    transferRepository.enqueue=transferEnqueue;
    assert.equal(sender.getItem(transferRepository.key),beforeTransfer);
    await unmount();await mount(sender);
    let transfer;
    await act(async()=>{transfer=app.transferStockBetweenBranches({fromBranchId:'main',toBranchId:'other',productId:'p',quantityKg:3});});
    assert.equal(app.products[0].currentStockKg,20);
    assert.deepEqual(app.products[0].branchStock,{main:17,other:3});
    const transferEvents=structuredClone(cloudflareSync.repository.value.outbox.filter(e=>e.entityId===transfer.id));
    assert.equal(transferEvents.length,1);
    await unmount();await mount(receiver);
    await act(async()=>{cloudflareSync.updateHandler(transferEvents,cursor+2);});
    assert.deepEqual(app.products[0].branchStock,{main:17,other:3});
    await act(async()=>{cloudflareSync.updateHandler(transferEvents,cursor+2);});
    assert.deepEqual(app.products[0].branchStock,{main:17,other:3});
    assert.equal(app.products[0].currentStockKg,20);
    await unmount();await mount(sender);
    let opposite;
    await act(async()=>{opposite=app.transferStockBetweenBranches({fromBranchId:'other',toBranchId:'main',productId:'p',quantityKg:3});});
    const oppositeEvents=structuredClone(cloudflareSync.repository.value.outbox.filter(e=>e.entityId===opposite.id));
    await unmount();await mount(receiver);
    await act(async()=>{cloudflareSync.updateHandler(oppositeEvents,cursor+3);});
    assert.deepEqual(app.products[0].branchStock,{main:20,other:0});
    assert.equal(app.products[0].costPerKg,2);
    assert.equal(app.getFinancialPosition().cashBalance,0);
    assert.equal(app.getFinancialPosition().bankBalance,0);
    const receiverBefore=receiver.getItem(cloudflareSync.repository.key);
    await act(async()=>{
      assert.throws(()=>cloudflareSync.updateHandler([{id:'unknown-event',tenantId:'A',entityId:'unknown',entityType:'unknown',action:'create',payload:{id:'unknown'}}],cursor+4),/غير مدعومة/);
    });
    assert.equal(receiver.getItem(cloudflareSync.repository.key),receiverBefore,'unsupported events cannot silently advance cursor');
    await unmount();await mount(sender);
    let addedBranch, newTransfer;
    await act(async()=>{
      addedBranch=app.addBranch({name:'Third branch',code:'THIRD'});
      newTransfer=app.transferStockBetweenBranches({fromBranchId:'main',toBranchId:addedBranch.id,productId:'p',quantityKg:2});
    });
    assert.equal(addedBranch.tenantId,'A');
    const related=structuredClone(cloudflareSync.repository.value.outbox.filter(e=>e.entityId===addedBranch.id || e.entityId===newTransfer.id));
    assert.deepEqual(related.map(e=>e.entityType),['branch','stock_transfer']);
    await unmount();await mount(receiver);
    await act(async()=>{cloudflareSync.updateHandler(related,cursor+5);});
    assert.equal(app.branches.find(b=>b.id===addedBranch.id).tenantId,'A');
    assert.equal(app.products[0].branchStock[addedBranch.id],2);
    assert.equal(app.products[0].branchStock.main,18);
    await act(async()=>{cloudflareSync.updateHandler(related,cursor+5);});
    assert.equal(app.products[0].branchStock[addedBranch.id],2);
    await unmount();await mount(sender);
    await act(async()=>{app.deleteBranch(addedBranch.id);});
    assert.equal(app.branches.find(b=>b.id===addedBranch.id).status,'inactive');
    const branchUpdate=structuredClone(cloudflareSync.repository.value.outbox.filter(e=>e.entityId===addedBranch.id && e.action==='update'));
    await unmount();await mount(receiver);
    await act(async()=>{cloudflareSync.updateHandler(branchUpdate,cursor+6);});
    assert.equal(app.branches.find(b=>b.id===addedBranch.id).status,'inactive');
    await unmount();await mount(sender);
    let sale,saleReturn;
    await act(async()=>{
      sale=app.saveInvoice({id:'return-sale',branchId:'main',customerId:'c',paymentMethod:'credit',finalTotal:10,items:[{productId:'p',name:'Tomato',netWeight:2,pricePerKg:5}]});
    });
    const beforeInvalidReturn=sender.getItem(cloudflareSync.repository.key);
    await act(async()=>{
      assert.throws(()=>app.recordSalesReturn({invoiceId:sale.id,returnedItems:[{productId:'p',name:'Tomato',returnedWeight:3}],refundMethod:'credit_deduction',inventoryAction:'restock'}),/يتجاوز الكمية/);
    });
    assert.equal(sender.getItem(cloudflareSync.repository.key),beforeInvalidReturn,'invalid return must roll back state and outbox');
    await act(async()=>{
      assert.throws(()=>app.recordSalesReturn({invoiceId:sale.id,returnedItems:[{productId:'p',name:'Tomato',returnedWeight:1}],refundMethod:'credit_deduction',inventoryAction:'damaged'}),/قيد هالك مترابط/);
    });
    assert.equal(sender.getItem(cloudflareSync.repository.key),beforeInvalidReturn,'unsupported damaged return must not silently lose its waste record');
    await act(async()=>{
      saleReturn=app.recordSalesReturn({invoiceId:sale.id,returnedItems:[{productId:'p',name:'Tomato',returnedWeight:1}],refundMethod:'credit_deduction',inventoryAction:'restock'});
    });
    assert.equal(app.products[0].currentStockKg,19);
    assert.equal(app.products[0].branchStock.main,17);
    assert.equal(app.customers[0].balance,35);
    assert.equal(app.invoices.find(row=>row.id===sale.id).totalReturnedAmount,5);
    const activeReturnSnapshot=sender.getItem(cloudflareSync.repository.key);
    await act(async()=>{
      assert.throws(()=>app.voidInvoice(sale.id),/مردود قائم/);
      assert.throws(()=>app.deleteInvoice(sale.id),/مردود قائم/);
    });
    assert.equal(sender.getItem(cloudflareSync.repository.key),activeReturnSnapshot);
    const returnEvents=structuredClone(cloudflareSync.repository.value.outbox.filter(e=>e.entityId===sale.id || e.entityId===saleReturn.id));
    await unmount();await mount(receiver);
    await act(async()=>{cloudflareSync.updateHandler(returnEvents,cursor+8);});
    assert.equal(app.products[0].currentStockKg,19);
    assert.equal(app.products[0].branchStock.main,17);
    assert.equal(app.customers[0].balance,35);
    assert.equal(app.invoices.find(row=>row.id===sale.id).totalReturnedAmount,5);
    await act(async()=>{cloudflareSync.updateHandler(returnEvents,cursor+8);});
    assert.equal(app.products[0].currentStockKg,19,'replay must not double post return');
    await unmount();await mount(sender);
    await act(async()=>{app.deleteSalesReturn(saleReturn.id);});
    assert.equal(app.products[0].currentStockKg,18);
    assert.equal(app.products[0].branchStock.main,16);
    assert.equal(app.customers[0].balance,40);
    assert.equal(app.invoices.find(row=>row.id===sale.id).totalReturnedAmount,0);
    const returnDelete=structuredClone(cloudflareSync.repository.value.outbox.filter(e=>e.entityId===saleReturn.id && e.action==='delete'));
    await unmount();await mount(receiver);
    await act(async()=>{cloudflareSync.updateHandler(returnDelete,cursor+9);});
    assert.equal(app.products[0].currentStockKg,18);
    assert.equal(app.products[0].branchStock.main,16);
    assert.equal(app.customers[0].balance,40);
    assert.equal(app.invoices.find(row=>row.id===sale.id).totalReturnedAmount,0);
    await unmount();await mount(sender);
    let returnedPurchase, purchaseReturn;
    await act(async()=>{
      returnedPurchase=app.addPurchase({id:'return-purchase',productId:'p',productName:'Tomato',quantityKg:5,costPerKg:4,totalCost:20,paymentMethod:'credit',supplierId:'s',branchId:'main'});
    });
    const beforeInvalidPurchaseReturn=sender.getItem(cloudflareSync.repository.key);
    await act(async()=>{assert.throws(()=>app.recordPurchaseReturn({purchaseId:returnedPurchase.id,returnedKg:6,refundMethod:'supplier_debt_deduction'}),/يتجاوز كمية الشحنة/);});
    assert.equal(sender.getItem(cloudflareSync.repository.key),beforeInvalidPurchaseReturn);
    await act(async()=>{purchaseReturn=app.recordPurchaseReturn({purchaseId:returnedPurchase.id,returnedKg:2,refundMethod:'supplier_debt_deduction'});});
    assert.equal(app.products[0].currentStockKg,21);
    assert.equal(app.products[0].branchStock.main,19);
    assert.equal(app.products[0].costPerKg,2.28);
    assert.equal(app.suppliers.find(row=>row.id==='s').balance,12);
    assert.equal(app.purchases.find(row=>row.id===returnedPurchase.id).returnedKg,2);
    const activePurchaseReturnSnapshot=sender.getItem(cloudflareSync.repository.key);
    await act(async()=>{assert.throws(()=>app.deletePurchase(returnedPurchase.id),/مردود قائم/);});
    assert.equal(sender.getItem(cloudflareSync.repository.key),activePurchaseReturnSnapshot);
    const purchaseReturnEvents=structuredClone(cloudflareSync.repository.value.outbox.filter(e=>e.entityId===returnedPurchase.id || e.entityId===purchaseReturn.id));
    await unmount();await mount(receiver);
    await act(async()=>{cloudflareSync.updateHandler(purchaseReturnEvents,cursor+11);});
    assert.equal(app.products[0].currentStockKg,21);
    assert.equal(app.products[0].branchStock.main,19);
    assert.equal(app.products[0].costPerKg,2.28);
    assert.equal(app.suppliers.find(row=>row.id==='s').balance,12);
    assert.equal(app.purchases.find(row=>row.id===returnedPurchase.id).returnedKg,2);
    await act(async()=>{cloudflareSync.updateHandler(purchaseReturnEvents,cursor+11);});
    assert.equal(app.products[0].currentStockKg,21);
    await unmount();await mount(sender);
    await act(async()=>{app.deletePurchaseReturn(purchaseReturn.id);});
    assert.equal(app.products[0].currentStockKg,23);
    assert.equal(app.products[0].branchStock.main,21);
    assert.equal(app.products[0].costPerKg,2.43);
    assert.equal(app.suppliers.find(row=>row.id==='s').balance,20);
    const purchaseReturnDelete=structuredClone(cloudflareSync.repository.value.outbox.filter(e=>e.entityId===purchaseReturn.id && e.action==='delete'));
    await unmount();await mount(receiver);
    await act(async()=>{cloudflareSync.updateHandler(purchaseReturnDelete,cursor+12);});
    assert.equal(app.products[0].currentStockKg,23);
    assert.equal(app.products[0].branchStock.main,21);
    assert.equal(app.products[0].costPerKg,2.43);
    assert.equal(app.suppliers.find(row=>row.id==='s').balance,20);
    await unmount();await mount(sender);
    const beforeExcessDamage=sender.getItem(cloudflareSync.repository.key);
    await act(async()=>{assert.throws(()=>app.addDamagedItem({productId:'p',productName:'Tomato',branchId:'main',quantityKg:22,costPerKg:2.43}),/مخزون الفرع لا يكفي/);});
    assert.equal(sender.getItem(cloudflareSync.repository.key),beforeExcessDamage);
    let damage;
    await act(async()=>{damage=app.addDamagedItem({productId:'p',productName:'Tomato',branchId:'main',quantityKg:1,costPerKg:2.43});});
    assert.equal(app.products[0].currentStockKg,22);
    assert.equal(app.products[0].branchStock.main,20);
    const damageCreate=structuredClone(cloudflareSync.repository.value.outbox.filter(e=>e.entityId===damage.id));
    await unmount();await mount(receiver);
    await act(async()=>{cloudflareSync.updateHandler(damageCreate,cursor+13);});
    assert.equal(app.products[0].currentStockKg,22);
    assert.equal(app.products[0].branchStock.main,20);
    await act(async()=>{cloudflareSync.updateHandler(damageCreate,cursor+13);});
    assert.equal(app.products[0].currentStockKg,22);
    await unmount();await mount(sender);
    await act(async()=>{app.deleteDamagedItem(damage.id);});
    const damageDelete=structuredClone(cloudflareSync.repository.value.outbox.filter(e=>e.entityId===damage.id && e.action==='delete'));
    await unmount();await mount(receiver);
    await act(async()=>{cloudflareSync.updateHandler(damageDelete,cursor+14);});
    assert.equal(app.products[0].currentStockKg,23);
    assert.equal(app.products[0].branchStock.main,21);
    await unmount();await mount(sender);
    let partner,drawing;
    await act(async()=>{
      partner=app.addPartner({id:'partner-test',name:'Partner',sharePercentage:20,initialCapital:100});
      drawing=app.recordPartnerDrawing({id:'drawing-test',partnerId:partner.id,amount:7,method:'cash'});
    });
    const partnerBeforeUnsafeDelete=sender.getItem(cloudflareSync.repository.key);
    await act(async()=>{assert.throws(()=>app.deletePartner(partner.id),/مسحوبات أو توزيعات قائمة/);});
    assert.equal(sender.getItem(cloudflareSync.repository.key),partnerBeforeUnsafeDelete,'partner deletion cannot silently erase a cash drawing');
    const partnerCreates=structuredClone(cloudflareSync.repository.value.outbox.filter(e=>e.entityId===partner.id || e.entityId===drawing.id));
    await unmount();await mount(receiver);
    await act(async()=>{cloudflareSync.updateHandler(partnerCreates,cursor+16);});
    assert.equal(app.partnerDrawings.find(row=>row.id===drawing.id).amount,7);
    const receiverBeforeUnsafeDelete=receiver.getItem(cloudflareSync.repository.key);
    const unsafeDelete=attachConflictPreconditions({id:'unsafe-partner-delete',tenantId:'A',entityType:'partner',entityId:partner.id,action:'delete',payload:{id:partner.id}},
      structuredClone(cloudflareSync.repository.value.state[SYNC_HEADS_STATE_KEY]));
    await act(async()=>{assert.throws(()=>cloudflareSync.updateHandler([unsafeDelete],cursor+17),/مسحوبات أو توزيعات قائمة/);});
    assert.equal(receiver.getItem(cloudflareSync.repository.key),receiverBeforeUnsafeDelete);
    await unmount();await mount(sender);
    await act(async()=>{app.deletePartnerDrawing(drawing.id);app.deletePartner(partner.id);});
    const partnerDeletes=structuredClone(cloudflareSync.repository.value.outbox.filter(e=>[drawing.id,partner.id].includes(e.entityId) && e.action==='delete'));
    await unmount();await mount(receiver);
    await act(async()=>{cloudflareSync.updateHandler(partnerDeletes,cursor+18);});
    assert.equal(app.partnerDrawings.some(row=>row.id===drawing.id),false);
    assert.equal(app.partners.some(row=>row.id===partner.id),false);
    await unmount();await mount(sender);
    const beforeFailedNote=sender.getItem(cloudflareSync.repository.key);
    const originalNoteEnqueue=cloudflareSync.repository.enqueue;
    cloudflareSync.repository.enqueue=function(event){if(event.entityType==='invoice' && event.action==='update') throw new Error('Injected note enqueue failure');return originalNoteEnqueue.call(this,event);};
    await act(async()=>{assert.throws(()=>app.updateInvoiceNotes(sale.id,'will not persist'),/Injected note enqueue failure/);});
    cloudflareSync.repository.enqueue=originalNoteEnqueue;
    assert.equal(sender.getItem(cloudflareSync.repository.key),beforeFailedNote);
    await act(async()=>{app.updateInvoiceNotes(sale.id,'verified note');});
    const noteEvents=structuredClone(cloudflareSync.repository.value.outbox.filter(e=>e.entityId===sale.id && e.action==='update'));
    assert.equal(noteEvents.length,1);
    await unmount();await mount(receiver);
    await act(async()=>{cloudflareSync.updateHandler(noteEvents,cursor+19);});
    assert.equal(app.invoices.find(row=>row.id===sale.id).notes,'verified note');
    await unmount();await mount(sender);
    const stockBefore=app.products.find(row=>row.id==='p').currentStockKg;
    let namedTwin,identifiedSale;
    await act(async()=>{
      namedTwin=app.addProduct({id:'p-same-name',name:'Tomato',currentStockKg:7,branchStock:{main:7},costPerKg:2});
      identifiedSale=app.saveInvoice({id:'identified-sale',branchId:'main',paymentMethod:'cash',finalTotal:5,
        items:[{productId:'p',name:'Tomato',netWeight:1,pricePerKg:5}]});
    });
    assert.equal(app.products.find(row=>row.id==='p').currentStockKg,stockBefore-1);
    assert.equal(app.products.find(row=>row.id===namedTwin.id).currentStockKg,7);
    const identifiedCreates=structuredClone(cloudflareSync.repository.value.outbox.filter(e=>
      e.entityId===namedTwin.id || e.entityId===identifiedSale.id && e.action==='create'));
    await act(async()=>{app.deleteInvoice(identifiedSale.id);});
    assert.equal(app.products.find(row=>row.id==='p').currentStockKg,stockBefore);
    assert.equal(app.products.find(row=>row.id===namedTwin.id).currentStockKg,7,'reversal must not restock a same-name product with another ID');
    const identifiedDelete=structuredClone(cloudflareSync.repository.value.outbox.filter(e=>
      e.entityId===identifiedSale.id && e.action==='delete'));
    await unmount();await mount(receiver);
    await act(async()=>{cloudflareSync.updateHandler(identifiedCreates,cursor+21);});
    assert.equal(app.products.find(row=>row.id==='p').currentStockKg,stockBefore-1);
    assert.equal(app.products.find(row=>row.id===namedTwin.id).currentStockKg,7);
    await act(async()=>{cloudflareSync.updateHandler(identifiedDelete,cursor+22);});
    assert.equal(app.products.find(row=>row.id==='p').currentStockKg,stockBefore);
    assert.equal(app.products.find(row=>row.id===namedTwin.id).currentStockKg,7);
    const receiverBeforeOrphan=receiver.getItem(cloudflareSync.repository.key);
    const orphanInvoice={id:'orphan-sale',branchId:'main',paymentMethod:'cash',finalTotal:5,
      items:[{productId:'missing-product',name:'Tomato',netWeight:1,pricePerKg:5}]};
    const orphanEvent=attachConflictPreconditions({
      id:'orphan-sale-event',tenantId:'A',entityType:'invoice',entityId:orphanInvoice.id,action:'create',payload:orphanInvoice
    },structuredClone(cloudflareSync.repository.value.state[SYNC_HEADS_STATE_KEY]));
    await act(async()=>{cloudflareSync.updateHandler([orphanEvent],cursor+23);});
    const beforeOrphan=JSON.parse(receiverBeforeOrphan),afterOrphan=cloudflareSync.repository.value;
    assert.equal(afterOrphan.cursor,cursor+23,'receipt cursor advances only with durable retention');
    assert.deepEqual(afterOrphan.state.khodar_pos_invoices_v3,beforeOrphan.state.khodar_pos_invoices_v3);
    assert.deepEqual(afterOrphan.state.khodar_pos_products_v3,beforeOrphan.state.khodar_pos_products_v3);
    assert.equal(afterOrphan.applied[orphanEvent.id],undefined);
    assert.deepEqual(app.inboundReview[0].events,[orphanEvent]);
    await unmount();await mount(sender);
    const senderBeforeOrphan=sender.getItem(cloudflareSync.repository.key);
    await act(async()=>{assert.throws(()=>app.saveInvoice(orphanInvoice),/صنف الفاتورة غير موجود/);});
    assert.equal(sender.getItem(cloudflareSync.repository.key),senderBeforeOrphan,'local orphan sale must not save an invoice or outbox event');
  } finally {globalThis.fetch=previousFetch;await unmount();cloudflareSync.stopAutoSync();delete globalThis.window;delete globalThis.document;}
});
