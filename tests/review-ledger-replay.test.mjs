import test from 'node:test';
import assert from 'node:assert/strict';
import { replayReviewedLedger, stageReviewedResolution } from '../src/services/reviewLedgerReplay.js';
const event=(id,type,payload,action='create')=>({id,tenantId:'A',branchId:'main',entityType:type,entityId:payload.id,action,payload:{tenantId:'A',branchId:'main',...payload}});
const history=[event('p0','product',{id:'p',name:'جزر',currentStockKg:20,branchStock:{main:20},costPerKg:2}),
  event('c0','customer',{id:'c',balance:0}),
  event('i0','invoice',{id:'i',customerId:'c',status:'active',remainingDebt:15,finalTotal:15,items:[{productId:'p',netWeight:3}]}),
  event('r0','customer_payment',{id:'r',customerId:'c',amount:5,paymentMethod:'cash'}),
  event('x0','expense',{id:'x',amount:4,paymentMethod:'cash'})];
test('review replay recomputes actual inventory/debt from accepted sources, preserves inputs and is repeatable',()=>{
  const original=JSON.stringify(history);
  const result=replayReviewedLedger(history,'A');
  assert.equal(result.products[0].currentStockKg,17);
  assert.equal(result.products[0].branchStock.main,17);
  assert.equal(result.customers[0].balance,10);
  assert.equal(result.expenses[0].amount,4);
  assert.deepEqual(replayReviewedLedger(history,'A'),result);
  assert.equal(JSON.stringify(history),original);
});

test('server checkpoint continuation preserves inventory and debt across replay batches',()=>{
  const seed=replayReviewedLedger(history.slice(0,2),'A');
  const before=JSON.stringify(seed);
  const continued=replayReviewedLedger(history.slice(2),'A',{checkpoint:seed});
  assert.deepEqual(continued,replayReviewedLedger(history,'A'));
  assert.equal(JSON.stringify(seed),before);
  assert.throws(()=>replayReviewedLedger([history[0]],'A',{checkpoint:seed}),/duplicate/);
});
test('void replay reverses a sale exactly once and preserves the receipt source',()=>{
  const result=replayReviewedLedger([...history,event('v0','invoice',{id:'i',status:'voided'},'void')],'A');
  assert.equal(result.products[0].currentStockKg,20);
  assert.equal(result.customers[0].balance,-5);
  assert.equal(result.customerPayments.length,1);
});

test('invoice void cannot restore stock while leaving the invoice active or rewriting its money',()=>{
  const original=JSON.stringify(history);
  for(const payload of [{id:'i'}, {id:'i',status:'active'},
    {id:'i',status:'voided',finalTotal:999}, {id:'i',status:'voided',items:[]}]) {
    assert.throws(()=>replayReviewedLedger([...history,event('invalid-void','invoice',payload,'void')],'A'),
      /Invalid invoice void/);
  }
  assert.equal(JSON.stringify(history),original);
});
test('foreign tenant, missing dependency, repeated source and unsupported movement reject the whole replay',()=>{
  for(const events of [[{...history[0],tenantId:'B'}],[history[2]],[...history,history[0]],
    [...history,event('bad','cash_shift',{id:'shift'})]])
    assert.throws(()=>replayReviewedLedger(events,'A'));
  assert.throws(()=>replayReviewedLedger([...history,event('edit','invoice',{id:'i',finalTotal:99},'update')],'A'),/Unsupported/);
});

test('server choice archives the complete rejected source without replaying its optimistic debt or inventory',()=>{
  const local=event('local-sale','invoice',{...history[2].payload,id:'local-invoice',remainingDebt:90,items:[{productId:'p',netWeight:8}]});
  const receipt={reviewId:'review-1',tenantId:'A',choice:'server',events:[local],acceptedEventIds:[]};
  const plan=stageReviewedResolution({tenantId:'A',history,queue:[local],receipts:[receipt]});
  assert.equal(plan.ledger.products[0].currentStockKg,17);
  assert.equal(plan.ledger.customers[0].balance,10);
  assert.deepEqual(plan.archivedEvents,[local]);
});
test('local choice requires matching accepted replacement sources, rejects missing dependent groups',()=>{
  const local=event('local-expense','expense',{id:'local-expense-row',amount:8,paymentMethod:'cash'});
  const replacement={...local,id:'accepted-expense'};
  const receipt={reviewId:'review-2',tenantId:'A',choice:'local',events:[local],acceptedEventIds:[replacement.id]};
  const input={tenantId:'A',history:[...history,replacement],queue:[local],receipts:[receipt]};
  assert.equal(stageReviewedResolution(input).ledger.expenses.length,2);
  assert.throws(()=>stageReviewedResolution({...input,history}),/accepted/);
  assert.throws(()=>stageReviewedResolution({...input,history:[...history,{...replacement,payload:{...replacement.payload,amount:80}}]}),/accepted/);
  assert.throws(()=>stageReviewedResolution({...input,queue:[local,event('dependent','expense',{id:'dependent-row',amount:2})]}),/unreviewed/);
  const grouped={...local,groupId:'group'},dependent={...event('dependent','expense',{id:'dependent-row',amount:2}),groupId:'group'};
  assert.throws(()=>stageReviewedResolution({...input,queue:[grouped,dependent],receipts:[{...receipt,events:[grouped]}]}),/Incomplete/);
  assert.throws(()=>stageReviewedResolution({...input,receipts:[{...receipt,tenantId:'B'}]}),/receipt/);
  assert.throws(()=>stageReviewedResolution({...input,receipts:[receipt,receipt]}),/receipt/);
});

test('branch-owned transfer review replays its atomic stock pair once, not as a branchless financial record',()=>{
  const groupId='transfer-group';
  const source=event('source-stock','product',{...history[0].payload,currentStockKg:17,branchStock:{main:17}},'update');
  const destination={...event('destination-stock','product',{id:'q',name:'جزر',currentStockKg:3,costPerKg:2,branchStock:{second:3}}),
    branchId:'second',payload:{tenantId:'A',branchId:'second',id:'q',name:'جزر',currentStockKg:3,costPerKg:2,branchStock:{second:3}}};
  const transfer={...event('transfer','stock_transfer',{id:'transfer',scopedProducts:true,sourceProductId:'p',destinationProductId:'q',
    productId:'p',fromBranchId:'main',toBranchId:'second',quantityKg:3}),branchId:null};
  delete transfer.payload.branchId;
  const batch=[source,destination,transfer].map(row=>({...row,groupId}));
  const input=[history[0],...batch],branches=[{id:'main',isMain:true},{id:'second'}];
  const result=replayReviewedLedger(input,'A',{branches});
  assert.equal(result.products.find(row=>row.id==='p').currentStockKg,17);
  assert.equal(result.products.find(row=>row.id==='q').currentStockKg,3);
  assert.equal(result.stockTransfers.length,1);
  assert.throws(()=>replayReviewedLedger([history[0],source,{...destination,groupId:'wrong'},batch[2]],'A',{branches}),/transfer|مناقلة/i);
  assert.throws(()=>replayReviewedLedger([history[0],batch[0],batch[1],{...batch[2],payload:{...transfer.payload,quantityKg:4}}],'A',{branches}),/transfer|مناقلة/i);
});
