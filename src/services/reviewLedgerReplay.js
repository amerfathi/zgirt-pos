import { applyInvoiceInventory } from './invoiceInventory.js';
import { adjustBalance, applyPurchaseInventory, applySalesReturnInvoice, applySalesReturnInventory,
  applyPurchaseReturnPurchase, applyPurchaseReturnInventory, applyDamageInventory, applyWorkerAdvance, applyStockTransfer } from './businessEffects.js';
import { INITIAL_SETTINGS } from '../data/initialData.js';
import { BACKUP_ARRAY_FIELDS, backupToState, validateBackup } from './backupValidation.js';
import { proveLegacyProduct } from './legacyProductProof.js';
import { assertInvoiceVoidPayload, assertInvoiceUpdatePayload } from './invoiceMutationPolicy.js';

const tables={product:'products',customer:'customers',supplier:'suppliers',invoice:'invoices',purchase:'purchases',
  expense:'expenses',customer_payment:'customerPayments',supplier_payment:'supplierPayments',branch:'branches',
  sales_return:'salesReturns',purchase_return:'purchaseReturns',damaged_item:'damagedItems',worker:'workers',
  worker_transaction:'workerTransactions',partner:'partners',partner_drawing:'partnerDrawings',
  profit_distribution:'profitDistributions',stock_transfer:'stockTransfers'};
const round=value=>Math.round(value*100)/100;

// Staging is not acknowledgement: the future commit boundary must authenticate
// receipts, verify their current revision and commit archive + state together.
export function stageReviewedResolution({tenantId,history,queue,receipts,branches=[],checkpoint=null}){
  if(!Array.isArray(history)||!Array.isArray(queue)||!Array.isArray(receipts))throw new Error('Invalid resolution input');
  const queued=new Map(queue.map(event=>[event.id,event]));
  if(queued.size!==queue.length)throw new Error('Duplicate pending source');
  const accepted=new Map(history.map(event=>[event.id,event]));
  const covered=new Set(),reviewIds=new Set(),replacementIds=new Set(),archives=[];
  for(const receipt of receipts){
    if(receipt.tenantId!==tenantId||!receipt.reviewId||reviewIds.has(receipt.reviewId)||
      !['local','server'].includes(receipt.choice)||!Array.isArray(receipt.events)||!receipt.events.length||
      !Array.isArray(receipt.acceptedEventIds))throw new Error('Invalid resolution receipt');
    reviewIds.add(receipt.reviewId);
    if(receipt.choice==='server'&&receipt.acceptedEventIds.length||
      receipt.choice==='local'&&receipt.acceptedEventIds.length!==receipt.events.length)throw new Error('Missing accepted replacement sources');
    const receiptIds=new Set(receipt.events.map(event=>event.id));
    for(const [index,event] of receipt.events.entries()){
      const original=queued.get(event.id);
      if(event.tenantId!==tenantId||!original||covered.has(event.id)||JSON.stringify(original)!==JSON.stringify(event))throw new Error('Changed pending source');
      if(event.groupId&&queue.some(item=>item.groupId===event.groupId&&!receiptIds.has(item.id)))throw new Error('Incomplete reviewed commit group');
      covered.add(event.id);
      if(receipt.choice==='server'&&accepted.has(event.id))throw new Error('Rejected source already accepted');
      if(receipt.choice==='local'){
        const replacementId=receipt.acceptedEventIds[index],replacement=accepted.get(replacementId);
        if(replacementIds.has(replacementId)||!replacement||replacement.tenantId!==tenantId||
          replacement.branchId!==event.branchId||replacement.entityType!==event.entityType||
          replacement.entityId!==event.entityId||replacement.action!==event.action||
          JSON.stringify(replacement.payload)!==JSON.stringify(event.payload))throw new Error('Invalid accepted replacement source');
        replacementIds.add(replacementId);
      }
    }
    archives.push(structuredClone(receipt));
  }
  if(covered.size!==queue.length)throw new Error('Pending dependent or unreviewed source remains');
  return {ledger:checkpoint?structuredClone(checkpoint):replayReviewedLedger(history,tenantId,{branches}),archivedEvents:structuredClone(queue),receipts:archives};
}

export function reviewedLedgerState(ledger,tenantId,cursor,activeBranchId){
  const backup={...ledger,version:4,tenantId,syncCursor:cursor,activeBranchId};
  return backupToState(validateBackup(backup,tenantId));
}

// Pure staging projection only. No storage or API writes. Unsupported sources
// reject the complete result; callers must never install a partial projection.
export function replayReviewedLedger(events,tenantId,{branches=[],checkpoint=null}={}){
  if(!Array.isArray(events)||typeof tenantId!=='string'||!tenantId)throw new Error('Invalid replay input');
  const result=checkpoint?structuredClone(checkpoint):{products:[],customers:[],suppliers:[],invoices:[],purchases:[],expenses:[],customerPayments:[],supplierPayments:[],
    branches:[],salesReturns:[],purchaseReturns:[],damagedItems:[],workers:[],workerTransactions:[],partners:[],partnerDrawings:[],
    profitDistributions:[],stockTransfers:[],expenseCategories:[],settings:structuredClone(INITIAL_SETTINGS)},seen=new Set();
  if(!checkpoint)result.branches=structuredClone(branches);
  const productChanges=new Map();
  const inspect=(value,depth=0)=>{
    if(depth>30)throw new Error('Invalid replay depth');
    if(!value||typeof value!=='object')return;
    for(const [key,item] of Object.entries(value)){
      if(['tenantId','tenant_id'].includes(key)&&item!==tenantId)throw new Error('Replay tenant mismatch');
      if(['password','password_hash','token','sessionToken','__proto__','constructor','prototype'].includes(key))throw new Error('Forbidden replay field');
      if(typeof item==='number'&&!Number.isFinite(item))throw new Error('Invalid replay amount');
      inspect(item,depth+1);
    }
  };
  const balance=(type,id,amount,branchId)=>{
    if(!amount||!id||['walk_in','walk-in'].includes(id))return;
    if(result[type].find(row=>row.id===id)?.branchId!==branchId)throw new Error('Missing or foreign branch account');
    result[type]=adjustBalance(result[type],id,amount);
  };
  for(const source of events){
    inspect(source);
    const event=structuredClone(source);
    if(event.entityType==='product'&&!event.branchId){
      const parent=events.find(row=>row.entityType==='invoice'&&row.action==='create'&&row.payload?.items?.some(item=>item.productId===event.entityId));
      const proof=parent&&proveLegacyProduct(events,parent.id,event.entityId);
      if(!proof)throw new Error('Ambiguous legacy product branch');
      event.branchId=proof.branchId;event.payload.branchId=proof.branchId;
    }
    const {id,entityId,entityType,action,payload,branchId}=event;
    if(!id||seen.has(id)||event.tenantId!==tenantId)throw new Error('Unsupported or repeated replay source');
    if(entityType==='settings'){
      if(action!=='update'||!payload||Array.isArray(payload))throw new Error('Unsupported settings source');
      seen.add(id);result.settings={...result.settings,...payload,
        ...(payload.openingCashDrawerFloatByBranch?{openingCashDrawerFloatByBranch:{...result.settings.openingCashDrawerFloatByBranch,...payload.openingCashDrawerFloatByBranch}}:{})};
      continue;
    }
    if(entityType==='restore_snapshot'){
      if(action!=='create'||payload?.id!==entityId)throw new Error('Unsupported restore source');
      seen.add(id);const saved=validateBackup(payload.snapshot,tenantId);
      Object.assign(result,Object.fromEntries([...BACKUP_ARRAY_FIELDS,'settings'].map(key=>[key,structuredClone(saved[key])])));continue;
    }
    const table=tables[entityType];
    if(!id||seen.has(id)||event.tenantId!==tenantId||!entityId||!table||!payload||Array.isArray(payload)||
      !['create','update','delete','void'].includes(action))throw new Error('Unsupported or repeated replay source');
    seen.add(id);
    if(entityType==='stock_transfer') {
      if(branchId || payload.branchId)throw new Error('Invalid transfer branch scope');
    } else if(entityType!=='branch'&&(!branchId||branchId==='all'||payload.branchId&&payload.branchId!==branchId))throw new Error('Invalid replay branch');
    if(payload.id!==entityId)throw new Error('Replay record identity mismatch');
    const existing=result[table].find(row=>row.id===entityId);
    if(action==='create'&&existing&&entityType==='branch'){result.branches=result.branches.map(row=>row.id===entityId?payload:row);continue;}
    if(action==='create'&&existing||action!=='create'&&!existing)throw new Error('Missing or duplicate replay record');
    if(existing&&entityType!=='branch'&&existing.branchId!==branchId)throw new Error('Replay branch ownership changed');
    if(action==='update'&&!['product','customer','supplier','branch','invoice','worker','partner'].includes(entityType))throw new Error('Unsupported financial record update');
    if(entityType==='invoice'&&action==='update')assertInvoiceUpdatePayload(payload);
    if(action==='void'&&entityType!=='invoice')throw new Error('Unsupported reversal');
    if(action==='void')assertInvoiceVoidPayload(payload);
    if(entityType==='product'&&event.groupId&&['create','update'].includes(action)&&Number.isFinite(Number(payload.currentStockKg))) {
      const key=`${event.groupId}:${entityId}`;
      if(productChanges.has(key))throw new Error('Repeated transfer stock source');
      productChanges.set(key,{branchId,delta:round(Number(payload.currentStockKg)-Number(existing?.currentStockKg||0)),action});
    }
    if(entityType==='invoice'){
      if(['delete','void'].includes(action)&&result.salesReturns.some(row=>row.invoiceId===entityId))throw new Error('Invoice has existing returns');
      const invoice=action==='create'?payload:existing;
      const direction=action==='create'?(payload.status==='voided'?0:-1):
        ['delete','void'].includes(action)&&existing.status!=='voided'?1:0;
      if(direction){
        result.products=applyInvoiceInventory(result.products,invoice,direction);
        balance('customers',invoice.customerId,-direction*Number(invoice.remainingDebt||0),branchId);
      }
    }else if(entityType==='purchase'&&['create','delete'].includes(action)){
      if(action==='delete'&&result.purchaseReturns.some(row=>row.purchaseId===entityId))throw new Error('Purchase has existing returns');
      const purchase=action==='create'?payload:existing,direction=action==='create'?1:-1;
      result.products=applyPurchaseInventory(result.products,purchase,direction);
      balance('suppliers',purchase.supplierId,direction*Number(purchase.creditAmount||0),branchId);
    }else if(['customer_payment','supplier_payment'].includes(entityType)&&['create','delete'].includes(action)){
      const payment=action==='create'?payload:existing;
      if(!Number.isFinite(Number(payment.amount))||Number(payment.amount)<=0)throw new Error('Invalid payment source');
      balance(entityType==='customer_payment'?'customers':'suppliers',payment.customerId||payment.supplierId,
        (action==='create'?-1:1)*Number(payment.amount),branchId);
      if(entityType==='supplier_payment'&&action==='delete')result.expenses=result.expenses.filter(row=>row.supplierPaymentId!==entityId);
    }else if(entityType==='sales_return'){
      const returned=action==='create'?payload:existing,direction=action==='create'?1:-1;
      const invoice=result.invoices.find(row=>row.id===returned.invoiceId);
      if(!invoice||invoice.status==='voided')throw new Error('Missing return invoice');
      result.invoices=applySalesReturnInvoice(result.invoices,returned,direction);
      result.products=applySalesReturnInventory(result.products,invoice,returned,direction);
      if(returned.refundMethod==='credit_deduction')balance('customers',returned.customerId,-direction*Number(returned.totalRefundAmount),branchId);
    }else if(entityType==='purchase_return'){
      const returned=action==='create'?payload:existing,direction=action==='create'?1:-1;
      const purchase=result.purchases.find(row=>row.id===returned.purchaseId);
      if(!purchase)throw new Error('Missing return purchase');
      result.purchases=applyPurchaseReturnPurchase(result.purchases,returned,direction);
      result.products=applyPurchaseReturnInventory(result.products,purchase,returned,direction);
      if(returned.refundMethod==='supplier_debt_deduction')balance('suppliers',purchase.supplierId,-direction*Number(returned.totalRefundAmount),branchId);
    }else if(entityType==='damaged_item'){
      const damage=action==='create'?payload:existing;
      result.products=applyDamageInventory(result.products,damage,action==='create'?1:-1);
    }else if(entityType==='worker_transaction'){
      const transaction=action==='create'?payload:existing;
      if(result.workers.find(row=>row.id===transaction.workerId)?.branchId!==branchId)throw new Error('Missing or foreign worker');
      result.workers=applyWorkerAdvance(result.workers,transaction,action==='create'?1:-1);
      if(action==='delete')result.expenses=result.expenses.filter(row=>row.workerTransactionId!==entityId);
    }else if(entityType==='stock_transfer'){
      if(action!=='create')throw new Error('Unsupported stock transfer reversal');
      if(payload.scopedProducts===true) {
        const source=productChanges.get(`${event.groupId}:${payload.sourceProductId}`);
        const destination=productChanges.get(`${event.groupId}:${payload.destinationProductId}`);
        const quantity=Number(payload.quantityKg);
        if(!event.groupId||source?.action!=='update'||source?.branchId!==payload.fromBranchId||
           destination?.branchId!==payload.toBranchId||source.delta!==-quantity||destination.delta!==quantity)
          throw new Error('Transfer stock pair does not match its atomic source group');
      }
      result.products=applyStockTransfer(result.products,result.branches,payload);
    }else if(entityType==='partner'&&action==='delete'){
      if(result.partnerDrawings.some(row=>row.partnerId===entityId)||result.profitDistributions.some(row=>(row.shares||[]).some(share=>share.partnerId===entityId)))throw new Error('Partner has existing drawings');
    }
    if(action==='create')result[table]=[payload,...result[table]];
    else if(action==='delete')result[table]=result[table].filter(row=>row.id!==entityId);
    else result[table]=result[table].map(row=>row.id===entityId?{...row,...payload}:row);
  }
  // Cash/bank reports must derive from these records using the application's
  // accounting reconciler, not a second set of formulas in this staging engine.
  for(const rows of Object.values(result).filter(Array.isArray))for(const row of rows)if(typeof row.balance==='number')row.balance=round(row.balance);
  return result;
}
