import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import TestRenderer,{act} from 'react-test-renderer';
const bundle=await build({entryPoints:['src/components/ConflictReviewPanel.jsx'],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',define:{'import.meta.env':'{}'}});
const loaded={exports:{}};
new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
const Panel=loaded.exports.default;
test('owner review panel uses honest pending-reconciliation copy and explicit manual loading',()=>{
  const html=renderToStaticMarkup(React.createElement(Panel,{user:{id:'owner',tenantId:'A',role:'company_owner',isStaff:false}}));
  assert.match(html,/مراجعة تعارضات البيانات/);
  assert.match(html,/تحميل المراجعات/);
  assert.match(html,/لا يُطبق الاختيار على الأرصدة/);
  assert.doesNotMatch(html,/تم حل التعارض/);
});
test('staff and delegated administrators do not receive owner decision controls',()=>{
  for(const user of [{role:'cashier'},{role:'admin'},{role:'company_owner',isStaff:true},null])
    assert.equal(renderToStaticMarkup(React.createElement(Panel,{user})),'');
});

test('owner panel keeps a pending decision visible until bounded validation finishes',async()=>{
  const previous=globalThis.fetch,previousStorage=globalThis.sessionStorage;
  const rows=new Map();globalThis.sessionStorage={getItem:key=>rows.get(key)||null,setItem:(key,value)=>{rows.set(key,value);},removeItem:key=>{rows.delete(key);},
    clear:()=>rows.clear(),key:index=>[...rows.keys()][index]||null,get length(){return rows.size;}};
  let root,patches=0;
  const event={id:'local',entityType:'product',entityId:'p',branchId:'main',payload:{id:'p',name:'Local'}};
  globalThis.fetch=async(_url,options)=>options?.method==='PATCH'?
    (++patches<3?Response.json({success:true,posted:false,status:'validating',processedCount:patches*200,totalCount:500},{status:202}):Response.json({success:true,posted:true,status:'resolved'})):
    Response.json({success:true,reviews:[{id:'pending',submittedBy:'owner',proposedEvents:[event],serverEvents:[],heads:{}}]});
  try{
    await act(async()=>{root=TestRenderer.create(React.createElement(Panel,{user:{id:'owner',tenantId:'A',role:'company_owner',isStaff:false}}));});
    const button=text=>root.root.findAllByType('button').find(row=>row.children.join('')===text);
    await act(async()=>button('تحميل المراجعات').props.onClick());
    await act(async()=>root.root.findAllByType('input')[0].props.onChange());
    await act(async()=>button('اعتماد المصدر المختار').props.onClick());
    await act(async()=>button('تأكيد الاعتماد والتسوية').props.onClick());
    assert.equal(patches,3);
    assert.equal(root.root.findAllByType('article').length,0);
  }finally{if(root)await act(async()=>root.unmount());globalThis.fetch=previous;globalThis.sessionStorage=previousStorage;}
});
