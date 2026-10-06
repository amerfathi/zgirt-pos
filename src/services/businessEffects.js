import { MissingDependencyError } from './missingDependency.js';
const round = value => Math.round(value * 100) / 100;
const belongsToBranch = (product, branchId) => !product.branchId || product.branchId === branchId;

export function applyStockTransfer(products, branches, transfer) {
  const { fromBranchId, toBranchId, productId } = transfer;
  const quantity = Number(transfer.quantityKg);
  if (!Number.isFinite(quantity) || quantity <= 0 || round(quantity) !== quantity) throw new Error('كمية مناقلة غير صالحة');
  if (!fromBranchId || fromBranchId === toBranchId || !branches.some(b => b.id === fromBranchId) || !branches.some(b => b.id === toBranchId)) throw new Error('فروع المناقلة غير صالحة');
  // New branch-owned products are moved by two branch-scoped product events in
  // the same atomic group. The transfer event is the audit record, not a second
  // inventory effect. Legacy shared products retain their original projection.
  if (transfer.scopedProducts === true) {
    if (!transfer.sourceProductId || !transfer.destinationProductId ||
        transfer.sourceProductId !== productId ||
        transfer.sourceProductId === transfer.destinationProductId)
      throw new Error('ربط أصناف المناقلة غير صالح');
    return products;
  }
  if (products.filter(p => p.id === productId).length !== 1) throw new MissingDependencyError('صنف المناقلة غير موجود أو غير محدد');
  return products.map(product => {
    if (product.id !== productId) return product;
    const stocks = product.branchStock || {};
    const main = branches.find(b => b.isMain)?.id;
    const source = Number(stocks[fromBranchId] ?? (Object.keys(stocks).length === 0 && fromBranchId === main ? product.currentStockKg : 0));
    const destination = Number(stocks[toBranchId] ?? 0);
    if (!Number.isFinite(source) || !Number.isFinite(destination) || source < quantity) throw new Error('رصيد الفرع لا يكفي للمناقلة');
    return { ...product, branchStock: { ...stocks, [fromBranchId]: round(source - quantity), [toBranchId]: round(destination + quantity) } };
  });
}

export function applySalesReturnInventory(products, invoice, returned, direction) {
  if (returned.inventoryAction !== 'restock') return products;
  const branchId=invoice.branchId || 'branch-main';
  let next=products;
  for (const item of returned.items || []) {
    const quantity=Number(item.returnedWeight);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('كمية مردود مبيعات غير صالحة');
    const matches=next.filter(product => belongsToBranch(product, branchId) && (item.productId ? product.id === item.productId : product.name?.trim() === item.name?.trim()));
    if (matches.length !== 1) throw new MissingDependencyError('صنف مردود المبيعات غير موجود أو غير محدد');
    next=next.map(product => {
      if (product.id !== matches[0].id) return product;
      const stock=round(Number(product.currentStockKg || 0) + direction*quantity);
      const branchStock=product.branchStock || {};
      const branch=round(Number(branchStock[branchId] ?? product.currentStockKg ?? 0) + direction*quantity);
      if (stock < 0 || branch < 0) throw new Error('لا يمكن عكس المردود بعد استهلاك رصيده');
      return {...product,currentStockKg:stock,branchStock:{...branchStock,[branchId]:branch}};
    });
  }
  return next;
}

export function applySalesReturnInvoice(invoices, returned, direction) {
  const invoice=invoices.find(row => row.id === returned.invoiceId);
  if (!invoice) throw new MissingDependencyError('الفاتورة الأصلية للمردود غير موجودة');
  if (!['cash','bank','credit_deduction'].includes(returned.refundMethod) ||
      !['restock','damaged'].includes(returned.inventoryAction) ||
      !Array.isArray(returned.items) || returned.items.length === 0) throw new Error('بيانات مردود المبيعات غير صالحة');
  if (returned.inventoryAction === 'damaged') throw new Error('مردود التالف يتطلب قيد هالك مترابط؛ العملية موقوفة حتى اكتمال التسوية');
  const weights=new Map();
  let expectedAmount=0;
  for (const entry of returned.items || []) {
    const quantity=Number(entry.returnedWeight);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('كمية مردود مبيعات غير صالحة');
    const matches=invoice.items.map((item,index) => ({item,index})).filter(({item,index}) =>
      Number.isInteger(entry.sourceLineIndex) ? index === entry.sourceLineIndex :
        entry.productId ? item.productId === entry.productId : item.name?.trim() === entry.name?.trim());
    if (matches.length !== 1) throw new Error('سطر الفاتورة المرتبط بالمردود غير محدد');
    const index=matches[0].index;
    if (entry.productId && matches[0].item.productId !== entry.productId) throw new Error('صنف المردود لا يطابق سطر الفاتورة');
    expectedAmount=round(expectedAmount+round(quantity*Number(matches[0].item.pricePerKg || 0)));
    weights.set(index,round((weights.get(index) || 0)+quantity));
  }
  const amount=Number(returned.totalRefundAmount);
  if (!Number.isFinite(amount) || amount < 0 || round(amount) !== expectedAmount) throw new Error('قيمة مردود مبيعات لا تطابق الفاتورة');
  return invoices.map(row => {
    if (row.id !== invoice.id) return row;
    const items=row.items.map((item,index) => {
      const next=round(Number(item.returnedWeight || 0)+direction*(weights.get(index) || 0));
      const sold=Number(item.netWeight ?? item.grossWeight ?? 0);
      if (next < 0 || next > sold) throw new Error('المردود يتجاوز الكمية المباعة أو المثبتة');
      return {...item,returnedWeight:next};
    });
    const totalReturnedAmount=round(Number(row.totalReturnedAmount || 0)+direction*amount);
    if (totalReturnedAmount < 0) throw new Error('عكس المردود يتجاوز الرصيد المثبت');
    return {...row,items,hasReturns:totalReturnedAmount > 0,totalReturnedAmount,
      totalReturnedWeight:round(items.reduce((sum,item)=>sum+Number(item.returnedWeight || 0),0))};
  });
}

export function adjustBalance(rows, id, amount) {
  if (!id || !rows.some(row => row.id === id)) throw new MissingDependencyError('الحساب المرتبط بالحركة غير موجود');
  if (!Number.isFinite(Number(amount))) throw new Error('قيمة مالية غير صالحة');
  return rows.map(row => row.id === id ? { ...row, balance: round(Number(row.balance || 0) + Number(amount)) } : row);
}

export function applyPurchaseInventory(products, purchase, direction) {
  if (direction === 1 && purchase.inventorySeededWithPurchase === true) return products;
  const quantity = Number(purchase.quantityKg), cost = Number(purchase.costPerKg);
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(cost) || cost < 0) throw new Error('كمية أو تكلفة شراء غير صالحة');
  const matches = products.filter(product => belongsToBranch(product, purchase.branchId || 'branch-main') && (purchase.productId ? product.id === purchase.productId : product.name?.trim() === purchase.productName?.trim()));
  if (matches.length !== 1) throw new MissingDependencyError('الصنف المرتبط بالشراء غير موجود أو غير محدد');
  const id = matches[0].id, branch = purchase.branchId || 'branch-main';
  return products.map(product => {
    if (product.id !== id) return product;
    const previous = Number(product.currentStockKg) || 0;
    const next = round(previous + direction * quantity);
    const branchStock = product.branchStock || {};
    const nextBranch = round(Number(branchStock[branch] ?? previous) + direction * quantity);
    const previousCost = Number(product.costPerKg) || 0;
    const value = previous * previousCost + direction * quantity * cost;
    if (direction === -1 && (next < 0 || nextBranch < 0 || value < -0.005)) throw new Error('لا يمكن عكس التوريد بعد استهلاك رصيده دون تسوية مخزنية');
    return { ...product, currentStockKg: next, branchStock: { ...branchStock, [branch]: nextBranch },
      costPerKg: next > 0 ? round(value / next) : previousCost,
      ...(direction === 1 ? { lastPurchasePrice: cost } : {})
    };
  });
}

export function applyPurchaseReturnPurchase(purchases, returned, direction) {
  const purchase=purchases.find(row=>row.id===returned.purchaseId);
  if (!purchase) throw new MissingDependencyError('شحنة المشتريات الأصلية غير موجودة');
  const quantity=Number(returned.returnedKg);
  const price=Number(purchase.costPerKg);
  const amount=Number(returned.totalRefundAmount);
  if (!['supplier_debt_deduction','cash','bank'].includes(returned.refundMethod) ||
      !Number.isFinite(quantity) || quantity<=0 || round(quantity)!==quantity ||
      !Number.isFinite(price) || price<0 || round(quantity*price)!==amount ||
      (returned.productId && returned.productId!==purchase.productId) ||
      (returned.supplierId && returned.supplierId!==purchase.supplierId)) throw new Error('بيانات مردود المشتريات لا تطابق الشحنة');
  return purchases.map(row=>{
    if(row.id!==purchase.id) return row;
    const returnedKg=round(Number(row.returnedKg||0)+direction*quantity);
    const totalReturnedAmount=round(Number(row.totalReturnedAmount||0)+direction*amount);
    if(returnedKg<0 || returnedKg>Number(row.quantityKg) || totalReturnedAmount<0) throw new Error('المردود يتجاوز كمية الشحنة أو القيد المثبت');
    return {...row,returnedKg,totalReturnedAmount,hasReturns:returnedKg>0};
  });
}

export function applyPurchaseReturnInventory(products, purchase, returned, direction) {
  const quantity=Number(returned.returnedKg);
  if(!Number.isFinite(quantity) || quantity<=0) throw new Error('كمية مردود المشتريات غير صالحة');
  const matches=products.filter(row=>belongsToBranch(row, purchase.branchId || 'branch-main') && (purchase.productId ? row.id===purchase.productId : row.name?.trim()===purchase.productName?.trim()));
  if(matches.length!==1) throw new MissingDependencyError('صنف مردود المشتريات غير موجود أو غير محدد');
  return products.map(product=>{
    if(product.id!==matches[0].id) return product;
    const old=Number(product.currentStockKg||0);
    const branchId=purchase.branchId||'branch-main';
    const stocks=product.branchStock||{};
    const oldBranch=Number(stocks[branchId]??old);
    const next=round(old-direction*quantity);
    const nextBranch=round(oldBranch-direction*quantity);
    const value=old*Number(product.costPerKg||0)-direction*Number(returned.totalRefundAmount);
    if(next<0 || nextBranch<0 || value< -0.005) throw new Error('المخزون لا يكفي لمردود المشتريات');
    return {...product,currentStockKg:next,branchStock:{...stocks,[branchId]:nextBranch},
      costPerKg:next>0 ? round(value/next) : Number(product.costPerKg||0)};
  });
}

export function applyDamageInventory(products, damage, direction) {
  const quantity=Number(damage.quantityKg);
  const cost=Number(damage.costPerKg);
  if(!Number.isFinite(quantity) || quantity<=0 || round(quantity)!==quantity || !damage.branchId ||
      !Number.isFinite(cost) || cost<0 || round(quantity*cost)!==Number(damage.totalLoss)) throw new Error('قيد هالك غير صالح');
  const matches=products.filter(row=>belongsToBranch(row, damage.branchId) && (damage.productId ? row.id===damage.productId : row.name?.trim()===(damage.productName||damage.name)?.trim()));
  if(matches.length!==1) throw new MissingDependencyError('صنف الهالك غير موجود أو غير محدد');
  return products.map(product=>{
    if(product.id!==matches[0].id) return product;
    const old=Number(product.currentStockKg||0);
    const stocks=product.branchStock||{};
    const oldBranch=Number(stocks[damage.branchId]??old);
    const next=round(old-direction*quantity);
    const nextBranch=round(oldBranch-direction*quantity);
    if(next<0 || nextBranch<0) throw new Error('مخزون الفرع لا يكفي لقيد الهالك');
    return {...product,currentStockKg:next,branchStock:{...stocks,[damage.branchId]:nextBranch}};
  });
}

export function applyWorkerAdvance(workers, transaction, direction) {
  if (!workers.some(worker => worker.id === transaction.workerId)) throw new MissingDependencyError('الموظف المرتبط بالحركة غير موجود');
  const amount = Number(transaction.amount);
  const deducted = Number(transaction.deductedAdvance || 0);
  if (!['advance', 'salary_payment', 'absence_record'].includes(transaction.type) ||
      !Number.isFinite(amount) || amount < 0 ||
      (transaction.type === 'advance' && amount === 0) ||
      (transaction.type === 'absence_record' && amount !== 0) ||
      !Number.isFinite(deducted) || deducted < 0 ||
      (transaction.type !== 'salary_payment' && deducted !== 0) ||
      ![1, -1].includes(direction)) throw new Error('قيمة حركة الموظف غير صالحة');
  const delta = transaction.type === 'advance' ? amount : transaction.type === 'salary_payment' ? -deducted : 0;
  return workers.map(worker => {
    if (worker.id !== transaction.workerId) return worker;
    const next = round(Number(worker.currentAdvance || 0) + direction * delta);
    if (next < 0) throw new Error('الحركة تتجاوز رصيد سلف الموظف');
    return { ...worker, currentAdvance: next };
  });
}
