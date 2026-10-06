export const BACKUP_ARRAY_FIELDS = ['products','customers','invoices','expenses','expenseCategories','damagedItems','workers','workerTransactions','customerPayments','purchases','suppliers','supplierPayments','salesReturns','purchaseReturns','partners','partnerDrawings','profitDistributions','branches','stockTransfers'];

const STATE_FIELDS = {
  products:'khodar_pos_products_v3',customers:'khodar_pos_customers_v3',invoices:'khodar_pos_invoices_v3',
  expenses:'khodar_pos_expenses_v3',expenseCategories:'khodar_pos_expense_categories_v3',settings:'khodar_pos_settings_v3',
  damagedItems:'khodar_pos_damaged_v3',workers:'khodar_pos_workers_v3',workerTransactions:'khodar_pos_worker_transactions_v3',
  customerPayments:'khodar_pos_customer_payments_v3',purchases:'khodar_pos_purchases_v3',suppliers:'khodar_pos_suppliers_v3',
  supplierPayments:'khodar_pos_supplier_payments_v3',salesReturns:'khodar_pos_sales_returns_v3',purchaseReturns:'khodar_pos_purchase_returns_v3',
  partners:'khodar_pos_partners_v3',partnerDrawings:'khodar_pos_partner_drawings_v3',profitDistributions:'khodar_pos_profit_distributions_v3',
  branches:'khodar_pos_branches_v1',stockTransfers:'khodar_pos_stock_transfers_v1',activeBranchId:'khodar_pos_active_branch_id_v1'
};

export function validateBackup(data, tenantId) {
  if (!tenantId || data?.tenantId !== tenantId) throw new Error('النسخة لا تخص الشركة الحالية أو تفتقد هوية الشركة');
  if (data.version !== 4 || !Number.isSafeInteger(data.syncCursor) || data.syncCursor < 0)
    throw new Error('إصدار نسخة غير مدعوم أو مؤشر المزامنة مفقود؛ يلزم ترحيل آمن قبل الاستعادة');
  if (!data.settings || Array.isArray(data.settings) || typeof data.settings !== 'object') throw new Error('إعدادات النسخة غير مكتملة');
  const ids = {};
  for (const field of BACKUP_ARRAY_FIELDS) {
    if (!Array.isArray(data[field])) throw new Error('نسخة جزئية: '+field);
    if (field === 'expenseCategories') continue;
    ids[field] = new Set();
    for (const row of data[field]) {
      if (!row || typeof row.id !== 'string' || !row.id || ids[field].has(row.id)) throw new Error('معرف مفقود أو مكرر: '+field);
      ids[field].add(row.id);
    }
  }
  const inspect = (value, depth=0) => {
    if (depth>30) throw new Error('نسخة ذات بنية غير صالحة');
    if (!value || typeof value !== 'object') return;
    for (const [key,item] of Object.entries(value)) {
      if (['tenantId','tenant_id'].includes(key) && item !== tenantId) throw new Error('بيانات شركة أخرى داخل النسخة');
      if (['password','password_hash','token','sessionToken','__proto__','constructor','prototype'].includes(key)) throw new Error('تحتوي النسخة على حقول حساسة أو غير مسموحة');
      inspect(item,depth+1);
    }
  };
  inspect(data);
  const requireRef = (row, field, target, source, optional = false) => {
    const value = row?.[field];
    if (optional && (value === undefined || value === null || value === '')) return;
    if (typeof value !== 'string' || !ids[target].has(value)) throw new Error('علاقة مفقودة في النسخة: '+source+'.'+field);
  };
  const byId = Object.fromEntries(BACKUP_ARRAY_FIELDS.filter(field => field !== 'expenseCategories')
    .map(field => [field, new Map(data[field].map(row => [row.id, row]))]));
  const sameBranch = (row, field, target, source) => {
    const related = byId[target]?.get(row?.[field]);
    if (row?.branchId && related?.branchId && row.branchId !== related.branchId)
      throw new Error('علاقة بين فرعين مختلفين في النسخة: '+source+'.'+field);
  };
  for (const [field,reference,target] of [
    ['customerPayments','customerId','customers'],['supplierPayments','supplierId','suppliers'],
    ['workerTransactions','workerId','workers'],['partnerDrawings','partnerId','partners'],
    ['salesReturns','invoiceId','invoices'],['purchaseReturns','purchaseId','purchases']
  ]) for (const row of data[field]) {
    if (!ids[target].has(row[reference])) throw new Error('علاقة مفقودة في النسخة: '+field);
    sameBranch(row, reference, target, field);
  }
  for (const row of data.invoices) {
    if (row.customerId !== 'walk_in') requireRef(row,'customerId','customers','invoices',true);
    sameBranch(row,'customerId','customers','invoices');
    requireRef(row,'branchId','branches','invoices',true);
    if (!Array.isArray(row.items)) throw new Error('بنود فاتورة غير صالحة في النسخة');
    for (const item of row.items) {
      requireRef(item,'productId','products','invoices.items');
      if (row.branchId && byId.products.get(item.productId)?.branchId &&
          row.branchId !== byId.products.get(item.productId).branchId)
        throw new Error('علاقة بين فرعين مختلفين في النسخة: invoices.items.productId');
    }
  }
  for (const row of data.purchases) {
    requireRef(row,'productId','products','purchases');
    requireRef(row,'supplierId','suppliers','purchases',true);
    sameBranch(row,'productId','products','purchases');
    sameBranch(row,'supplierId','suppliers','purchases');
    requireRef(row,'branchId','branches','purchases',true);
  }
  for (const row of data.salesReturns) {
    requireRef(row,'invoiceId','invoices','salesReturns');
    sameBranch(row,'invoiceId','invoices','salesReturns');
    for (const item of row.returnedItems || []) requireRef(item,'productId','products','salesReturns.returnedItems');
  }
  for (const row of data.purchaseReturns) {
    requireRef(row,'purchaseId','purchases','purchaseReturns');
    requireRef(row,'productId','products','purchaseReturns',true);
    sameBranch(row,'purchaseId','purchases','purchaseReturns');
    sameBranch(row,'productId','products','purchaseReturns');
  }
  for (const row of data.damagedItems) {
    requireRef(row,'productId','products','damagedItems');
    sameBranch(row,'productId','products','damagedItems');
    requireRef(row,'branchId','branches','damagedItems',true);
  }
  for (const row of data.stockTransfers) {
    requireRef(row,'productId','products','stockTransfers');
    requireRef(row,'fromBranchId','branches','stockTransfers');
    requireRef(row,'toBranchId','branches','stockTransfers');
    if (row.fromBranchId === row.toBranchId) throw new Error('مناقلة مخزون بين الفرع نفسه');
  }
  for (const row of data.expenses) {
    requireRef(row,'branchId','branches','expenses',true);
    requireRef(row,'workerId','workers','expenses',true);
    requireRef(row,'supplierId','suppliers','expenses',true);
    sameBranch(row,'workerId','workers','expenses');
    sameBranch(row,'supplierId','suppliers','expenses');
  }
  for (const row of data.profitDistributions) {
    if (!Array.isArray(row.shares)) throw new Error('توزيع أرباح بلا حصص صالحة');
    for (const share of row.shares) requireRef(share,'partnerId','partners','profitDistributions.shares');
  }
  const monetaryName = /(?:amount|total|price|cost|balance|stock|quantity|weight|capital|payout|debt|advance|percentage|kg)$/i;
  const inspectMoney = (value, key = '', depth = 0) => {
    if (depth > 30 || value === null || value === undefined) return;
    if (Array.isArray(value)) return value.forEach(item => inspectMoney(item,'',depth+1));
    if (typeof value !== 'object') {
      if (typeof value !== 'boolean' && monetaryName.test(key) && (value === '' || !Number.isFinite(Number(value))))
        throw new Error('قيمة مالية أو كمية غير صالحة: '+key);
      return;
    }
    for (const [childKey,item] of Object.entries(value)) inspectMoney(item,childKey,depth+1);
  };
  inspectMoney(data);
  if (!data.activeBranchId || !ids.branches.has(data.activeBranchId)) throw new Error('الفرع النشط غير موجود في النسخة');
  return data;
}

export function backupToState(data) {
  return Object.fromEntries(Object.entries(STATE_FIELDS).map(([field,key])=>[key,structuredClone(data[field])]));
}
