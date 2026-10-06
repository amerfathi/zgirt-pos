export const REPORT_REGISTRY = Object.freeze([
  ['executive','ReportsCenterView.jsx','all ledgers','owner summary','date'],
  ['pnl','ReportsCenterView.jsx','sales/returns/invoice locked costs/expenses/payroll/damage','income statement','date'],
  ['audit','ReportsCenterView.jsx','cash/bank/debts/inventory','financial position','current as-of'],
  ['partners','ReportsCenterView.jsx','partners/drawings/distributions','partner equity','current as-of'],
  ['sales','ReportsCenterView.jsx','invoices/sales returns','net sales','date'],
  ['margins','ReportsCenterView.jsx','invoice items/sales returns','locked-cost product margin','date'],
  ['aging','ReportsCenterView.jsx','customers/invoices/payments/credit returns','estimated FIFO receivable aging with unaged opening balance','current as-of'],
  ['customer','ReportsCenterView.jsx','customer invoices/payments/returns','customer statement','date'],
  ['products','ReportsCenterView.jsx','invoice items/sales returns','product movement','date'],
  ['purchases','ReportsCenterView.jsx','purchases/purchase returns','net purchases','date'],
  ['suppliers_ledger','ReportsCenterView.jsx','purchases/payments/purchase returns','supplier statement','date'],
  ['returns','ReportsCenterView.jsx','sales/purchase returns','returns register','date'],
  ['damaged','ReportsCenterView.jsx','damaged items','damage loss','date'],
  ['shrinkage','ReportsCenterView.jsx','purchases/sales/damage/returns','recorded weight movement; unrecorded shrinkage requires physical count','date'],
  ['shift','ReportsCenterView.jsx','all cash movements/opening float','current cash drawer reconciliation, not historical shift close','current as-of'],
  ['expenses','ReportsCenterView.jsx','unlinked expenses','operating expenses','date'],
  ['payroll','ReportsCenterView.jsx','worker transactions','payroll and advances','date']
].map(([id,source,dataSource,meaning,filters])=>Object.freeze({id,source,dataSource,meaning,filters,branchScope:'active authorized branch, or explicitly authorized aggregate view',tenantScope:'authenticated tenant'})));

const n=value=>Number.isFinite(Number(value))?Number(value):0;
const sum=(rows,select)=>rows.reduce((total,row)=>total+n(select(row)),0);
const round=value=>Math.round((value+Number.EPSILON)*100)/100;
const cents=value=>Math.round(n(value)*100);

export function buildReceivableAging(data,{asOfDate=new Date().toISOString().slice(0,10)}={}) {
  const asOf=Date.parse(`${asOfDate}T12:00:00Z`);
  const invoices=(data.invoices||[]).filter(row=>row.status!=='voided');
  const payments=data.customerPayments||[];
  const returns=(data.salesReturns||[]).filter(row=>row.refundMethod==='credit_deduction');
  const rows=[];
  for(const customer of data.customers||[]) {
    const balance=cents(customer.balance);
    if(balance<=0) continue;
    const customerInvoices=invoices.filter(row=>row.customerId===customer.id)
      .sort((a,b)=>`${a.date||''} ${a.time||''}`.localeCompare(`${b.date||''} ${b.time||''}`));
    const invoiceIds=new Set(customerInvoices.map(row=>row.id));
    const customerReturns=returns.filter(row=>row.customerId===customer.id || invoiceIds.has(row.invoiceId));
    const customerPayments=payments.filter(row=>row.customerId===customer.id);
    const returnByInvoice=new Map();
    for(const ret of customerReturns) returnByInvoice.set(ret.invoiceId,(returnByInvoice.get(ret.invoiceId)||0)+cents(ret.totalRefundAmount));
    const invoiceLots=customerInvoices.map(row=>({date:row.date||null,amount:cents(row.remainingDebt)- (returnByInvoice.get(row.id)||0)}));
    const opening=balance-invoiceLots.reduce((sum,row)=>sum+row.amount,0)+customerPayments.reduce((sum,row)=>sum+cents(row.amount),0);
    const uncertain=invoiceLots.some(row=>row.amount<0) || customerReturns.some(row=>!invoiceIds.has(row.invoiceId));
    const lots=uncertain?[{date:null,amount:balance}]:[{date:null,amount:Math.max(0,opening)},...invoiceLots];
    if(!uncertain) {
      let settlement=Math.max(0,-opening)+customerPayments.reduce((sum,row)=>sum+cents(row.amount),0);
      for(const lot of lots) {const applied=Math.min(lot.amount,settlement);lot.amount-=applied;settlement-=applied;}
      if(lots.reduce((sum,row)=>sum+row.amount,0)!==balance) {
        lots.length=0;lots.push({date:null,amount:balance});
      }
    }
    for(const lot of lots) {
      if(lot.amount<=0) continue;
      const invoiceTime=lot.date&&/^\d{4}-\d{2}-\d{2}$/.test(lot.date)?Date.parse(`${lot.date}T12:00:00Z`):NaN;
      const dated=Number.isFinite(invoiceTime)&&Number.isFinite(asOf)&&invoiceTime<=asOf;
      const diffDays=dated?Math.floor((asOf-invoiceTime)/86400000):null;
      const bucket=diffDays===null?'unknown':diffDays>30?'>30':diffDays>15?'16-30':diffDays>7?'8-15':'1-7';
      rows.push({id:`${customer.id}:${lot.date||'opening'}:${rows.length}`,customerId:customer.id,name:customer.name,
        phone:customer.phone||'—',balance:lot.amount/100,date:lot.date,diffDays,bucket,
        bucketLabel:bucket==='unknown'?'رصيد غير مؤرخ':bucket==='1-7'?'1 - 7 أيام (حديث)':bucket==='8-15'?'8 - 15 يوماً (متوسط)':bucket==='16-30'?'16 - 30 يوماً (متأخر)':'أكثر من 30 يوماً (حرج)',
        severity:bucket==='unknown'?'unknown':bucket==='1-7'?'low':bucket==='8-15'?'medium':bucket==='16-30'?'high':'critical'});
    }
  }
  return rows;
}

function datePredicate(filter,asOfDate) {
  if (filter==='all') return ()=>true;
  const end=new Date(`${asOfDate}T23:59:59.999`);
  const start=new Date(`${asOfDate}T00:00:00.000`);
  if(filter==='yesterday'){start.setDate(start.getDate()-1);end.setDate(end.getDate()-1);}
  if(filter==='week') start.setDate(start.getDate()-6);
  if(filter==='month') start.setDate(1);
  return row=>{if(!row?.date)return true;const date=new Date(`${String(row.date).slice(0,10)}T12:00:00`);return date>=start&&date<=end;};
}

export function buildReportSnapshot(data,{dateFilter='all',asOfDate=new Date().toISOString().slice(0,10),branchId='all'}={}) {
  const byDate=datePredicate(dateFilter,asOfDate);
  const scoped=row=>byDate(row)&&(branchId==='all'||row.branchId===branchId);
  const invoices=(data.invoices||[]).filter(row=>row.status!=='voided'&&scoped(row));
  const purchases=(data.purchases||[]).filter(scoped);
  const salesReturns=(data.salesReturns||[]).filter(scoped);
  const purchaseReturns=(data.purchaseReturns||[]).filter(scoped);
  const expenses=(data.expenses||[]).filter(scoped);
  const damage=(data.damagedItems||[]).filter(scoped);
  const workerTx=(data.workerTransactions||[]).filter(scoped);
  const customerPayments=(data.customerPayments||[]).filter(scoped);
  const supplierPayments=(data.supplierPayments||[]).filter(scoped);
  const drawings=(data.partnerDrawings||[]).filter(scoped);
  const distributions=(data.profitDistributions||[]).filter(scoped);
  const invoiceById=new Map((data.invoices||[]).map(row=>[row.id,row]));
  const purchaseById=new Map((data.purchases||[]).map(row=>[row.id,row]));
  const grossSales=sum(invoices,row=>row.finalTotal);
  const salesReturnAmount=sum(salesReturns,row=>row.totalRefundAmount);
  const netSales=round(grossSales-salesReturnAmount);
  const grossPurchases=sum(purchases,row=>row.totalCost);
  const purchaseReturnAmount=sum(purchaseReturns,row=>row.totalRefundAmount||n(row.returnedKg)*n(purchaseById.get(row.purchaseId)?.costPerKg));
  const netPurchases=round(grossPurchases-purchaseReturnAmount);
  const grossCogs=sum(invoices,row=>sum(row.items||[],item=>n(item.netWeight)*n(item.costPerKg)));
  const returnedCogs=sum(salesReturns,row=>{
    const invoice=invoiceById.get(row.invoiceId);
    return sum(row.items||row.returnedItems||[],item=>n(item.returnedWeight||item.quantityKg)*n(
      (Number.isInteger(item.sourceLineIndex)?invoice?.items?.[item.sourceLineIndex]:null)?.costPerKg ||
      (invoice?.items||[]).find(line=>line.productId===item.productId)?.costPerKg));
  });
  const cogs=round(grossCogs-returnedCogs);
  const operatingExpenses=sum(expenses,row=>!row.isSupplierPayment&&!row.isWorkerPayment?row.amount:0);
  const payroll=sum(workerTx,row=>row.type==='salary_payment'?row.amount:0);
  const advances=sum(workerTx,row=>row.type==='advance'?row.amount:0);
  const damageLoss=sum(damage,row=>row.totalLoss||n(row.quantityKg)*n(row.costPerKg));
  const grossProfit=round(netSales-cogs);
  const netProfit=round(grossProfit-operatingExpenses-payroll-damageLoss);
  const cashInvoice=sum(invoices,row=>row.cashAmount??(row.paymentMethod==='cash'?row.paidAmount:0));
  const bankInvoice=sum(invoices,row=>row.bankAmount??(row.paymentMethod==='bank'?row.paidAmount:0));
  const cash=round(n(data.settings?.openingCashDrawerFloat)+cashInvoice+
    sum(customerPayments,row=>row.method!=='bank'?row.amount:0)-
    sum(salesReturns,row=>row.refundMethod==='cash'?row.totalRefundAmount:0)+
    sum(purchaseReturns,row=>row.refundMethod==='cash'?row.totalRefundAmount:0)-
    sum(purchases,row=>row.paidCashAmount??row.cashAmount??(row.paymentMethod==='cash'?n(row.totalCost)-n(row.creditAmount):0))-
    sum(supplierPayments,row=>row.paymentMethod!=='bank'?row.amount:0)-
    sum(expenses,row=>!row.isSupplierPayment&&!row.isWorkerPayment&&row.paymentMethod!=='bank'?row.amount:0)-
    sum(workerTx,row=>row.paymentMethod!=='bank'&&['salary_payment','advance'].includes(row.type)?row.amount:0)-
    sum(drawings,row=>row.method!=='bank'&&row.source!=='bank'?row.amount:0)-
    sum(distributions,row=>sum(row.shares||[],share=>share.method!=='bank'?share.netPayout:0)));
  const bank=round(bankInvoice+sum(customerPayments,row=>row.method==='bank'?row.amount:0)-
    sum(salesReturns,row=>row.refundMethod==='bank'?row.totalRefundAmount:0)+
    sum(purchaseReturns,row=>row.refundMethod==='bank'?row.totalRefundAmount:0)-
    sum(purchases,row=>row.paidBankAmount??row.bankAmount??(row.paymentMethod==='bank'?n(row.totalCost)-n(row.creditAmount):0))-
    sum(supplierPayments,row=>row.paymentMethod==='bank'?row.amount:0)-
    sum(expenses,row=>!row.isSupplierPayment&&!row.isWorkerPayment&&row.paymentMethod==='bank'?row.amount:0)-
    sum(workerTx,row=>row.paymentMethod==='bank'&&['salary_payment','advance'].includes(row.type)?row.amount:0)-
    sum(drawings,row=>row.method==='bank'||row.source==='bank'?row.amount:0)-
    sum(distributions,row=>sum(row.shares||[],share=>share.method==='bank'?share.netPayout:0)));
  const inventoryQuantityKg=round(sum(data.products||[],row=>row.currentStockKg));
  const inventoryValue=round(sum(data.products||[],row=>n(row.currentStockKg)*n(row.costPerKg||row.costPrice)));
  return Object.freeze({registryIds:REPORT_REGISTRY.map(row=>row.id),grossSales,salesReturnAmount,netSales,
    grossPurchases,purchaseReturnAmount,netPurchases,cogs,grossProfit,operatingExpenses,payroll,advances,damageLoss,netProfit,
    cash,bank,customerReceivables:round(sum(data.customers||[],row=>row.balance)),supplierPayables:round(sum(data.suppliers||[],row=>row.balance)),
    inventoryQuantityKg,inventoryValue,invoiceCount:invoices.length,purchaseCount:purchases.length,
    salesReturnCount:salesReturns.length,purchaseReturnCount:purchaseReturns.length,expenseCount:expenses.length,
    payrollTransactionCount:workerTx.length,damagedCount:damage.length});
}
