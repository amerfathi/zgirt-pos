import { scopedStorageKey, withoutCredentials } from './tenantStorage.js';
import { branchCreateEvent } from './branchEvents.js';
import { verifyCloudCheckpoint, verifyServerBranches } from './legacyMigrationAudit.js';
import { applySalesReturnInvoice, applySalesReturnInventory, applyPurchaseInventory, applyPurchaseReturnPurchase, applyPurchaseReturnInventory, applyDamageInventory, applyStockTransfer, applyWorkerAdvance, adjustBalance } from './businessEffects.js';
import { applyInvoiceInventory } from './invoiceInventory.js';
import { backupToState, validateBackup } from './backupValidation.js';
import { applyAcceptedConflictEvent, attachConflictPreconditions, SYNC_HEADS_STATE_KEY } from './syncConflictPolicy.js';
import { isIndependentSale, isIndependentSalesQueue } from './independentSales.js';
import { stageReviewedResolution, reviewedLedgerState } from './reviewLedgerReplay.js';
import { canAccessBranch } from './branchAccess.js';

const clone = value => structuredClone(value);
export const INBOUND_REVIEW_KEY = 'braka_inbound_review_v1';
const LEGACY_BUSINESS_KEYS = [
  'khodar_pos_products_v3','khodar_pos_customers_v3','khodar_pos_invoices_v3',
  'khodar_pos_expenses_v3','khodar_pos_damaged_v3','khodar_pos_workers_v3',
  'khodar_pos_worker_transactions_v3','khodar_pos_customer_payments_v3',
  'khodar_pos_purchases_v3','khodar_pos_suppliers_v3','khodar_pos_supplier_payments_v3',
  'khodar_pos_sales_returns_v3','khodar_pos_purchase_returns_v3','khodar_pos_partners_v3',
  'khodar_pos_partner_drawings_v3','khodar_pos_profit_distributions_v3'
];
const FINANCIAL_EVENT_TYPES_BY_KEY = {
  khodar_pos_products_v3: ['product','invoice','purchase','sales_return','purchase_return','damaged_item','stock_transfer'],
  khodar_pos_customers_v3: ['customer','invoice','customer_payment','sales_return'],
  khodar_pos_invoices_v3: ['invoice','sales_return'],
  khodar_pos_expenses_v3: ['expense','supplier_payment','worker_transaction'],
  khodar_pos_damaged_v3: ['damaged_item'],
  khodar_pos_workers_v3: ['worker','worker_transaction'],
  khodar_pos_worker_transactions_v3: ['worker_transaction'],
  khodar_pos_customer_payments_v3: ['customer_payment'],
  khodar_pos_purchases_v3: ['purchase','purchase_return'],
  khodar_pos_suppliers_v3: ['supplier','purchase','supplier_payment','purchase_return'],
  khodar_pos_supplier_payments_v3: ['supplier_payment'],
  khodar_pos_partners_v3: ['partner'],
  khodar_pos_partner_drawings_v3: ['partner_drawing'],
  khodar_pos_profit_distributions_v3: ['profit_distribution'],
  khodar_pos_sales_returns_v3: ['sales_return'],
  khodar_pos_purchase_returns_v3: ['purchase_return'],
  khodar_pos_branches_v1: ['branch'],
  khodar_pos_stock_transfers_v1: ['stock_transfer'],
  khodar_pos_cash_shifts_v1: ['cash_shift'],
  khodar_pos_settings_v3: ['settings','invoice'] // invoice numbering is updated in the same sale commit
};
const DIRECT_RECORD_EVENT_BY_KEY = {
  khodar_pos_invoices_v3: 'invoice',
  khodar_pos_expenses_v3: 'expense',
  khodar_pos_damaged_v3: 'damaged_item',
  khodar_pos_worker_transactions_v3: 'worker_transaction',
  khodar_pos_customer_payments_v3: 'customer_payment',
  khodar_pos_purchases_v3: 'purchase',
  khodar_pos_supplier_payments_v3: 'supplier_payment',
  khodar_pos_sales_returns_v3: 'sales_return',
  khodar_pos_purchase_returns_v3: 'purchase_return',
  khodar_pos_partner_drawings_v3: 'partner_drawing',
  khodar_pos_profit_distributions_v3: 'profit_distribution',
  khodar_pos_stock_transfers_v1: 'stock_transfer',
  khodar_pos_cash_shifts_v1: 'cash_shift'
};
const DIRECT_RECORD_KEY_BY_EVENT = Object.fromEntries(
  Object.entries(DIRECT_RECORD_EVENT_BY_KEY).map(([key, type]) => [type, key]));

function recordMap(rows, key) {
  if (!Array.isArray(rows)) throw new Error(`سجل مالي غير صالح (${key})؛ لم تُحفظ العملية`);
  const byId = new Map();
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || !row.id || byId.has(row.id))
      throw new Error(`معرّفات سجل مالي غير صالحة أو مكررة (${key})؛ لم تُحفظ العملية`);
    byId.set(row.id, row);
  }
  return byId;
}

function matchesLinkedReturnProjection(key, id, oldRow, newRow, before, events) {
  const sales = key === 'khodar_pos_invoices_v3';
  const purchases = key === 'khodar_pos_purchases_v3';
  if (!sales && !purchases) return false;
  const directType = sales ? 'invoice' : 'purchase';
  const returnKey = sales ? 'khodar_pos_sales_returns_v3' : 'khodar_pos_purchase_returns_v3';
  const returnType = sales ? 'sales_return' : 'purchase_return';
  const foreignKey = sales ? 'invoiceId' : 'purchaseId';
  const effect = sales ? applySalesReturnInvoice : applyPurchaseReturnPurchase;
  const priorReturns = recordMap(before.state[returnKey] ?? [], returnKey);
  let projected = oldRow, matched = false;
  for (const event of events) {
    if (event.entityType === directType && event.entityId === id) {
      if (event.action === 'create' && !projected) projected = event.payload;
      else if (['update', 'void'].includes(event.action) && projected) projected = { ...projected, ...event.payload };
      else if (event.action === 'delete' && projected) projected = undefined;
      else return false;
      continue;
    }
    if (event.entityType !== returnType || !['create', 'delete'].includes(event.action)) continue;
    const returned = event.action === 'create' ? event.payload : priorReturns.get(event.entityId);
    if (returned?.[foreignKey] !== id) continue;
    if (!projected) return false;
    projected = effect([projected], returned, event.action === 'create' ? 1 : -1)[0];
    matched = true;
  }
  return matched && JSON.stringify(projected) === JSON.stringify(newRow);
}

function assertInventoryProjection(before, after, events) {
  if (!events.length || !Array.isArray(before.state.khodar_pos_products_v3)) return;
  const invoices = recordMap(before.state.khodar_pos_invoices_v3 ?? [], 'khodar_pos_invoices_v3');
  const salesReturns = recordMap(before.state.khodar_pos_sales_returns_v3 ?? [], 'khodar_pos_sales_returns_v3');
  const purchases = recordMap(before.state.khodar_pos_purchases_v3 ?? [], 'khodar_pos_purchases_v3');
  const purchaseReturns = recordMap(before.state.khodar_pos_purchase_returns_v3 ?? [], 'khodar_pos_purchase_returns_v3');
  const damages = recordMap(before.state.khodar_pos_damaged_v3 ?? [], 'khodar_pos_damaged_v3');
  const branches = recordMap(before.state.khodar_pos_branches_v1 ?? [], 'khodar_pos_branches_v1');
  let products = before.state.khodar_pos_products_v3;
  for (const event of events) {
    if (event.entityType === 'product') {
      const prior = products.find(product => product.id === event.entityId);
      if (event.action === 'create' && !prior) products = [event.payload, ...products];
      else if (event.action === 'update' && prior) products = products.map(product =>
        product.id === event.entityId ? { ...product, ...event.payload } : product);
      else if (event.action === 'delete' && prior) products = products.filter(product => product.id !== event.entityId);
      else throw new Error('تغير صنف غير مرتبط بمعاملة المخزون؛ لم تُحفظ العملية');
      continue;
    }
    if (event.entityType === 'branch') {
      if (event.action === 'create') branches.set(event.entityId, event.payload);
      else if (event.action === 'update') branches.set(event.entityId, { ...branches.get(event.entityId), ...event.payload });
      else if (event.action === 'delete') branches.delete(event.entityId);
      continue;
    }
    if (event.entityType === 'sales_return') {
      const returned = event.action === 'create' ? event.payload : salesReturns.get(event.entityId);
      const invoice = invoices.get(returned?.invoiceId);
      if (!invoice || !['create', 'delete'].includes(event.action) ||
          (event.action === 'create' && salesReturns.has(event.entityId)) ||
          (event.action === 'delete' && !returned))
        throw new Error('مردود مبيعات غير مرتبط بمعاملة المخزون؛ لم تُحفظ العملية');
      products = applySalesReturnInventory(products, invoice, returned, event.action === 'create' ? 1 : -1);
      if (event.action === 'create') salesReturns.set(event.entityId, returned);
      else salesReturns.delete(event.entityId);
      continue;
    }
    if (event.entityType === 'invoice') {
      const prior = invoices.get(event.entityId);
      if (event.action === 'create') {
        if (prior) throw new Error('فاتورة مكررة في معاملة المخزون؛ لم تُحفظ العملية');
        products = applyInvoiceInventory(products, event.payload, -1);
        invoices.set(event.entityId, event.payload);
      } else if (event.action === 'void') {
        if (!prior) throw new Error('فاتورة الإلغاء غير موجودة؛ لم تُحفظ العملية');
        if (prior.status !== 'voided') products = applyInvoiceInventory(products, prior, 1);
        invoices.set(event.entityId, { ...prior, ...event.payload });
      } else if (event.action === 'delete') {
        if (prior?.status !== 'voided' && prior) products = applyInvoiceInventory(products, prior, 1);
        invoices.delete(event.entityId);
      } else if (event.action === 'update' && prior) {
        invoices.set(event.entityId, { ...prior, ...event.payload });
      }
      continue;
    }
    if (event.entityType === 'purchase_return') {
      const returned = event.action === 'create' ? event.payload : purchaseReturns.get(event.entityId);
      const purchase = purchases.get(returned?.purchaseId);
      if (!purchase || !['create', 'delete'].includes(event.action) ||
          (event.action === 'create' && purchaseReturns.has(event.entityId)) ||
          (event.action === 'delete' && !returned))
        throw new Error('مردود مشتريات غير مرتبط بمعاملة المخزون؛ لم تُحفظ العملية');
      products = applyPurchaseReturnInventory(products, purchase, returned, event.action === 'create' ? 1 : -1);
      if (event.action === 'create') purchaseReturns.set(event.entityId, returned);
      else purchaseReturns.delete(event.entityId);
      continue;
    }
    if (event.entityType === 'purchase') {
      const prior = purchases.get(event.entityId);
      if (event.action === 'create') {
        if (prior || (event.payload?.inventorySeededWithPurchase === true &&
            !events.some(item => item.entityType === 'product' && item.action === 'create' && item.entityId === event.payload.productId)))
          throw new Error('توريد بلا حدث إنشاء صنف مرتبط أو فاتورة مكررة؛ لم تُحفظ العملية');
        products = applyPurchaseInventory(products, event.payload, 1);
        if (event.payload.sellingPricePerKg && event.payload.inventorySeededWithPurchase !== true)
          products = products.map(product =>
            (event.payload.productId ? product.id === event.payload.productId : product.name?.trim() === event.payload.productName?.trim())
              ? { ...product, defaultPricePerKg: Number(event.payload.sellingPricePerKg) } : product);
        purchases.set(event.entityId, event.payload);
      } else if (event.action === 'delete') {
        if (!prior) throw new Error('توريد عكس المخزون غير موجود؛ لم تُحفظ العملية');
        products = applyPurchaseInventory(products, prior, -1);
        purchases.delete(event.entityId);
      }
      continue;
    }
    if (event.entityType === 'damaged_item') {
      const prior = damages.get(event.entityId);
      if (event.action === 'create' && !prior) {
        products = applyDamageInventory(products, event.payload, 1);
        damages.set(event.entityId, event.payload);
      } else if (event.action === 'delete' && prior) {
        products = applyDamageInventory(products, prior, -1);
        damages.delete(event.entityId);
      } else throw new Error('قيد هالك غير مرتبط بمعاملة المخزون؛ لم تُحفظ العملية');
      continue;
    }
    if (event.entityType === 'stock_transfer')
      products = applyStockTransfer(products, [...branches.values()], event.payload);
  }
  if (JSON.stringify(products) !== JSON.stringify(after.state.khodar_pos_products_v3))
    throw new Error('مخزون المنتجات لا يطابق أحداثه؛ لم تُحفظ العملية');
}

function assertCustomerBalanceProjection(before, after, events) {
  if (!events.length || !Array.isArray(before.state.khodar_pos_customers_v3)) return;
  let customers = before.state.khodar_pos_customers_v3;
  const invoices = recordMap(before.state.khodar_pos_invoices_v3 ?? [], 'khodar_pos_invoices_v3');
  const payments = recordMap(before.state.khodar_pos_customer_payments_v3 ?? [], 'khodar_pos_customer_payments_v3');
  const returns = recordMap(before.state.khodar_pos_sales_returns_v3 ?? [], 'khodar_pos_sales_returns_v3');
  const invoiceDebt = (invoice, direction) => {
    if (invoice?.customerId && invoice.customerId !== 'walk_in' && Number(invoice.remainingDebt) > 0)
      customers = adjustBalance(customers, invoice.customerId, direction * Number(invoice.remainingDebt));
  };
  for (const event of events) {
    const prior = event.entityType === 'invoice' ? invoices.get(event.entityId) : null;
    if (event.entityType === 'customer') {
      if (event.action === 'create') customers = [event.payload, ...customers];
      else if (event.action === 'update') customers = customers.map(row =>
        row.id === event.entityId ? { ...row, ...event.payload } : row);
      else if (event.action === 'delete') customers = customers.filter(row => row.id !== event.entityId);
    } else if (event.entityType === 'invoice') {
      if (event.action === 'create') { invoiceDebt(event.payload, 1); invoices.set(event.entityId, event.payload); }
      else if (event.action === 'void') {
        if (prior?.status !== 'voided') invoiceDebt(prior, -1);
        if (prior) invoices.set(event.entityId, { ...prior, ...event.payload });
      } else if (event.action === 'delete') {
        if (prior?.status !== 'voided') invoiceDebt(prior, -1);
        invoices.delete(event.entityId);
      } else if (event.action === 'update' && prior) invoices.set(event.entityId, { ...prior, ...event.payload });
    } else if (event.entityType === 'customer_payment') {
      const payment = event.action === 'create' ? event.payload : payments.get(event.entityId);
      if (!payment) throw new Error('إيصال عميل بلا قيد أصلي؛ لم تُحفظ العملية');
      customers = adjustBalance(customers, payment.customerId, (event.action === 'create' ? -1 : 1) * Number(payment.amount));
      if (event.action === 'create') payments.set(event.entityId, payment);
      else if (event.action === 'delete') payments.delete(event.entityId);
    } else if (event.entityType === 'sales_return') {
      const returned = event.action === 'create' ? event.payload : returns.get(event.entityId);
      if (!returned) throw new Error('مردود عميل بلا قيد أصلي؛ لم تُحفظ العملية');
      if (returned.refundMethod === 'credit_deduction' && returned.customerId && returned.customerId !== 'walk_in')
        customers = adjustBalance(customers, returned.customerId,
          (event.action === 'create' ? -1 : 1) * Number(returned.totalRefundAmount));
      if (event.action === 'create') returns.set(event.entityId, returned);
      else if (event.action === 'delete') returns.delete(event.entityId);
    }
  }
  if (JSON.stringify(customers) !== JSON.stringify(after.state.khodar_pos_customers_v3))
    throw new Error('رصيد العملاء لا يطابق أحداثه؛ لم تُحفظ العملية');
}

function assertSupplierBalanceProjection(before, after, events) {
  if (!events.length || !Array.isArray(before.state.khodar_pos_suppliers_v3)) return;
  let suppliers = before.state.khodar_pos_suppliers_v3;
  const purchases = recordMap(before.state.khodar_pos_purchases_v3 ?? [], 'khodar_pos_purchases_v3');
  const payments = recordMap(before.state.khodar_pos_supplier_payments_v3 ?? [], 'khodar_pos_supplier_payments_v3');
  const returns = recordMap(before.state.khodar_pos_purchase_returns_v3 ?? [], 'khodar_pos_purchase_returns_v3');
  const purchaseDebt = (purchase, direction) => {
    if (purchase?.supplierId && Number(purchase.creditAmount) > 0)
      suppliers = adjustBalance(suppliers, purchase.supplierId, direction * Number(purchase.creditAmount));
  };
  for (const event of events) {
    if (event.entityType === 'supplier') {
      if (event.action === 'create') suppliers = [event.payload, ...suppliers];
      else if (event.action === 'update') suppliers = suppliers.map(row =>
        row.id === event.entityId ? { ...row, ...event.payload } : row);
      else if (event.action === 'delete') suppliers = suppliers.filter(row => row.id !== event.entityId);
    } else if (event.entityType === 'purchase') {
      const prior = purchases.get(event.entityId);
      if (event.action === 'create') { purchaseDebt(event.payload, 1); purchases.set(event.entityId, event.payload); }
      else if (event.action === 'delete') { purchaseDebt(prior, -1); purchases.delete(event.entityId); }
    } else if (event.entityType === 'supplier_payment') {
      const payment = event.action === 'create' ? event.payload : payments.get(event.entityId);
      if (!payment) throw new Error('دفعة مورد بلا قيد أصلي؛ لم تُحفظ العملية');
      suppliers = adjustBalance(suppliers, payment.supplierId, (event.action === 'create' ? -1 : 1) * Number(payment.amount));
      if (event.action === 'create') payments.set(event.entityId, payment);
      else if (event.action === 'delete') payments.delete(event.entityId);
    } else if (event.entityType === 'purchase_return') {
      const returned = event.action === 'create' ? event.payload : returns.get(event.entityId);
      const purchase = purchases.get(returned?.purchaseId);
      if (!returned || !purchase) throw new Error('مردود مورد بلا شحنة أصلية؛ لم تُحفظ العملية');
      if (returned.refundMethod === 'supplier_debt_deduction')
        suppliers = adjustBalance(suppliers, purchase.supplierId,
          (event.action === 'create' ? -1 : 1) * Number(returned.totalRefundAmount));
      if (event.action === 'create') returns.set(event.entityId, returned);
      else if (event.action === 'delete') returns.delete(event.entityId);
    }
  }
  if (JSON.stringify(suppliers) !== JSON.stringify(after.state.khodar_pos_suppliers_v3))
    throw new Error('رصيد الموردين لا يطابق أحداثه؛ لم تُحفظ العملية');
}

function assertWorkerAdvanceProjection(before, after, events) {
  if (!events.length || !Array.isArray(before.state.khodar_pos_workers_v3)) return;
  let workers = before.state.khodar_pos_workers_v3;
  const transactions = recordMap(before.state.khodar_pos_worker_transactions_v3 ?? [], 'khodar_pos_worker_transactions_v3');
  for (const event of events) {
    if (event.entityType === 'worker') {
      if (event.action === 'create') workers = [event.payload, ...workers];
      else if (event.action === 'update') workers = workers.map(row =>
        row.id === event.entityId ? { ...row, ...event.payload } : row);
      else if (event.action === 'delete') workers = workers.filter(row => row.id !== event.entityId);
    } else if (event.entityType === 'worker_transaction') {
      const transaction = event.action === 'create' ? event.payload : transactions.get(event.entityId);
      if (!transaction) throw new Error('حركة عامل بلا قيد أصلي؛ لم تُحفظ العملية');
      workers = applyWorkerAdvance(workers, transaction, event.action === 'create' ? 1 : -1);
      if (event.action === 'create') transactions.set(event.entityId, transaction);
      else if (event.action === 'delete') transactions.delete(event.entityId);
    }
  }
  if (JSON.stringify(workers) !== JSON.stringify(after.state.khodar_pos_workers_v3))
    throw new Error('رصيد سلف العامل لا يطابق أحداثه؛ لم تُحفظ العملية');
}

// The legacy path commits one aggregate through Storage.setItem, but a Chrome
// process-stop test proves that acknowledgement is not crash-durable. The new
// IndexedDB path only reports success after its aggregate transaction completes.
// Web Locks are mandatory: localStorage has no cross-window compare-and-swap.
export class AtomicStore {
  constructor(user, initialState, storage = globalThis.localStorage, { durableFirst = false } = {}) {
    this.accessUser=user?withoutCredentials(clone(user)):null;
    this.user = user ? { id: user.id, tenantId: user.tenantId,
      syncScopeVersion: Number.isSafeInteger(Number(user.syncScopeVersion)) && Number(user.syncScopeVersion) > 0
        ? Number(user.syncScopeVersion) : 0 } : null;
    this.key = scopedStorageKey('atomic_v1', this.user);
    this.storage = storage;
    this.listeners = new Set();
    this.writable = false;
    this.draft = null;
    this.failure = null;
    this.lifecycle = 0;
    this.durableFirst = durableFirst;
    this.lastRaw = this.key ? storage.getItem(this.key) : null;
    const tenantQueue = this.getLegacyTenantQueue();
    if (durableFirst) {
      this.value = { schema: 1, identity: this.user, revision: 0,
        state: withoutCredentials(clone(initialState)), outbox: [], cursor: 0, applied: {} };
      this.validate(this.value);
    } else if (this.lastRaw !== null) {
      this.value = JSON.parse(this.lastRaw);
      this.validate(this.value);
      this.checkLegacyAgainst(this.value, tenantQueue);
    } else {
      this.checkLegacyBeforeSeed(tenantQueue);
      this.value = { schema: 1, identity: this.user, revision: 0,
        state: withoutCredentials(clone(initialState)),
        outbox: [],
        cursor: 0, applied: {} };
      this.validate(this.value);
    }
  }

  getLegacyTenantQueue() {
    const oldQueue = this.user ? JSON.parse(this.storage.getItem('khodar_offline_sync_queue') || '[]') : [];
    if (!Array.isArray(oldQueue)) throw new Error('طابور قديم غير صالح؛ لم تُحذف البيانات');
    return oldQueue.filter(event => event?.tenantId === this.user?.tenantId);
  }
  checkLegacyAgainst(value, tenantQueue) {
    const conflict = tenantQueue.find(event => {
      const saved = value.outbox.find(item => item.id === event.id);
      return saved && ['tenantId','branchId','entityType','entityId','action','payload'].some(key =>
        JSON.stringify(saved[key] ?? null) !== JSON.stringify(event[key] ?? null));
    });
    if (conflict) throw new Error('تعارض حركة قديمة مع السجل الذري؛ لم تُحذف البيانات ويلزم فحصها قبل المزامنة');
    const pendingLegacy = tenantQueue.filter(event =>
      (!event.userId || event.userId === this.user?.id) &&
      !value.applied[event.id] && !value.outbox.some(saved => saved.id === event.id));
    if (pendingLegacy.length) throw new Error('حركات قديمة غير مُرحّلة؛ لم تُحذف البيانات، ويلزم استردادها قبل متابعة هذا الحساب');
  }
  checkDurableAgainstCache(saved, raw) {
    if (raw === null) return;
    let cache;
    try { cache = JSON.parse(raw); }
    catch { return; } // Unparseable compatibility bytes cannot displace authoritative IndexedDB.
    this.validate(cache); // Parseable but invalid evidence needs explicit recovery, not silent dismissal.
    if (cache.revision > saved.revision ||
        (cache.revision === saved.revision && JSON.stringify(cache) !== JSON.stringify(saved)))
      throw new Error('نسخة محلية أحدث أو مختلفة عن السجل الدائم؛ لم تُحذف البيانات ويلزم فحصها قبل المتابعة');
    if (cache.cursor > saved.cursor || Object.keys(cache.applied).some(id => cache.applied[id] === true && saved.applied[id] !== true))
      throw new Error('مؤشر أو حدث مستلم موجود في النسخة المحلية فقط؛ لم تُحذف البيانات ويلزم استرداده قبل المتابعة');
    const unknown = cache.outbox.find(event => !saved.applied[event.id] &&
      !saved.outbox.some(item => item.id === event.id));
    if (unknown) throw new Error('حدث مالي موجود في النسخة المحلية فقط؛ لم تُحذف البيانات ويلزم استرداده قبل المتابعة');
  }
  checkLegacyBeforeSeed(tenantQueue) {
    // A cursor without its matching business snapshot/applied IDs cannot prove
    // what was received. Reusing it in a new aggregate could skip money events.
    const cursorKey = `braka_sync_cursor_v2_${this.user?.tenantId}_${this.user?.id}`;
    const oldCursor = this.user ? this.storage.getItem(cursorKey) : null;
    if (oldCursor !== null && oldCursor !== '0')
      throw new Error('مؤشر مزامنة قديم بلا سجل مالي مطابق؛ لم يُنسخ، ويلزم استرداد البيانات قبل المتابعة');
    if (this.user && LEGACY_BUSINESS_KEYS.some(key => this.storage.getItem(scopedStorageKey(key, this.user)) !== null))
      throw new Error('بيانات مالية قديمة للحساب بلا سجل تجميعي أو أحداث مزامنة مثبتة؛ لم تُحذف، ويلزم استردادها قبل المتابعة');
    if (this.user && LEGACY_BUSINESS_KEYS.some(key => this.storage.getItem(key) !== null &&
        this.storage.getItem(scopedStorageKey(key, this.user)) === null))
      throw new Error('بيانات مالية قديمة بلا هوية موثوقة؛ لم تُنقل أو تُحذف، ويلزم استردادها قبل إنشاء سجل جديد');
    if (tenantQueue.some(event => !event.id || !event.userId))
      throw new Error('طابور قديم بلا مالك موثوق؛ لم تُنقل أو تُحذف الحركات، ويلزم استردادها تحت هوية صاحبها');
    if (tenantQueue.some(event => event.userId === this.user?.id))
      throw new Error('طابور قديم منسوب للحساب دون إثبات أثره المالي المحلي؛ لم تُنقل أو تُحذف الحركات، ويلزم استردادها');
  }

  validate(value) {
    if (value?.schema !== 1 || value.identity?.id !== this.user?.id || value.identity?.tenantId !== this.user?.tenantId ||
        Number(value.identity?.syncScopeVersion || 0) !== Number(this.user?.syncScopeVersion || 0) ||
        !value.state || !Array.isArray(value.outbox) || !value.applied || !Number.isSafeInteger(value.cursor) || value.cursor < 0 ||
        !Number.isSafeInteger(value.revision) || value.revision < 0 ||
        value.outbox.some(event => !event?.id || event.tenantId !== this.user?.tenantId)) {
      throw new Error('سجل محلي غير صالح أو يخص حسابًا آخر؛ لم تُحذف البيانات');
    }
  }

  validateDurableOutbox(value) {
    const seen = new Set();
    const lastDirectAction = new Map();
    for (const event of value.outbox) {
      if (seen.has(event.id) || typeof event.entityType !== 'string' || !event.entityType ||
          typeof event.entityId !== 'string' || !event.entityId ||
          typeof event.action !== 'string' || !event.action ||
          !event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload) ||
          (event.action === 'create' && event.payload.id !== event.entityId) ||
          value.applied[event.id] !== true ||
          (event.payload.tenantId && event.payload.tenantId !== this.user?.tenantId))
        throw new Error('طابور السجل المراد ترحيله غير متسق مع الحركات المالية؛ لم تُحذف البيانات');
      seen.add(event.id);
      const key = DIRECT_RECORD_KEY_BY_EVENT[event.entityType];
      if (key && Object.hasOwn(value.state, key))
        lastDirectAction.set(`${key}:${event.entityId}`, { key, event });
    }
    const records = new Map();
    for (const { key, event } of lastDirectAction.values()) {
      if (!records.has(key)) records.set(key, recordMap(value.state[key], key));
      const exists = records.get(key).has(event.entityId);
      if ((event.action === 'delete' && exists) || (event.action !== 'delete' && !exists))
        throw new Error('حركة مالية معلّقة بلا سجل محلي مطابق؛ لم تُرحّل البيانات');
    }
  }

  assertFinancialMutationHasProvenance(before, after) {
    if (this.user?.tenantId === 'tenant-demo') return;
    if(this.reviewInstallation){
      const expected=this.reviewInstallation;
      if(Object.entries(expected.state).some(([key,value])=>JSON.stringify(after.state[key])!==JSON.stringify(value))||
        after.cursor!==expected.cursor||after.outbox.length||JSON.stringify(after.applied)!==JSON.stringify(expected.applied))
        throw new Error('Reviewed checkpoint changed before commit');
      return;
    }
    const restore = this.txEvents?.find(event => event.entityType === 'restore_snapshot');
    if (restore) {
      if (this.txEvents.at(-1) !== restore || restore.action !== 'create' || restore.payload?.id !== restore.entityId)
        throw new Error('حدث الاستعادة غير صالح أو تبعته حركة في الدفعة نفسها؛ لم تُحفظ العملية');
      const expected = backupToState(validateBackup(restore.payload.snapshot, this.user.tenantId));
      if (Object.entries(expected).some(([key,value]) => JSON.stringify(after.state[key]) !== JSON.stringify(value)))
        throw new Error('حالة الاستعادة لا تطابق النسخة المرفقة؛ لم تُحفظ العملية');
      return;
    }
    for (const [key, allowedTypes] of Object.entries(FINANCIAL_EVENT_TYPES_BY_KEY)) {
      if (JSON.stringify(before.state[key]) === JSON.stringify(after.state[key])) continue;
      if (key === 'khodar_pos_branches_v1' && this.manifestBranchRepair === true) continue;
      if (!allowedTypes.some(type => this.txEventTypes?.has(type)))
        throw new Error(`تغير مالي بلا حدث مزامنة مرتبط (${key})؛ لم تُحفظ العملية`);
      const directType = DIRECT_RECORD_EVENT_BY_KEY[key];
      if (!directType) continue; // Derived balances/stock still need business-effect reconciliation.
      const previous = recordMap(key === 'khodar_pos_cash_shifts_v1' ? (before.state[key] ?? []) : before.state[key], key);
      const next = recordMap(after.state[key], key);
      for (const id of new Set([...previous.keys(), ...next.keys()])) {
        const oldRow = previous.get(id), newRow = next.get(id);
        if (JSON.stringify(oldRow) === JSON.stringify(newRow)) continue;
        const related = this.txEvents.some(event => {
          if (event.entityType === directType && event.entityId === id) {
            if (!oldRow && newRow) return event.action === 'create' && JSON.stringify(event.payload) === JSON.stringify(newRow);
            if (oldRow && !newRow) return event.action === 'delete';
            if (event.action === 'update' || event.action === 'void')
              return JSON.stringify({ ...oldRow, ...event.payload }) === JSON.stringify(newRow);
            return false;
          }
          if (key === 'khodar_pos_expenses_v3' && event.entityType === 'supplier_payment')
            return event.action === 'delete' && oldRow?.supplierPaymentId === event.entityId;
          if (key === 'khodar_pos_expenses_v3' && event.entityType === 'worker_transaction')
            return event.action === 'delete' && (oldRow?.workerTransactionId === event.entityId || id === `exp-${event.entityId}`);
          return false;
        });
        if (!related && !matchesLinkedReturnProjection(key, id, oldRow, newRow, before, this.txEvents))
          throw new Error(`تغير سجل مالي بلا حدث يطابق معرّفه (${key}: ${id})؛ لم تُحفظ العملية`);
      }
    }
    assertInventoryProjection(before, after, this.txEvents);
    assertCustomerBalanceProjection(before, after, this.txEvents);
    assertSupplierBalanceProjection(before, after, this.txEvents);
    assertWorkerAdvanceProjection(before, after, this.txEvents);
  }

  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  notify() {
    for (const listener of this.listeners) {
      try { listener(); } catch (error) { console.error('Committed storage observer failed', error); }
    }
  }
  get current() { return this.draft || this.value; }
  read(key) { return this.current.state[key]; }

  acquire(locks = globalThis.navigator?.locks, durable = null) {
    if (!this.key) return Promise.resolve(false);
    if (this.durableFirst && !durable) return Promise.reject(new Error('هذا السجل يتطلب قاعدة الحفظ الدائم'));
    if (!locks) return Promise.reject(new Error('هذا المتصفح لا يدعم قفل التخزين الآمن؛ استخدم متصفحًا مدعومًا'));
    const lifecycle = ++this.lifecycle;
    const previous = this.lockTask;
    let resolveReady, rejectReady;
    const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    this.lockTask = (async () => {
      await previous;
      if (lifecycle !== this.lifecycle) { resolveReady(false); return; }
      await locks.request(this.key, { ifAvailable: true }, async lock => {
        if (!lock || lifecycle !== this.lifecycle) { resolveReady(false); return; }
        const latest = this.storage.getItem(this.key);
        if (durable) {
          const saved = await durable.read(this.key);
          if (lifecycle !== this.lifecycle) { resolveReady(false); return; }
          if (saved) {
            this.validate(saved);
            this.validateDurableOutbox(saved);
            this.checkLegacyAgainst(saved, this.getLegacyTenantQueue());
            this.checkDurableAgainstCache(saved, latest);
            this.value = saved;
          } else {
            if (latest !== null) throw new Error('السجل المحلي القديم يتطلب ترحيلًا متحققًا قبل استخدام الحفظ الدائم');
            this.checkLegacyBeforeSeed(this.getLegacyTenantQueue());
            const seed = withoutCredentials(this.value);
            const savedSeed = await durable.commit(this.key, seed, null);
            this.validate(savedSeed);
            if (JSON.stringify(savedSeed) !== JSON.stringify(seed))
              throw new Error('قاعدة الحفظ الدائم لم تؤكد نفس السجل الأولي؛ لم تُفتح العمليات المالية');
            this.value = savedSeed;
          }
          if (lifecycle !== this.lifecycle) { resolveReady(false); return; }
          this.durable = durable;
          this.lastRaw = latest;
        } else {
          if (latest !== this.lastRaw) {
            this.value = JSON.parse(latest);
            this.validate(this.value);
            this.lastRaw = latest;
          }
        }
        this.writable = true;
        if (!durable) this.transact(() => {}); // Atomic, non-destructive legacy adoption.
        const held = new Promise(resolve => { this.releaseLock = () => resolve(undefined); });
        resolveReady(true);
        await held;
        if (lifecycle === this.lifecycle) this.writable = false;
      });
    })().catch(error => { this.writable = false; rejectReady(error); });
    return ready;
  }
  async archiveConflictingCache(durable, locks = globalThis.navigator?.locks) {
    if (!this.durableFirst || this.writable || !this.key || !durable?.archiveCache || !locks)
      throw new Error('استرداد السجل غير متاح الآن');
    return locks.request(this.key, { ifAvailable: true }, async lock => {
      if (!lock) throw new Error('هذا الحساب مفتوح في نافذة أخرى؛ أغلقها قبل الاسترداد');
      const raw = this.storage.getItem(this.key);
      if (raw === null) throw new Error('لا توجد نسخة محلية مختلفة لاستردادها');
      const cache = JSON.parse(raw);
      this.validate(cache);
      if (cache.outbox.length || this.getLegacyTenantQueue().some(event =>
        event.userId === this.user?.id && !cache.applied[event.id]))
        throw new Error('توجد حركات مالية محلية معلقة؛ يلزم فحصها قبل المتابعة');
      const saved = await durable.read(this.key);
      this.validate(saved);
      this.validateDurableOutbox(saved);
      if (cache.cursor > saved.cursor || Object.keys(cache.applied).some(id =>
        cache.applied[id] === true && saved.applied[id] !== true))
        throw new Error('توجد حركات مستلمة في النسخة المحلية فقط؛ يلزم فحصها قبل المتابعة');
      for (const key of Object.keys(DIRECT_RECORD_EVENT_BY_KEY)) {
        const cachedRows = cache.state[key] ?? [];
        const durableRows = saved.state[key] ?? [];
        if (!Array.isArray(cachedRows) || !Array.isArray(durableRows))
          throw new Error('شكل سجل مالي غير متوقع؛ يلزم فحصه قبل المتابعة');
        const durableIds = new Set(durableRows.map(row => row?.id));
        if (cachedRows.some(row => !row?.id || !durableIds.has(row.id)))
          throw new Error('توجد سجلات مالية في النسخة المحلية فقط؛ يلزم فحصها قبل المتابعة');
      }
      let divergent = false;
      try { this.checkDurableAgainstCache(saved, raw); }
      catch (error) {
        if (!error.message.includes('نسخة محلية أحدث أو مختلفة')) throw error;
        divergent = true;
      }
      if (!divergent) throw new Error('لا يوجد تعارض يتطلب أرشفة');
      if (this.storage.getItem(this.key) !== raw)
        throw new Error('تغير السجل المحلي أثناء الفحص؛ أعد المحاولة');
      const archiveKey = await durable.archiveCache(this.key, raw, saved.revision);
      if (this.storage.getItem(this.key) !== raw)
        throw new Error('تغير السجل المحلي بعد الأرشفة؛ لم يُزل من التخزين القديم');
      this.storage.removeItem(this.key);
      if (this.storage.getItem(this.key) !== null)
        throw new Error('أُرشف السجل المحلي لكن تعذّر إخلاء النسخة القديمة');
      return archiveKey;
    });
  }
  async close() {
    this.lifecycle++;
    this.writable = false;
    const closingTask = this.lockTask;
    const release = this.releaseLock;
    this.releaseLock = null;
    try { await this.pendingCommit; } catch { /* The initiating transaction reports the failure. */ }
    release?.();
    this.closing = closingTask;
    await this.closing;
  }

  // Explicit migration step for a scoped aggregate already acquired under its
  // Web Lock. Callers must complete UI/sync async conversion before using it.
  async adoptExistingAggregate(durable) {
    if (!this.writable || !this.key || !this.lastRaw || this.draft || this.pendingCommit || this.durable)
      throw new Error('السجل المحلي غير جاهز لترحيل آمن');
    if (!durable?.adoptIfEmpty) throw new Error('قاعدة الحفظ الدائم غير جاهزة');
    if (this.storage.getItem(this.key) !== this.lastRaw || JSON.stringify(this.value) !== this.lastRaw)
      throw new Error('تغير السجل المحلي أثناء التحضير للترحيل');
    const snapshot = clone(this.value);
    try {
      this.validateDurableOutbox(snapshot);
      this.pendingCommit = Promise.resolve(durable.adoptIfEmpty(this.key, snapshot));
    }
    catch (error) { this.pendingCommit = Promise.reject(error); }
    try {
      const saved = await this.pendingCommit;
      this.validate(saved);
      if (JSON.stringify(saved) !== JSON.stringify(withoutCredentials(snapshot)))
        throw new Error('الترحيل لم يحفظ نفس السجل المحلي');
      this.durable = durable;
      this.failure = null;
      return saved;
    } catch (error) {
      this.failure = error.message;
      this.writable = false; // Never silently resume the crash-unsafe writer.
      throw error;
    } finally {
      this.pendingCommit = null;
      this.notify();
    }
  }

  async adoptCloudCheckedAggregate(durable, fetchPage, fetchBranches) {
    if (!this.writable || !this.lastRaw || this.durable)
      throw new Error('السجل المحلي غير جاهز لفحص الترحيل');
    const sourceRaw = this.lastRaw;
    const snapshot = clone(this.value);
    try {
      const audit = await verifyCloudCheckpoint(snapshot, fetchPage);
      const branchAudit = await verifyServerBranches(snapshot, fetchBranches);
      if (this.storage.getItem(this.key) !== sourceRaw || JSON.stringify(this.value) !== sourceRaw)
        throw new Error('تغير السجل المحلي أثناء فحص الخادم؛ لم يبدأ الترحيل');
      const saved = await this.adoptExistingAggregate(durable);
      return { saved, audit, branchAudit };
    } catch (error) {
      this.failure = error.message;
      this.writable = false;
      this.notify();
      throw error;
    }
  }

  transact(action) {
    if (this.draft) return action(); // Nested business operations join this commit.
    if (this.durable) throw new Error('الحفظ الدائم يتطلب انتظار تأكيد قاعدة البيانات');
    if (this.pendingCommit) throw new Error('عملية حفظ دائم سابقة لم تكتمل بعد');
    if (!this.writable || !this.key) throw new Error('الحفظ غير متاح: أغلق النافذة الأخرى أو انتظر جاهزية التخزين');
    this.draft = clone(this.value);
    this.groupId = crypto.randomUUID();
    this.txEventTypes = new Set();
    this.txEvents = [];
    try {
      const result = action();
      if (result?.then) throw new Error('Local transactions must not await network operations');
      if (result?.success === false) return result;
      if (JSON.stringify(withoutCredentials(this.draft)) === this.lastRaw) return result;
      this.draft.revision++;
      this.validate(this.draft);
      this.assertFinancialMutationHasProvenance(this.value, this.draft);
      const next = withoutCredentials(this.draft);
      const raw = JSON.stringify(next);
      // Defense against legacy/noncooperating writers; Web Lock handles cooperating windows.
      if (this.storage.getItem(this.key) !== this.lastRaw) throw new Error('تغيرت البيانات من نافذة أخرى؛ أعد فتح التطبيق قبل الحفظ');
      this.storage.setItem(this.key, raw); // Legacy synchronous commit; not crash-durable.
      this.value = next;
      this.lastRaw = raw;
      this.failure = null;
      return result;
    } catch (error) {
      this.failure = error.message;
      throw error;
    } finally {
      this.draft = null;
      this.groupId = null;
      this.txEventTypes = null;
      this.txEvents = null;
      this.notify();
    }
  }

  async transactDurable(action, durable = this.durable) {
    if (this.draft || this.pendingCommit) throw new Error('عملية حفظ دائم سابقة لم تكتمل بعد');
    if (!this.writable || !this.key) throw new Error('الحفظ غير متاح: أغلق النافذة الأخرى أو انتظر جاهزية التخزين');
    if (!durable) throw new Error('قاعدة الحفظ الدائم غير جاهزة');
    this.draft = clone(this.value);
    this.groupId = crypto.randomUUID();
    this.txEventTypes = new Set();
    this.txEvents = [];
    let result, next;
    try {
      result = action();
      if (result?.then) throw new Error('Local transactions must not await network operations');
      if (result?.success === false || JSON.stringify(withoutCredentials(this.draft)) === JSON.stringify(this.value)) return result;
      this.draft.revision++;
      this.validate(this.draft);
      this.assertFinancialMutationHasProvenance(this.value, this.draft);
      next = withoutCredentials(this.draft);
    } catch (error) {
      this.failure = error.message;
      throw error;
    } finally {
      this.draft = null;
      this.groupId = null;
      this.txEventTypes = null;
      this.txEvents = null;
    }
    const expectedRevision = this.value.revision;
    try { this.pendingCommit = Promise.resolve(durable.commit(this.key, next, expectedRevision)); }
    catch (error) { this.pendingCommit = Promise.reject(error); }
    try {
      const saved = await this.pendingCommit;
      this.validate(saved);
      if (JSON.stringify(saved) !== JSON.stringify(next)) {
        this.writable = false;
        throw new Error('قاعدة الحفظ الدائم أكدت سجلًا مختلفًا؛ أعد فتح التطبيق قبل أي عملية مالية');
      }
      this.value = saved;
      this.failure = null;
      // This is a compatibility cache; IndexedDB is authoritative for this path.
      try {
        const raw = JSON.stringify(saved);
        this.storage.setItem(this.key, raw);
        this.lastRaw = raw;
      } catch (error) { console.error('Durable aggregate cache update failed', error); }
      return result;
    } catch (error) {
      this.failure = error.message;
      throw error;
    } finally {
      this.pendingCommit = null;
      this.notify();
    }
  }

  set(key, update) {
    return this.transact(() => {
      const previous = this.draft.state[key];
      this.draft.state[key] = typeof update === 'function' ? update(previous) : update;
    });
  }
  repairBranchContextFromManifest(branchesKey, selectedKey, manifest) {
    const existing = this.read(branchesKey);
    const incoming = manifest?.branches;
    if (!manifest?.fullTenantVisibility || manifest.tenantId !== this.user.tenantId ||
        !Number.isSafeInteger(manifest.latestSequence) || manifest.latestSequence < this.value.cursor ||
        !Array.isArray(incoming) || !incoming.length || !Array.isArray(existing) ||
        this.value.outbox.length || incoming.some(branch => !branch || typeof branch.id !== 'string' ||
          !branch.id || branch.tenantId !== this.user.tenantId) ||
        new Set(incoming.map(branch => branch.id)).size !== incoming.length ||
        existing.some(branch => !branch || branch.tenantId !== this.user.tenantId))
      throw new Error('تعذر التحقق من فروع الشركة؛ احتُفظ بالسجل المحلي دون تغيير');
    const known = new Set(incoming.map(branch => branch.id));
    if (existing.some(branch => !known.has(branch.id)))
      throw new Error('يوجد فرع محلي غير مسجل في الخادم؛ احتُفظ بالسجل المحلي دون تغيير');
    for (const value of Object.values(this.value.state)) {
      if (!Array.isArray(value)) continue;
      for (const row of value) {
        if (!row || typeof row !== 'object') continue;
        for (const key of ['branchId', 'fromBranchId', 'toBranchId', 'sourceBranchId', 'destinationBranchId']) {
          if (row[key] != null && row[key] !== 'all' && !known.has(row[key]))
            throw new Error('توجد بيانات مرتبطة بفرع غير معروف؛ احتُفظ بالسجل المحلي دون تغيير');
        }
      }
    }
    const selected = this.read(selectedKey);
    const replacement = known.has(selected) ? selected :
      (incoming.find(branch => branch.isMain && branch.status === 'active') ||
        incoming.find(branch => branch.status === 'active'))?.id;
    if (!replacement) throw new Error('لا يوجد فرع نشط موثوق؛ احتُفظ بالسجل المحلي دون تغيير');
    const action = () => {
      this.draft.state[branchesKey] = clone(incoming);
      this.draft.state[selectedKey] = replacement;
    };
    this.manifestBranchRepair = true;
    try { return this.durable ? this.transactDurable(action) : this.transact(action); }
    finally { this.manifestBranchRepair = false; }
  }
  initializeConflictPolicy(conflictHeads, latestSequence) {
    const action=()=>{
      if (Object.hasOwn(this.draft.state,SYNC_HEADS_STATE_KEY)) return false;
      if (!Number.isSafeInteger(latestSequence) || latestSequence !== this.draft.cursor)
        throw new Error('توجد حركات سحابية أحدث؛ لم تُعد تهيئة طابور هذا الجهاز');
      if (!conflictHeads || typeof conflictHeads !== 'object' || Array.isArray(conflictHeads) ||
          Object.entries(conflictHeads).some(([key,value])=>!key || typeof value!=='string' || !value))
        throw new Error('رؤوس تعارض الخادم غير صالحة؛ لم تُعد تهيئة الطابور');
      const heads=clone(conflictHeads);
      this.draft.outbox=this.draft.outbox.map(item=>{
        const clean={...item};delete clean.preconditions;delete clean.conflictPolicyVersion;
        return attachConflictPreconditions(clean,heads);
      });
      this.draft.state[SYNC_HEADS_STATE_KEY]=heads;
      return true;
    };
    return this.durable ? this.transactDurable(action) : this.transact(action);
  }
  branchBootstrapBatch(key, normalized, start, serverHeads = null) {
    this.draft.state[key] = normalized;
    for (const branch of normalized.slice(start, start + 100)) {
      // Another replica may already have registered this server-provisioned branch.
      // Recreating its deterministic event ID with a new commit group would be
      // rejected as an idempotency conflict and block later financial events.
      if (this.draft.state[SYNC_HEADS_STATE_KEY]?.[`record:branch:${branch.id}`] ||
          serverHeads?.[`record:branch:${branch.id}`]) continue;
      const event = branchCreateEvent(this.user.tenantId, branch);
      if (!this.draft.applied[event.id] && !this.draft.outbox.some(item => item.entityType === 'branch' && item.entityId === branch.id && item.action === 'create')) this.enqueue(event);
    }
    // Register inherited branches before older queued financial operations.
    this.draft.outbox = [
      ...this.draft.outbox.filter(event => event.entityType === 'branch' && event.action === 'create'),
      ...this.draft.outbox.filter(event => event.entityType !== 'branch' || event.action !== 'create')
    ];
  }
  getNormalizedBranches(key) {
    const branches = this.read(key);
    if (!Array.isArray(branches)) throw new Error('سجل الفروع المحلي غير صالح');
    if (branches.some(branch => !branch || typeof branch.id !== 'string' ||
        branch.tenantId !== this.user.tenantId))
      throw new Error('فروع محلية لا تخص هذه الشركة؛ لم تُنقل أو تُزامن تلقائيًا وتحتاج مراجعة ترحيل');
    return branches.map(branch => ({ ...branch, tenantId: this.user.tenantId }));
  }
  bootstrapBranches(key, serverHeads = null) {
    const normalized = this.getNormalizedBranches(key);
    for (let start = 0; start < Math.max(normalized.length, 1); start += 100) {
      this.transact(() => this.branchBootstrapBatch(key, normalized, start, serverHeads));
    }
  }
  async bootstrapBranchesDurable(key, serverHeads = null) {
    const normalized = this.getNormalizedBranches(key);
    for (let start = 0; start < Math.max(normalized.length, 1); start += 100) {
      await this.transactDurable(() => this.branchBootstrapBatch(key, normalized, start, serverHeads));
    }
  }
  enqueue(event) {
    if (!this.draft) throw new Error('Mutation must be recorded inside its business transaction');
    if (event.tenantId !== this.user.tenantId) throw new Error('Mutation tenant mismatch');
    if (event.action === 'create' && event.payload?.id !== event.entityId) throw new Error('Create event identity mismatch');
    if (Object.hasOwn(this.draft.state,SYNC_HEADS_STATE_KEY)) {
      const heads={...(this.draft.state[SYNC_HEADS_STATE_KEY] || {})};
      event=attachConflictPreconditions(event,heads);
      this.draft.state[SYNC_HEADS_STATE_KEY]=heads;
    }
    const old = this.draft.outbox.find(item => item.id === event.id);
    if (old) {
      const comparable = ({ timestamp, groupId, ...item }) => item;
      if (JSON.stringify(comparable(old)) !== JSON.stringify(comparable(event))) throw new Error('Idempotency conflict');
      return;
    }
    if (this.draft.outbox.filter(item => item.groupId === this.groupId).length >= 100) throw new Error('عملية واحدة تتجاوز حد دفعة المزامنة الآمنة');
    this.draft.outbox.push(clone({ ...event, groupId: this.groupId }));
    this.txEventTypes.add(event.entityType);
    this.txEvents.push(clone(event));
    // This event's local business effects are part of this same commit.
    this.draft.applied[event.id] = true;
  }
  replaceOutboxWithRestore(event) {
    if (!this.draft) throw new Error('الاستعادة تتطلب معاملة ذرية');
    this.draft.outbox = [];
    this.enqueue(event);
  }
  acknowledge(ids) {
    this.transact(() => { this.draft.outbox = this.draft.outbox.filter(event => !ids.has(event.id)); });
  }
  acknowledgeDurable(ids, durable = this.durable) {
    return this.transactDurable(() => { this.draft.outbox = this.draft.outbox.filter(event => !ids.has(event.id)); }, durable);
  }
  applyReceive(events, cursor, apply, serverHeads, partialVisibility = false) {
    if (!Number.isSafeInteger(cursor) || cursor < this.draft.cursor) throw new Error('Invalid sync cursor');
    for (const event of events) {
      if (!event?.id || event.tenantId !== this.user.tenantId) throw new Error('Inbound tenant or identity mismatch');
      if (event.action === 'create' && event.payload?.id !== event.entityId) throw new Error('Inbound create identity mismatch');
      if (this.draft.applied[event.id] || (Number.isSafeInteger(event.sequence) &&
          event.sequence<=Number(this.draft.state.braka_reviewed_cursor_fence_v1||0))) continue;
      if (cursor === this.draft.cursor) throw new Error('New inbound event requires a newer sync cursor');
      // Pre-policy history remains readable during upgrade. The first v1 event
      // starts the causal chain; thereafter missing policy is always rejected.
      if (!Object.hasOwn(this.draft.state,SYNC_HEADS_STATE_KEY) && event.conflictPolicyVersion === 1)
        this.draft.state[SYNC_HEADS_STATE_KEY]={};
      if (Object.hasOwn(this.draft.state,SYNC_HEADS_STATE_KEY)) {
        const heads={...(this.draft.state[SYNC_HEADS_STATE_KEY] || {})};
        if (!partialVisibility) applyAcceptedConflictEvent(event,heads);
        this.draft.state[SYNC_HEADS_STATE_KEY]=heads;
      }
      apply([event]);
      this.txEventTypes.add(event.entityType);
      this.txEvents.push(clone(event));
      this.draft.applied[event.id] = true;
    }
    if (serverHeads !== undefined) {
      if (!serverHeads || typeof serverHeads!=='object' || Array.isArray(serverHeads) ||
          Object.entries(serverHeads).some(([key,value])=>!key || typeof value!=='string' || !value))
        throw new Error('رؤوس تعارض الخادم غير صالحة؛ لم يتقدم مؤشر المزامنة');
      const localHeads=this.draft.state[SYNC_HEADS_STATE_KEY] || {};
      if (!partialVisibility && Object.entries(localHeads).some(([key,value])=>serverHeads[key]!==value))
        throw new Error('تغيرت رؤوس تعارض الخادم أثناء السحب؛ أعد المزامنة');
      this.draft.state[SYNC_HEADS_STATE_KEY]=clone(serverHeads);
    }
    this.draft.cursor = cursor;
  }
  receive(events, cursor, apply, serverHeads, partialVisibility = false) {
    return this.transact(() => this.applyReceive(events, cursor, apply, serverHeads, partialVisibility));
  }
  receiveDurable(events, cursor, apply, serverHeads, partialVisibility = false) {
    return this.transactDurable(() => this.applyReceive(events, cursor, apply, serverHeads, partialVisibility));
  }
  applyResilientReceive(events, cursor, apply, serverHeads, partialVisibility, retryReferences = true) {
    const supported = new Set([...Object.values(FINANCIAL_EVENT_TYPES_BY_KEY).flat(),'restore_snapshot']);
    if (!Array.isArray(events) || events.some(event => !supported.has(event?.entityType)))
      throw new Error('حركة مزامنة غير مدعومة؛ لم يتقدم مؤشر الاستقبال');
    const previousApplied = clone(this.draft.applied);
    // Validate the transport/tenant/causal envelope before allowing business
    // failures to be isolated. A cursor denotes durable receipt, not posting.
    const previousTypes = new Set(this.txEventTypes), previousEvents = [...this.txEvents];
    this.applyReceive(events, cursor, () => {}, serverHeads, partialVisibility);
    this.draft.applied = previousApplied;
    this.txEventTypes = previousTypes;
    this.txEvents = previousEvents;
    const pending = clone(this.draft.state[INBOUND_REVIEW_KEY] || []);
    const known = new Map(pending.flatMap(group => group.events.map(event => [event.id,event])));
    const groups = [...pending];
    for (const event of events) {
      if (previousApplied[event.id] || (Number.isSafeInteger(event.sequence) &&
          event.sequence<=Number(this.draft.state.braka_reviewed_cursor_fence_v1||0))) continue;
      if (known.has(event.id)) {
        if (JSON.stringify(known.get(event.id)) !== JSON.stringify(event)) throw new Error('Inbound retained identity changed');
        continue;
      }
      const key = event.groupId || event.id;
      let group = groups.find(group => group.key === key);
      if (!group) { group = { key, events: [] }; groups.push(group); }
      group.events.push(clone(event));
      known.set(event.id,event);
    }
    const retained = [];
    let referenceProgress = false;
    for (const group of groups) {
      // Baseline reference creates may unlock missing dependencies. Never
      // reorder later financial effects across an unresolved earlier group.
      const referenceOnly = group.events.every(event => event.action === 'create' &&
        ['product','customer','supplier','worker','partner','branch'].includes(event.entityType));
      if (retained.length && !referenceOnly) {
        retained.push({ ...group, error: 'توجد حركة سابقة تحتاج مراجعة قبل تطبيق هذه المجموعة' });
        continue;
      }
      const before = clone(this.draft), types = new Set(this.txEventTypes), history = [...this.txEvents];
      try {
        this.txEventTypes = new Set(group.events.map(event => event.entityType));
        this.txEvents = clone(group.events);
        apply(group.events);
        this.validate(this.draft);
        this.assertFinancialMutationHasProvenance(before, this.draft);
        if (referenceOnly) referenceProgress = true;
        for (const event of group.events) this.draft.applied[event.id] = true;
        this.txEventTypes = new Set([...types,...this.txEventTypes]);
        this.txEvents = [...history,...this.txEvents];
      } catch (error) {
        this.draft = before;
        this.txEventTypes = types;
        this.txEvents = history;
        if (error.code !== 'MISSING_DEPENDENCY') throw error;
        retained.push({ ...group, error: error.message });
      }
    }
    this.draft.state[INBOUND_REVIEW_KEY] = retained;
    if (retryReferences && referenceProgress && retained.length)
      this.applyResilientReceive([],cursor,apply,serverHeads,partialVisibility,false);
  }
  receiveResilient(events, cursor, apply, serverHeads, partialVisibility = false) {
    return this.transact(() => this.applyResilientReceive(events, cursor, apply, serverHeads, partialVisibility));
  }
  receiveResilientDurable(events, cursor, apply, serverHeads, partialVisibility = false) {
    return this.transactDurable(() => this.applyResilientReceive(events, cursor, apply, serverHeads, partialVisibility));
  }
  recoverLegacyProducts(proofs, apply) {
    const action=()=>{
      if(!Array.isArray(proofs)||proofs.length>50||this.draft.outbox.length)throw new Error('Invalid dependency recovery');
      const pending=(this.draft.state[INBOUND_REVIEW_KEY]||[]).flatMap(group=>group.events);
      for(const proof of proofs){
        const {source,parent,branchId}=proof || {};
        const localParent=pending.find(event=>event.id===parent?.id);
        if(proof.protocol!=='legacy-product-reference-v1'||source?.tenantId!==this.user.tenantId||parent?.tenantId!==this.user.tenantId||
          !localParent||localParent.branchId!==branchId||JSON.stringify(localParent.payload)!==JSON.stringify(parent.payload)||
          source.entityType!=='product'||source.action!=='create'||source.branchId||source.payload?.branchId||
          source.payload?.id!==source.entityId||!Number.isSafeInteger(source.sequence)||source.sequence>=parent.sequence||
          !localParent.payload.items?.some(item=>item.productId===source.entityId)||
          !this.draft.state.khodar_pos_branches_v1?.some(branch=>branch.id===branchId&&branch.tenantId===this.user.tenantId))
          throw new Error('Dependency proof does not match the retained branch source');
        const rows=this.draft.state.khodar_pos_products_v3;
        if(rows.some(row=>row.id===source.entityId))continue;
        const payload={...clone(source.payload),tenantId:this.user.tenantId,branchId};
        const event={id:`legacy-proof:${source.id}:${branchId}`,tenantId:this.user.tenantId,branchId,
          entityType:'product',entityId:source.entityId,action:'create',payload};
        this.draft.state.khodar_pos_products_v3=[payload,...rows];
        this.txEventTypes.add('product');this.txEvents.push(event);
        this.draft.state.braka_legacy_reference_proofs_v1=[...(this.draft.state.braka_legacy_reference_proofs_v1||[]),clone(proof)];
      }
      this.applyResilientReceive([],this.draft.cursor,apply,undefined,true);
    };
    return this.durable?this.transactDurable(action):this.transact(action);
  }
  applySalesReconciliation(events, cursor, apply, serverHeads, proposal) {
    if (proposal?.protocol !== 'independent-sales-v1' || !isIndependentSalesQueue(this.draft.outbox) ||
        this.draft.cursor !== proposal.cursor || JSON.stringify(this.draft.outbox) !== JSON.stringify(proposal.queue))
      throw new Error('Pending sales changed during reconciliation');
    if (!Array.isArray(events) || !events.every(isIndependentSale) || !serverHeads ||
        !Array.isArray(proposal.acceptedIds) || new Set(proposal.acceptedIds).size !== proposal.acceptedIds.length)
      throw new Error('Invalid sales reconciliation');
    const accepted = new Set(proposal.acceptedIds);
    for (const id of accepted) {
      const pending = this.draft.outbox.find(event => event.id === id);
      if (!pending || serverHeads[`record:invoice:${pending.entityId}`] !== id)
        throw new Error('Unrelated sales acknowledgement');
    }
    for (const event of events) {
      const pending = this.draft.outbox.find(item => item.entityId === event.entityId || item.id === event.id);
      if (pending && (!accepted.has(pending.id) || pending.id !== event.id ||
          JSON.stringify(pending.payload) !== JSON.stringify(event.payload))) throw new Error('Conflicting invoice identity');
    }
    // Only this server-audited additive path may receive while local sales are
    // pending. Their effects already exist locally and must never be replayed.
    this.applyReceive(events, cursor, apply, serverHeads, true);
    const heads = { ...serverHeads };
    this.draft.outbox = this.draft.outbox.filter(event => !accepted.has(event.id))
      .map(event => attachConflictPreconditions(event, heads));
    this.draft.state[SYNC_HEADS_STATE_KEY] = heads;
  }
  reconcileSales(events, cursor, apply, serverHeads, proposal) {
    return this.transact(() => this.applySalesReconciliation(events, cursor, apply, serverHeads, proposal));
  }
  reconcileSalesDurable(events, cursor, apply, serverHeads, proposal) {
    return this.transactDurable(() => this.applySalesReconciliation(events, cursor, apply, serverHeads, proposal));
  }
  async installReviewedResolution(proposal){
    if(this.pendingCommit||this.draft)throw new Error('Reviewed checkpoint writer busy');
    const paginated=proposal?.protocol==='owner-reviewed-checkpoint-v2';
    if((paginated?(proposal.completeHistory!==false||proposal.validatedThroughCursor!==proposal.nextCursor||!proposal.checkpoint):
      (proposal?.protocol!=='owner-reviewed-ledger-v1'||proposal.completeHistory!==true))||proposal.tenantId!==this.user.tenantId||
      JSON.stringify(proposal.queue)!==JSON.stringify(this.value.outbox)||!this.value.outbox.length)
      throw new Error('Pending queue changed during reviewed recovery');
    if(!Number.isSafeInteger(proposal.nextCursor)||proposal.nextCursor<this.value.cursor||!Array.isArray(proposal.history)||
      !Array.isArray(proposal.branches)||!proposal.branches.length||proposal.branches.some(branch=>branch.tenantId!==this.user.tenantId||!canAccessBranch(this.accessUser,branch.id)))
      throw new Error('Invalid reviewed checkpoint scope');
    let sequence=0;
    for(const event of proposal.history){
      if(event.tenantId!==this.user.tenantId||!Number.isSafeInteger(event.sequence)||event.sequence<=sequence||event.sequence>proposal.nextCursor||
        (event.branchId&&!canAccessBranch(this.accessUser,event.branchId)))throw new Error('Invalid reviewed history');
      sequence=event.sequence;
    }
    if(this.value.state.khodar_pos_cash_shifts_v1?.length)throw new Error('Cash shifts require an audited reviewed checkpoint');
    const plan=stageReviewedResolution({tenantId:this.user.tenantId,history:proposal.history,queue:proposal.queue,receipts:proposal.receipts,branches:proposal.branches,checkpoint:proposal.checkpoint});
    if(JSON.stringify(plan.ledger.branches)!==JSON.stringify(proposal.branches))throw new Error('Reviewed branch manifest mismatch');
    for(const rows of Object.values(plan.ledger).filter(Array.isArray))for(const row of rows)
      if(row.branchId&&!canAccessBranch(this.accessUser,row.branchId))throw new Error('Reviewed checkpoint contains a foreign branch');
    const selected=this.value.state.khodar_pos_active_branch_id_v1;
    const active=proposal.branches.find(branch=>branch.id===selected)?.id||proposal.branches[0].id;
    const state=reviewedLedgerState(plan.ledger,this.user.tenantId,proposal.nextCursor,active);
    const applied=Object.fromEntries(proposal.history.map(event=>[event.id,true]));
    if(!proposal.conflictHeads||typeof proposal.conflictHeads!=='object'||Array.isArray(proposal.conflictHeads)||
      Object.values(proposal.conflictHeads).some(value=>value!==null&&(typeof value!=='string'||!value)))throw new Error('Invalid reviewed conflict heads');
    state[SYNC_HEADS_STATE_KEY]=clone(proposal.conflictHeads);state[INBOUND_REVIEW_KEY]=[];
    if(paginated)state.braka_reviewed_cursor_fence_v1=proposal.nextCursor;
    if(selected==='all'&&canAccessBranch(this.accessUser,'all'))state.khodar_pos_active_branch_id_v1='all';
    const original=clone(this.value);
    // Previous archives are kept once, not recursively duplicated in every
    // subsequent full snapshot. Original business data and queue remain exact.
    delete original.state.braka_review_recovery_archive_v1;
    state.braka_review_recovery_archive_v1=[...(this.value.state.braka_review_recovery_archive_v1||[]),{original,receipts:plan.receipts,installedCursor:proposal.nextCursor}];
    this.reviewInstallation={state,cursor:proposal.nextCursor,applied};
    const action=()=>{
      if(JSON.stringify(this.draft.outbox)!==JSON.stringify(proposal.queue))throw new Error('Pending queue changed');
      Object.assign(this.draft.state,clone(state));this.draft.outbox=[];this.draft.cursor=proposal.nextCursor;this.draft.applied=applied;
    };
    try{return this.durable?await this.transactDurable(action):this.transact(action);}
    finally{this.reviewInstallation=null;}
  }
}
