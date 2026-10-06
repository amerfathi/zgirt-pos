import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { seedAggregate } from './aggregate-fixture.mjs';

const locks=globalThis.navigator.locks;
const storage=()=>({values:new Map(),getItem(key){return this.values.get(key)??null;},setItem(key,value){this.values.set(key,String(value));},removeItem(key){this.values.delete(key);},
  clear(){this.values.clear();},key(index){return [...this.values.keys()][index]??null;},get length(){return this.values.size;}});

test('actual application records reconcile independently across money, stock, debts, payroll, partners and profit',async()=>{
  const seed=()=>{const store=storage();
  seedAggregate(store,{id:'accountant',tenantId:'A'},{
    products_v3:[{id:'p',name:'Tomato',currentStockKg:100,costPerKg:2,branchStock:{main:100}}],
    customers_v3:[{id:'c',name:'Customer',balance:10}],suppliers_v3:[{id:'s',name:'Supplier',balance:5}],
    workers_v3:[{id:'w',name:'Worker',currentAdvance:0}],
    partners_v3:[{id:'partner',name:'Partner',initialCapital:100,sharePercentage:100}],
    branches_v1:[{id:'main',name:'Main',tenantId:'A',isMain:true}],active_branch_id_v1:'main'
  });return store;};
  const target=seed(),receiver=seed();
  globalThis.localStorage=target;globalThis.sessionStorage=storage();
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false,locks}});
  Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener(){},removeEventListener(){},location:{origin:'https://test.invalid'}}});
  Object.defineProperty(globalThis,'document',{configurable:true,value:{addEventListener(){},removeEventListener(){},visibilityState:'hidden'}});
  const bundle=await build({stdin:{contents:"export {useAppStore} from './src/store/useAppStore.js';export {cloudflareSync} from './src/services/cloudflareSync.js';export {setSessionToken,setSessionUser} from './src/services/authSession.js';export {buildReportSnapshot,buildReceivableAging,REPORT_REGISTRY} from './src/services/reportRegistry.js';export {default as ReportsCenterView} from './src/components/ReportsCenterView.jsx';",resolveDir:process.cwd()},bundle:true,write:false,define:{'import.meta.env':'{}'},format:'cjs',platform:'node',external:['react','react-test-renderer'],loader:{'.png':'dataurl'}});
  const loaded={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
  const {useAppStore,cloudflareSync,setSessionToken,setSessionUser,buildReportSnapshot,buildReceivableAging,REPORT_REGISTRY,ReportsCenterView}=loaded.exports;
  let app,root;function Harness(){app=useAppStore();return null;}
  try{
    setSessionToken('test');setSessionUser({id:'accountant',tenantId:'A',role:'company_owner',branchId:'main',allowedBranches:2,sessionExpiresAt:new Date(Date.now()+60000).toISOString()});
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));await Promise.resolve();});
    let purchase,invoice;
    await act(async()=>{
      app.updateSettings({openingCashDrawerFloat:100});
      purchase=app.addPurchase({id:'purchase',productId:'p',productName:'Tomato',quantityKg:10,costPerKg:2,totalCost:20,
        paymentMethod:'split',cashAmount:6,bankAmount:4,creditAmount:10,supplierId:'s',branchId:'main'});
      invoice=app.saveInvoice({id:'invoice',customerId:'c',customerName:'Customer',branchId:'main',saleType:'split',paymentMethod:'split',
        finalTotal:50,paidAmount:30,cashAmount:20,bankAmount:10,creditAmount:20,
        items:[{productId:'p',name:'Tomato',netWeight:10,pricePerKg:5,costPerKg:2,total:50}]});
      app.recordCustomerPayment('c',5,'Bank receipt','bank','receipt');
      app.recordSupplierPayment({id:'supplier-payment',supplierId:'s',amount:3,paymentMethod:'bank'});
      app.addExpense({id:'expense',title:'Rent',amount:7,paymentMethod:'cash',branchId:'main'});
      app.addWorkerTransaction({id:'advance',workerId:'w',workerName:'Worker',type:'advance',amount:4,paymentMethod:'bank'});
      app.addWorkerTransaction({id:'salary',workerId:'w',workerName:'Worker',type:'salary_payment',amount:8,paymentMethod:'cash'});
      app.recordPartnerDrawing({id:'drawing',partnerId:'partner',amount:3,method:'cash'});
      app.recordProfitDistribution({id:'distribution',totalDistributedAmount:6,shares:[{partnerId:'partner',method:'bank',netPayout:6}]});
    });
    await act(async()=>{
      app.recordSalesReturn({invoiceId:invoice.id,returnedItems:[{productId:'p',name:'Tomato',returnedWeight:2}],refundMethod:'credit_deduction',inventoryAction:'restock'});
      app.recordPurchaseReturn({purchaseId:purchase.id,returnedKg:2,refundMethod:'supplier_debt_deduction'});
      app.addDamagedItem({id:'damage',productId:'p',productName:'Tomato',branchId:'main',quantityKg:1,costPerKg:2});
    });
    // Expected ledger is calculated independently from the known operation chain:
    // cash 100+20-6-7-8-3; bank 10+5-4-3-4-6; stock 100+10-10+2-2-1.
    const expected={
      cash:96,bank:-2,customerReceivables:15,supplierPayables:8,
      inventoryQuantityKg:99,inventoryValue:198,
      sales:50,salesReturns:10,netSales:40,purchases:20,purchaseReturns:4,netPurchases:16,
      cogs:16,grossProfit:24,operatingExpenses:15,damageLoss:2,netProfit:7,
      payroll:8,workerAdvances:4,partnerCapital:100,partnerDrawings:3,partnerDistributions:6,partnerNetEquity:103
    };
    const expectedReport={grossSales:50,salesReturnAmount:10,netSales:40,grossPurchases:20,purchaseReturnAmount:4,netPurchases:16,
      cogs:16,grossProfit:24,operatingExpenses:7,payroll:8,advances:4,damageLoss:2,netProfit:7,cash:96,bank:-2,
      customerReceivables:15,supplierPayables:8,inventoryQuantityKg:99,inventoryValue:198};
    const assertReports=()=>{
      const report=buildReportSnapshot(app,{dateFilter:'all',branchId:'all'});
      assert.deepEqual(Object.fromEntries(Object.keys(expectedReport).map(key=>[key,report[key]])),expectedReport);
      assert.equal(new Set(report.registryIds).size,17);assert.equal(REPORT_REGISTRY.length,17);
      const source=readFileSync(new URL('../src/components/ReportsCenterView.jsx',import.meta.url),'utf8');
      const menu=source.slice(source.indexOf('const reportCategories = ['),source.indexOf('const reportTitles ='));
      const menuIds=[...menu.matchAll(/id:\s*'([a-z_]+)'/g)].map(match=>match[1]);
      assert.deepEqual(new Set(REPORT_REGISTRY.map(row=>row.id)),new Set(menuIds));
    };
    const renderedText=node=>typeof node==='string'?node:Array.isArray(node)?node.map(renderedText).join(' '):node?.children?renderedText(node.children):'';
    const siblingValues=(node,label)=>{
      if(!node || typeof node!=='object') return [];
      const children=Array.isArray(node.children)?node.children:[];
      const direct=[];
      for(let index=0;index<children.length-1;index++){
        if(typeof children[index]==='object' && renderedText(children[index]).trim()===label)
          direct.push(renderedText(children[index+1]).trim());
      }
      return [...direct,...children.flatMap(child=>siblingValues(child,label))];
    };
    const tableRows=node=>node&&typeof node==='object'
      ? [...(node.type==='tr'?[renderedText(node).replace(/\s+/g,'')]:[]),...(node.children||[]).flatMap(tableRows)] : [];
    const assertRenderedReports=async()=>{
      for(const [reportType,required] of [
        ['executive',['7.00','40.00']],
        ['pnl',['16.00','24.00','7.00','تكلفة البضاعة المباعة حسب تكلفة الفواتير الأصلية']],
        ['margins',['16.00','24.00','40.00']],
        ['shrinkage',['صافي الوزن الوارد (بعد المردود)','8.00 كجم','يتطلب جرداً فعلياً','قيمة الهالك المسجل فقط','2.00']],
        ['shift',['رصيد فتح الصندوق:','100.00','المقبوض كاش من فواتير البيع:','20.00','الرصيد الدفتري المتوقع','96.00']],
        ['customer',['رصيد افتتاحي:  10.00','مردود بيع #invoice','15.00']],
        ['suppliers_ledger',['رصيد افتتاحي:  5.00','مردود توريد #purchase','8.00']],
        ['audit',['96.00','-2.00','15.00','8.00']],
        ['partners',['3.00','6.00']],
        ['sales',['40.00']],
        ['aging',['15.00']],
        ['products',['40.00']],
        ['purchases',['16.00']],
        ['returns',['إجمالي مبالغ مرتجعات المبيعات','سجل مردودات المبيعات للعملاء','#invoice','2.00 كجم','سجل مردودات المشتريات للموردين','#purchase','10.00','4.00']],
        ['damaged',['2.00']],
        ['expenses',['7.00']],
        ['payroll',['8.00','4.00']]
      ]){
        let reportRoot;
        await act(async()=>{reportRoot=TestRenderer.create(React.createElement(ReportsCenterView,{store:app,initialReportType:reportType}));});
        const visible=renderedText(reportRoot.toJSON());
        assert.ok(visible.replace(/\s+/g,'').includes('النطاق:Main'),`${reportType} lacks branch scope`);
        for(const text of required) assert.ok(visible.replace(/\s+/g,'').includes(text.replace(/\s+/g,'')),`${reportType} missing ${text}`);
        for(const [label,value] of ({
          executive:[['النقدية المحصلة فعلياً','20.00']],
          sales:[['إجمالي المبيعات','50.00'],['مردودات مبيعات (-)','-10.00'],['صافي المبيعات (=)','40.00'],['المحصل نقداً من الفواتير','20.00'],['صافي الائتمان بعد المرتجعات','10.00'],['الوزن الصافي المباع','8.00']],
          purchases:[['إجمالي تكلفة المشتريات','20.00'],['مردودات مشتريات (-)','-4.00'],['صافي تكلفة المشتريات (=)','16.00']],
          margins:[['إجمالي إيرادات المبيعات','40.00'],['تكلفة البضاعة المباعة (COGS)','16.00'],['إجمالي الربح التجاري','24.00']],
          damaged:[['إجمالي وزن البضاعة التالفة','1.00'],['إجمالي الخسائر المالية للتوالف','2.00']],
          expenses:[['إجمالي المصروفات والنثريات خلال الفترة','7.00']],
          payroll:[['إجمالي الرواتب المسددة','8.00'],['إجمالي السلفيات الممنوحة','4.00']],
          aging:[['إجمالي ديون السوق','15.00'],['1 - 7 أيام (حديث)','10.00'],['غير مؤرخ / افتتاحي','5.00']],
          audit:[['نقدية الصندوق (الدرج)','96.00'],['الأرصدة البنكية','-2.00'],['ديون السوق (لنا عند العملاء)','15.00'],['مستحقات الموردين (علينا للموردين)','8.00']]
        }[reportType]||[])) assert.ok(siblingValues(reportRoot.toJSON(),label).some(text=>text.replace(/\s+/g,'').includes(value)),`${reportType} ${label} != ${value}`);
        for(const [marker,expectedValues] of ({
          margins:[['Tomato',['8.00','40.00','16.00','24.00']]],
          products:[['Tomato',['8.00','40.00']]],
          returns:[['#invoice',['Tomato','2.00','5.00','10.00']],['#purchase',['Tomato','2.00','4.00']]],
          expenses:[['Rent',['7.00']]],
          damaged:[['Tomato',['1.00','2.00']]],
          payroll:[['Worker',['4.00','8.00']]],
          partners:[['Partner',['3.00','6.00']]],
          customer:[['مردودبيع#invoice',['10.00']]],
          suppliers_ledger:[['مردودتوريد#purchase',['4.00']]]
        }[reportType]||[])) assert.ok(tableRows(reportRoot.toJSON()).some(row=>row.includes(marker.replace(/\s+/g,''))&&expectedValues.every(value=>row.includes(value))),`${reportType} row ${marker} differs`);
        await act(async()=>{reportRoot.unmount();});
      }
    };
    assert.deepEqual(app.getAccountingSnapshot(),expected);
    assertReports();
    assert.deepEqual(buildReceivableAging(app,{asOfDate:app.invoices[0].date}).map(row=>[row.bucket,row.balance]),[['unknown',5],['1-7',10]]);
    assert.equal(buildReceivableAging({...app,invoices:app.invoices.map(row=>({...row,date:null}))},{asOfDate:app.salesReturns[0].date})
      .filter(row=>row.bucket!=='unknown').length,0);
    await assertRenderedReports();
    const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
    const yesterdayDate=`${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
    const historicalView={...app,
      customerPayments:app.customerPayments.map(row=>({...row,date:yesterdayDate})),
      supplierPayments:app.supplierPayments.map(row=>({...row,date:yesterdayDate}))};
    for(const [reportType,todayOpening,yesterdayOpening,returnLabel] of [
      ['customer','رصيد افتتاحي:  5.00','رصيد افتتاحي:  10.00','مردود بيع #invoice'],
      ['suppliers_ledger','رصيد افتتاحي:  2.00','رصيد افتتاحي:  5.00','مردود توريد #purchase']
    ]){
      let reportRoot;
      await act(async()=>{reportRoot=TestRenderer.create(React.createElement(ReportsCenterView,{store:historicalView,initialReportType:reportType}));});
      assert.ok(renderedText(reportRoot.toJSON()).includes(todayOpening));
      const yesterdayButton=reportRoot.root.findAllByType('button').find(button=>button.props.children==='أمس');
      assert.ok(yesterdayButton);
      await act(async()=>{yesterdayButton.props.onClick();});
      const yesterdayVisible=renderedText(reportRoot.toJSON());
      assert.ok(yesterdayVisible.includes(yesterdayOpening));
      assert.ok(!yesterdayVisible.includes(returnLabel));
      await act(async()=>{reportRoot.unmount();});
    }
    let currentCashRoot;
    await act(async()=>{currentCashRoot=TestRenderer.create(React.createElement(ReportsCenterView,{store:historicalView,initialReportType:'shift'}));});
    assert.ok(renderedText(currentCashRoot.toJSON()).includes('96.00'));
    assert.ok(renderedText(currentCashRoot.toJSON()).includes('فلتر التاريخ لا يغير هذا الرصيد'));
    await act(async()=>{currentCashRoot.unmount();});
    const returnOnlyView={...app,
      invoices:app.invoices.map(row=>({...row,date:yesterdayDate})),
      purchases:app.purchases.map(row=>({...row,date:yesterdayDate}))};
    const returnOnlySnapshot=buildReportSnapshot(returnOnlyView,{dateFilter:'today',asOfDate:app.salesReturns[0].date});
    assert.equal(returnOnlySnapshot.netSales,-10);
    assert.equal(returnOnlySnapshot.netPurchases,-4);
    const calendarView={...app,invoices:[
      {...app.invoices[0],id:'in-six-days',date:'2026-09-18'},
      {...app.invoices[0],id:'in-seven-days',date:'2026-09-17'},
      {...app.invoices[0],id:'prior-month',date:'2026-08-31'}
    ],salesReturns:[]};
    assert.equal(buildReportSnapshot(calendarView,{dateFilter:'week',asOfDate:'2026-09-24'}).grossSales,50);
    assert.equal(buildReportSnapshot(calendarView,{dateFilter:'month',asOfDate:'2026-09-24'}).grossSales,100);
    for(const reportType of ['pnl','sales','purchases']){
      let reportRoot;
      await act(async()=>{reportRoot=TestRenderer.create(React.createElement(ReportsCenterView,{store:returnOnlyView,initialReportType:reportType}));});
      const visible=renderedText(reportRoot.toJSON());
      assert.ok(visible.includes(reportType==='purchases'?'-4.00':'-10.00'),`${reportType} concealed return-only period`);
      if(reportType==='sales') assert.ok(siblingValues(reportRoot.toJSON(),'صافي الائتمان بعد المرتجعات')
        .some(value=>value.replace(/\s+/g,'').includes('-10.00')));
      await act(async()=>{reportRoot.unmount();});
    }
    assert.equal(app.products[0].branchStock.main,99);
    assert.equal(app.customers[0].balance,15);
    assert.equal(app.suppliers[0].balance,8);
    assert.equal(app.workers[0].currentAdvance,4);
    assert.equal(cloudflareSync.repository.value.outbox.length>0,true);
    const backup=structuredClone(app.getBackupSnapshot());
    const canonicalIds=Object.fromEntries(['products','customers','invoices','expenses','damagedItems','workers','workerTransactions',
      'customerPayments','purchases','suppliers','supplierPayments','salesReturns','purchaseReturns','partners','partnerDrawings',
      'profitDistributions','branches','stockTransfers'].map(key=>[key,backup[key].map(row=>row.id)]));
    await act(async()=>{app.addExpense({id:'post-backup-expense',title:'After backup',amount:99,paymentMethod:'cash',branchId:'main'});});
    assert.notDeepEqual(app.getAccountingSnapshot(),expected);
    const preRestoreEvents=structuredClone(cloudflareSync.repository.value.outbox);
    let restoreResult;
    await act(async()=>{restoreResult=await app.importBackupJSON(JSON.stringify(backup));});
    assert.equal(restoreResult.success,true,restoreResult.error);
    assert.deepEqual(app.getAccountingSnapshot(),expected);
    assertReports();
    await assertRenderedReports();
    assert.deepEqual(Object.fromEntries(Object.keys(canonicalIds).map(key=>[key,app[key].map(row=>row.id)])),canonicalIds);
    assert.equal(app.activeBranchId,'main');
    assert.equal(cloudflareSync.repository.value.cursor,backup.syncCursor);
    assert.equal(cloudflareSync.repository.value.outbox.length,1);
    const restoreEvent=structuredClone(cloudflareSync.repository.value.outbox[0]);
    assert.equal(restoreEvent.entityType,'restore_snapshot');
    assert.deepEqual(restoreEvent.payload.snapshot,backup);
    const aggregateKey=cloudflareSync.repository.key,raw=target.getItem(aggregateKey);
    await act(async()=>{root.unmount();});
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));});
    assert.deepEqual(app.getAccountingSnapshot(),expected);
    assertReports();
    await assertRenderedReports();
    assert.equal(cloudflareSync.repository.value.outbox.length,1);
    assert.equal(target.getItem(aggregateKey),raw);
    await act(async()=>{root.unmount();});globalThis.localStorage=receiver;
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));});
    await act(async()=>{cloudflareSync.updateHandler(preRestoreEvents,preRestoreEvents.length);});
    assert.notDeepEqual(app.getAccountingSnapshot(),expected);
    await act(async()=>{cloudflareSync.updateHandler([restoreEvent],preRestoreEvents.length+1);});
    assert.deepEqual(app.getAccountingSnapshot(),expected);
    assertReports();
    await assertRenderedReports();
    assert.deepEqual(Object.fromEntries(Object.keys(canonicalIds).map(key=>[key,app[key].map(row=>row.id)])),canonicalIds);
    assert.equal(app.activeBranchId,'main');
    const received=JSON.stringify(cloudflareSync.repository.value);
    await act(async()=>{cloudflareSync.updateHandler([restoreEvent],preRestoreEvents.length+1);});
    assert.equal(JSON.stringify(cloudflareSync.repository.value),received);
    await act(async()=>{root.unmount();});
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));});
    assert.deepEqual(app.getAccountingSnapshot(),expected);
    assert.deepEqual(Object.fromEntries(Object.keys(canonicalIds).map(key=>[key,app[key].map(row=>row.id)])),canonicalIds);
    await act(async()=>{
      app.recordSalesReturn({invoiceId:invoice.id,returnedItems:[{productId:'p',name:'Tomato',returnedWeight:1}],refundMethod:'cash',inventoryAction:'restock'});
      app.recordPurchaseReturn({purchaseId:purchase.id,returnedKg:1,refundMethod:'cash'});
    });
    const cashRefundReport=buildReportSnapshot(app,{dateFilter:'all'});
    assert.equal(cashRefundReport.cash,93);
    assert.equal(cashRefundReport.cash,app.getAccountingSnapshot().cash);
    assert.equal(cashRefundReport.bank,app.getAccountingSnapshot().bank);
  }finally{
    await act(async()=>{root?.unmount();});cloudflareSync.stopAutoSync();delete globalThis.window;delete globalThis.document;
  }
});
