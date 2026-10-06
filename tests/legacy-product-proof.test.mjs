import test from 'node:test';
import assert from 'node:assert/strict';
import { proveLegacyProduct } from '../src/services/legacyProductProof.js';
const source={id:'source',tenantId:'A',entityId:'p',entityType:'product',action:'create',branchId:null,sequence:1,payload:{id:'p',name:'Potato',currentStockKg:10}};
const parent={id:'parent',tenantId:'A',entityId:'i',entityType:'invoice',action:'create',branchId:'main',sequence:2,payload:{id:'i',branchId:'main',items:[{productId:'p',netWeight:3}]}};
test('legacy reference proof binds an unmodified single-source product to its only recorded branch',()=>{
  const original=JSON.stringify([source,parent]);
  const proof=proveLegacyProduct([source,parent],'parent','p');
  assert.equal(proof.branchId,'main');assert.deepEqual(proof.source,source);
  assert.equal(JSON.stringify([source,parent]),original);
});
test('ambiguous branches, later product edits, unscoped references and transfer usage cannot bootstrap',()=>{
  for(const extra of [{...parent,id:'other',branchId:'other'}, {...source,id:'edit',action:'update',sequence:3},
    {...parent,id:'unscoped',branchId:null}, {...parent,id:'transfer',payload:{productId:'p',fromBranchId:'main',toBranchId:'other'}}])
    assert.equal(proveLegacyProduct([source,parent,extra],'parent','p'),null);
  assert.equal(proveLegacyProduct([source,parent],'parent','foreign'),null);
  assert.equal(proveLegacyProduct([{...source,payload:{...source.payload,branchStock:{other:10}}},parent],'parent','p'),null);
});

test('foreign tenant source and invalid history sequence cannot provide a dependency proof',()=>{
  assert.equal(proveLegacyProduct([{...source,tenantId:'B'},parent],'parent','p'),null);
  assert.equal(proveLegacyProduct([{...source,sequence:0},parent],'parent','p'),null);
  assert.equal(proveLegacyProduct([source,{...parent,sequence:undefined}],'parent','p'),null);
});
test('later explicitly scoped same-branch edits preserve the original proof; foreign edits do not',()=>{
  const edit={...source,id:'scoped-edit',action:'update',sequence:3,branchId:'main',payload:{id:'p',price:4}};
  assert.equal(proveLegacyProduct([source,parent,edit],'parent','p').branchId,'main');
  assert.equal(proveLegacyProduct([source,parent,{...edit,branchId:'other'}],'parent','p'),null);
});
