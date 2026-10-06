import test from 'node:test';
import assert from 'node:assert/strict';
import { AtomicStore } from '../src/services/atomicStore.js';
import { INITIAL_SETTINGS } from '../src/data/initialData.js';
import { replayReviewedLedger } from '../src/services/reviewLedgerReplay.js';
const memory=()=>({rows:new Map(),getItem(key){return this.rows.get(key)??null;},setItem(key,value){this.rows.set(key,value);},removeItem(key){this.rows.delete(key);},clear(){this.rows.clear();},key(index){return [...this.rows.keys()][index]??null;},get length(){return this.rows.size;}});
test('review settlement archives the original aggregate and installs rebuilt state only after durable acknowledgement',async()=>{
  const identity={id:crypto.randomUUID(),tenantId:'REVIEW-ATOMIC',branchIds:['main']},storage=memory();
  const local=new AtomicStore(identity,{khodar_pos_branches_v1:[{id:'main',tenantId:identity.tenantId}],khodar_pos_active_branch_id_v1:'main'},storage);
  await local.acquire();
  const original={id:'original',tenantId:identity.tenantId,branchId:'main',entityType:'expense',entityId:'expense',action:'create',payload:{id:'expense',tenantId:identity.tenantId,branchId:'main',amount:8,paymentMethod:'cash'}};
  local.transact(()=>local.enqueue(original));
  const queue=structuredClone(local.current.outbox),before=JSON.stringify(local.value);
  const proposal={protocol:'owner-reviewed-ledger-v1',tenantId:identity.tenantId,completeHistory:true,history:[],nextCursor:0,conflictHeads:{},
    branches:[{id:'main',tenantId:identity.tenantId}],queue,receipts:[{reviewId:'review',tenantId:identity.tenantId,choice:'server',events:queue,acceptedEventIds:[]}]};
  try{
    local.durable={commit:async()=>{throw Error('quota');}};
    await assert.rejects(local.installReviewedResolution(proposal),/quota/);
    assert.equal(JSON.stringify(local.value),before);
    let acknowledge;local.durable={commit:(_key,value)=>new Promise(resolve=>{acknowledge=()=>resolve(value);})};
    const pending=local.installReviewedResolution(proposal);
    assert.equal(JSON.stringify(local.value),before);
    acknowledge();await pending;
    assert.equal(local.current.outbox.length,0);
    assert.deepEqual(local.read('khodar_pos_expenses_v3'),[]);
    assert.equal(local.read('braka_review_recovery_archive_v1')[0].original.outbox[0].id,'original');
    assert.deepEqual(local.read('khodar_pos_settings_v3'),INITIAL_SETTINGS);
    await assert.rejects(local.installReviewedResolution(proposal),/changed/);
  }finally{await local.close();}
});

test('validated paginated checkpoint installs atomically and never replays a covered old source',async()=>{
  const user={id:'v2-cashier',tenantId:'V2',branchIds:['main']},storage=memory();
  const branch={id:'main',tenantId:'V2',name:'Main'};
  const local=new AtomicStore(user,{khodar_pos_branches_v1:[branch],khodar_pos_active_branch_id_v1:'main'},storage);
  await local.acquire();
  const original={id:'pending-v2',tenantId:'V2',branchId:'main',entityType:'expense',entityId:'pending',action:'create',payload:{id:'pending',tenantId:'V2',branchId:'main',amount:8,paymentMethod:'cash'}};
  local.transact(()=>local.enqueue(original));
  const queue=structuredClone(local.current.outbox);
  const source={...original,id:'accepted-v2',entityId:'accepted',sequence:10,payload:{...original.payload,id:'accepted',amount:3}};
  const ledger=replayReviewedLedger([source],'V2',{branches:[branch]});
  const proposal={protocol:'owner-reviewed-checkpoint-v2',tenantId:'V2',completeHistory:false,validatedThroughCursor:2201,nextCursor:2201,
    history:[],checkpoint:ledger,conflictHeads:{},branches:[branch],queue,receipts:[{reviewId:'v2-review',tenantId:'V2',choice:'server',events:queue,acceptedEventIds:[]}]};
  try{
    await assert.rejects(local.installReviewedResolution({...proposal,validatedThroughCursor:200}));
    assert.deepEqual(local.current.outbox,queue);
    await local.installReviewedResolution(proposal);
    assert.equal(local.current.outbox.length,0);assert.equal(local.current.cursor,2201);
    assert.equal(local.read('khodar_pos_expenses_v3')[0].amount,3);
    let applied=0;
    local.receive([source],2202,()=>{applied++;},{},true);
    assert.equal(applied,0);
    assert.equal(local.read('braka_review_recovery_archive_v1')[0].original.outbox[0].id,original.id);
  }finally{await local.close();}
});
