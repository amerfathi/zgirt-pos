import { applyPurchaseInventory, applyPurchaseReturnInventory, applySalesReturnInventory, applyDamageInventory, applyStockTransfer } from './businessEffects.js';
import { applyInvoiceInventory } from './invoiceInventory.js';
import { createLiquiditySourceAudit } from './liquidityMigrationAudit.js';

// Read-only proof that every server event *through the local cursor* is marked
// applied in the aggregate. Selected direct records and anchored customer /
// supplier balances and selected stock effects are checked; the remaining
// derived effects need reconciliation.
const IMMUTABLE_FINANCIAL_RECORDS = {
  customer_payment: 'khodar_pos_customer_payments_v3',
  supplier_payment: 'khodar_pos_supplier_payments_v3',
  expense: 'khodar_pos_expenses_v3',
  worker_transaction: 'khodar_pos_worker_transactions_v3'
};
const canonical = value => JSON.stringify(value, (_key, item) =>
  item && !Array.isArray(item) && typeof item === 'object'
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

function verifyImmutableFinancialRecords(snapshot, latest) {
  const cached = new Map();
  for (const event of latest.values()) {
    const key = IMMUTABLE_FINANCIAL_RECORDS[event.entityType];
    if (!Object.hasOwn(snapshot.state, key))
      throw new Error('سجل مالي محلي مفقود لحركة مؤكدة في الخادم؛ لم يبدأ الترحيل');
    if (!cached.has(key)) {
      const rows = snapshot.state[key];
      if (!Array.isArray(rows)) throw new Error('سجل مالي محلي غير صالح؛ لم يبدأ الترحيل');
      const byId = new Map();
      for (const row of rows) {
        if (!row || typeof row.id !== 'string' || !row.id || byId.has(row.id))
          throw new Error('معرّفات سجل مالي محلي غير متسقة؛ لم يبدأ الترحيل');
        byId.set(row.id, row);
      }
      cached.set(key, byId);
    }
    const local = cached.get(key).get(event.entityId);
    if ((event.action === 'delete' && local) ||
        (event.action === 'create' && (!local || canonical(local) !== canonical(event.payload))))
      throw new Error('سجل مالي محلي لا يطابق آخر حركة مؤكدة في الخادم؛ لم يبدأ الترحيل');
  }
}

const toMinorUnits = value => {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(value ?? 0));
  if (!match) throw new Error('مبلغ مالي غير دقيق في سجل الخادم؛ لم يبدأ الترحيل');
  const units = Number(match[2]) * 100 + Number((match[3] || '').padEnd(2, '0'));
  if (!Number.isSafeInteger(units)) throw new Error('مبلغ مالي يتجاوز الحدود الآمنة؛ لم يبدأ الترحيل');
  return match[1] ? -units : units;
};

function createCustomerBalanceAudit() {
  const balances = new Map(), invoices = new Map(), payments = new Map(), returns = new Map();
  const adjust = (id, delta) => {
    if (!id || id === 'walk_in') return;
    if (!balances.has(id)) throw new Error('حركة مالية تشير إلى عميل بلا رصيد افتتاحي موثوق؛ لم يبدأ الترحيل');
    const next = balances.get(id) + delta;
    if (!Number.isSafeInteger(next)) throw new Error('رصيد عميل يتجاوز الحدود الآمنة؛ لم يبدأ الترحيل');
    balances.set(id, next);
  };
  return {
    apply(event) {
      const { entityType: type, entityId: id, action, payload } = event;
      if (!['customer','invoice','customer_payment','sales_return'].includes(type)) return;
      if (!id || !payload || typeof payload !== 'object')
        throw new Error('حركة رصيد عميل غير صالحة؛ لم يبدأ الترحيل');
      if (type === 'customer') {
        if (action === 'create') {
          if (balances.has(id) || payload.id !== id) throw new Error('إنشاء عميل مكرر أو غير مطابق؛ لم يبدأ الترحيل');
          balances.set(id, toMinorUnits(payload.balance));
        } else if (action === 'update') {
          if (!balances.has(id)) throw new Error('تحديث عميل بلا أصل؛ لم يبدأ الترحيل');
          if (Object.hasOwn(payload, 'balance')) balances.set(id, toMinorUnits(payload.balance));
        } else if (action === 'delete') balances.delete(id);
        else throw new Error('حركة عميل غير مدعومة في فحص الترحيل');
      } else if (type === 'invoice') {
        const prior = invoices.get(id);
        if (action === 'create') {
          if (prior || payload.id !== id) throw new Error('فاتورة مكررة في فحص الترحيل');
          invoices.set(id, payload);
          if (toMinorUnits(payload.remainingDebt) !== 0 && (!payload.customerId || payload.customerId === 'walk_in'))
            throw new Error('فاتورة دين تشير إلى عميل بلا معرّف موثوق؛ لم يبدأ الترحيل');
          if (payload.status !== 'voided') adjust(payload.customerId, toMinorUnits(payload.remainingDebt));
        } else if (action === 'void' || action === 'delete') {
          if (!prior) throw new Error('عكس فاتورة بلا أصل في فحص الترحيل');
          if (prior.status !== 'voided') adjust(prior.customerId, -toMinorUnits(prior.remainingDebt));
          if (action === 'delete') invoices.delete(id);
          else invoices.set(id, { ...prior, status: 'voided' });
        } else if (action === 'update') {
          if (!prior) throw new Error('تحديث فاتورة بلا أصل في فحص الترحيل');
          if (Object.hasOwn(payload, 'remainingDebt') || Object.hasOwn(payload, 'customerId') || Object.hasOwn(payload, 'status'))
            throw new Error('تعديل مالي مباشر للفاتورة غير قابل للمصالحة الآمنة');
          invoices.set(id, { ...prior, ...payload });
        } else throw new Error('حركة فاتورة غير مدعومة في فحص الترحيل');
      } else if (type === 'customer_payment') {
        if (action === 'create') {
          if (payments.has(id) || payload.id !== id) throw new Error('إيصال عميل مكرر في فحص الترحيل');
          if (!payload.customerId || payload.customerId === 'walk_in')
            throw new Error('إيصال عميل يشير إلى عميل بلا معرّف موثوق؛ لم يبدأ الترحيل');
          payments.set(id, payload);
          adjust(payload.customerId, -toMinorUnits(payload.amount));
        } else if (action === 'delete') {
          const prior = payments.get(id);
          if (!prior) throw new Error('عكس إيصال عميل بلا أصل في فحص الترحيل');
          adjust(prior.customerId, toMinorUnits(prior.amount));
          payments.delete(id);
        } else throw new Error('حركة إيصال عميل غير مدعومة في فحص الترحيل');
      } else if (type === 'sales_return') {
        if (action === 'create') {
          if (returns.has(id) || payload.id !== id) throw new Error('مردود عميل مكرر في فحص الترحيل');
          if (payload.refundMethod === 'credit_deduction' && (!payload.customerId || payload.customerId === 'walk_in'))
            throw new Error('مردود عميل دائن بلا معرّف عميل موثوق؛ لم يبدأ الترحيل');
          returns.set(id, payload);
          if (payload.refundMethod === 'credit_deduction')
            adjust(payload.customerId, -toMinorUnits(payload.totalRefundAmount));
        } else if (action === 'delete') {
          const prior = returns.get(id);
          if (!prior) throw new Error('عكس مردود عميل بلا أصل في فحص الترحيل');
          if (prior.refundMethod === 'credit_deduction')
            adjust(prior.customerId, toMinorUnits(prior.totalRefundAmount));
          returns.delete(id);
        } else throw new Error('حركة مردود عميل غير مدعومة في فحص الترحيل');
      }
    },
    verify(snapshot) {
      if (!balances.size) return 0;
      const rows = snapshot.state.khodar_pos_customers_v3;
      if (!Array.isArray(rows)) throw new Error('سجل العملاء المحلي مفقود؛ لم يبدأ الترحيل');
      const byId = new Map();
      for (const row of rows) {
        if (!row?.id || byId.has(row.id)) throw new Error('سجل عملاء محلي غير متسق؛ لم يبدأ الترحيل');
        byId.set(row.id, row);
      }
      for (const [id, expected] of balances) {
        const local = byId.get(id);
        if (!local || toMinorUnits(local.balance) !== expected)
          throw new Error('رصيد عميل محلي لا يطابق حركات الخادم؛ لم يبدأ الترحيل');
      }
      return balances.size;
    }
  };
}

function createSupplierBalanceAudit() {
  const balances = new Map(), purchases = new Map(), payments = new Map(), returns = new Map();
  const adjust = (id, delta) => {
    if (!id) throw new Error('حركة مالية تشير إلى مورد بلا معرّف موثوق؛ لم يبدأ الترحيل');
    if (!balances.has(id)) throw new Error('حركة مالية تشير إلى مورد بلا رصيد افتتاحي موثوق؛ لم يبدأ الترحيل');
    const next = balances.get(id) + delta;
    if (!Number.isSafeInteger(next)) throw new Error('رصيد مورد يتجاوز الحدود الآمنة؛ لم يبدأ الترحيل');
    balances.set(id, next);
  };
  return {
    apply(event) {
      const { entityType: type, entityId: id, action, payload } = event;
      if (!['supplier','purchase','supplier_payment','purchase_return'].includes(type)) return;
      if (!id || !payload || typeof payload !== 'object')
        throw new Error('حركة رصيد مورد غير صالحة؛ لم يبدأ الترحيل');
      if (type === 'supplier') {
        if (action === 'create') {
          if (balances.has(id) || payload.id !== id) throw new Error('إنشاء مورد مكرر أو غير مطابق؛ لم يبدأ الترحيل');
          balances.set(id, toMinorUnits(payload.balance));
        } else if (action === 'update') {
          if (!balances.has(id)) throw new Error('تحديث مورد بلا أصل؛ لم يبدأ الترحيل');
          if (Object.hasOwn(payload, 'balance')) balances.set(id, toMinorUnits(payload.balance));
        } else if (action === 'delete') balances.delete(id);
        else throw new Error('حركة مورد غير مدعومة في فحص الترحيل');
      } else if (type === 'purchase') {
        const prior = purchases.get(id);
        if (action === 'create') {
          if (prior || payload.id !== id) throw new Error('شحنة مشتريات مكررة في فحص الترحيل');
          purchases.set(id, payload);
          if (Number(payload.creditAmount ?? 0) > 0) adjust(payload.supplierId, toMinorUnits(payload.creditAmount));
        } else if (action === 'delete') {
          if (!prior) throw new Error('عكس شحنة مشتريات بلا أصل في فحص الترحيل');
          if (Number(prior.creditAmount ?? 0) > 0) adjust(prior.supplierId, -toMinorUnits(prior.creditAmount));
          purchases.delete(id);
        } else if (action === 'update') {
          if (!prior) throw new Error('تحديث شحنة مشتريات بلا أصل في فحص الترحيل');
          if (Object.hasOwn(payload, 'creditAmount') || Object.hasOwn(payload, 'supplierId'))
            throw new Error('تعديل مالي مباشر لشحنة المشتريات غير قابل للمصالحة الآمنة');
          purchases.set(id, { ...prior, ...payload });
        } else throw new Error('حركة مشتريات غير مدعومة في فحص الترحيل');
      } else if (type === 'supplier_payment') {
        if (action === 'create') {
          if (payments.has(id) || payload.id !== id) throw new Error('دفعة مورد مكررة في فحص الترحيل');
          payments.set(id, payload);
          adjust(payload.supplierId, -toMinorUnits(payload.amount));
        } else if (action === 'delete') {
          const prior = payments.get(id);
          if (!prior) throw new Error('عكس دفعة مورد بلا أصل في فحص الترحيل');
          adjust(prior.supplierId, toMinorUnits(prior.amount));
          payments.delete(id);
        } else throw new Error('حركة دفعة مورد غير مدعومة في فحص الترحيل');
      } else if (type === 'purchase_return') {
        if (action === 'create') {
          if (returns.has(id) || payload.id !== id) throw new Error('مردود مشتريات مكرر في فحص الترحيل');
          const purchase = purchases.get(payload.purchaseId);
          if (!purchase) throw new Error('مردود مشتريات يشير إلى شحنة غير مثبتة؛ لم يبدأ الترحيل');
          if (payload.supplierId && payload.supplierId !== purchase.supplierId)
            throw new Error('مردود مشتريات يشير إلى مورد مختلف عن الشحنة؛ لم يبدأ الترحيل');
          returns.set(id, payload);
          if (payload.refundMethod === 'supplier_debt_deduction')
            adjust(purchase.supplierId, -toMinorUnits(payload.totalRefundAmount));
        } else if (action === 'delete') {
          const prior = returns.get(id);
          if (!prior) throw new Error('عكس مردود مشتريات بلا أصل في فحص الترحيل');
          const purchase = purchases.get(prior.purchaseId);
          if (!purchase) throw new Error('عكس مردود مشتريات يشير إلى شحنة غير مثبتة؛ لم يبدأ الترحيل');
          if (prior.refundMethod === 'supplier_debt_deduction')
            adjust(purchase.supplierId, toMinorUnits(prior.totalRefundAmount));
          returns.delete(id);
        } else throw new Error('حركة مردود مشتريات غير مدعومة في فحص الترحيل');
      }
    },
    verify(snapshot) {
      if (!balances.size) return 0;
      const rows = snapshot.state.khodar_pos_suppliers_v3;
      if (!Array.isArray(rows)) throw new Error('سجل الموردين المحلي مفقود؛ لم يبدأ الترحيل');
      const byId = new Map();
      for (const row of rows) {
        if (!row?.id || byId.has(row.id)) throw new Error('سجل موردين محلي غير متسق؛ لم يبدأ الترحيل');
        byId.set(row.id, row);
      }
      for (const [id, expected] of balances) {
        const local = byId.get(id);
        if (!local || toMinorUnits(local.balance) !== expected)
          throw new Error('رصيد مورد محلي لا يطابق حركات الخادم؛ لم يبدأ الترحيل');
      }
      return balances.size;
    }
  };
}

function createInventoryAudit() {
  let products = [], touched = false;
  const purchases = new Map(), invoices = new Map(), returns = new Map();
  const branches = new Map(), damages = new Map(), transfers = new Set();
  const byProductId = id => products.find(product => product.id === id);
  const validateProduct = (id, row) => {
    if (!id || !row || typeof row !== 'object' || row.id !== id)
      throw new Error('حركة صنف غير صالحة في فحص الترحيل');
  };
  return {
    apply(event) {
      const { entityType: type, entityId: id, action, payload } = event;
      if (!['product','purchase','purchase_return','invoice','sales_return','branch','damaged_item','stock_transfer'].includes(type)) return;
      if (!id || !payload || typeof payload !== 'object')
        throw new Error('حركة مخزون غير صالحة؛ لم يبدأ الترحيل');
      if (type === 'branch') {
        if (action === 'create' && !branches.has(id) && payload.id === id) branches.set(id, payload);
        else if (action === 'update' && branches.has(id)) branches.set(id, { ...branches.get(id), ...payload });
        else if (action === 'delete' && branches.has(id)) branches.delete(id);
        else throw new Error('حركة فرع بلا أصل موثوق في فحص المخزون');
      } else if (type === 'damaged_item') {
        if (action === 'create' && !damages.has(id) && payload.id === id) {
          products = applyDamageInventory(products, payload, 1);
          damages.set(id, payload);
        } else if (action === 'delete' && damages.has(id)) {
          products = applyDamageInventory(products, damages.get(id), -1);
          damages.delete(id);
        } else throw new Error('حركة هالك بلا أصل موثوق في فحص المخزون');
        touched = true;
      } else if (type === 'stock_transfer') {
        if (action !== 'create' || transfers.has(id) || payload.id !== id)
          throw new Error('حركة مناقلة غير مدعومة في فحص المخزون');
        products = applyStockTransfer(products, [...branches.values()], payload);
        transfers.add(id);
        touched = true;
      } else if (type === 'product') {
        if (action === 'create') {
          validateProduct(id, payload);
          if (byProductId(id)) throw new Error('إنشاء صنف مكرر في فحص الترحيل');
          products = [payload, ...products];
          touched = true;
        } else if (action === 'update') {
          if (!byProductId(id)) throw new Error('تحديث صنف بلا أصل في فحص الترحيل');
          products = products.map(product => product.id === id ? { ...product, ...payload } : product);
          touched = true;
        } else if (action === 'delete') {
          if (!byProductId(id)) throw new Error('حذف صنف بلا أصل في فحص الترحيل');
          products = products.filter(product => product.id !== id);
          touched = true;
        } else throw new Error('حركة صنف غير مدعومة في فحص الترحيل');
      } else if (type === 'purchase') {
        if (!products.length && !touched) return;
        if (action === 'create') {
          if (purchases.has(id) || payload.id !== id) throw new Error('شحنة مشتريات مكررة في فحص المخزون');
          products = applyPurchaseInventory(products, payload, 1);
          purchases.set(id, payload);
          touched = true;
        } else if (action === 'delete') {
          const prior = purchases.get(id);
          if (!prior) throw new Error('عكس شحنة مشتريات بلا أصل في فحص المخزون');
          products = applyPurchaseInventory(products, prior, -1);
          purchases.delete(id);
          touched = true;
        } else if (action === 'update') throw new Error('تعديل شحنة مشتريات مالي/مخزني مباشر غير قابل للمصالحة الآمنة');
        else throw new Error('حركة مشتريات غير مدعومة في فحص المخزون');
      } else if (type === 'purchase_return') {
        if (!purchases.has(payload.purchaseId) && !touched) return;
        if (action === 'create') {
          if (returns.has(id) || payload.id !== id) throw new Error('مردود مشتريات مكرر في فحص المخزون');
          const purchase = purchases.get(payload.purchaseId);
          if (!purchase) throw new Error('مردود مشتريات يشير إلى شحنة غير مثبتة في فحص المخزون');
          products = applyPurchaseReturnInventory(products, purchase, payload, 1);
          returns.set(id, payload);
          touched = true;
        } else if (action === 'delete') {
          const prior = returns.get(id);
          if (!prior) throw new Error('عكس مردود مشتريات بلا أصل في فحص المخزون');
          const purchase = purchases.get(prior.purchaseId);
          if (!purchase) throw new Error('عكس مردود مشتريات يشير إلى شحنة غير مثبتة في فحص المخزون');
          products = applyPurchaseReturnInventory(products, purchase, prior, -1);
          returns.delete(id);
          touched = true;
        } else throw new Error('حركة مردود مشتريات غير مدعومة في فحص المخزون');
      } else if (type === 'invoice') {
        if (!products.length && !touched) return;
        if (action === 'create') {
          if (invoices.has(id) || payload.id !== id) throw new Error('فاتورة مكررة في فحص المخزون');
          products = applyInvoiceInventory(products, payload, -1);
          invoices.set(id, payload);
          touched = true;
        } else if (action === 'void' || action === 'delete') {
          const prior = invoices.get(id);
          if (!prior) throw new Error('عكس فاتورة بلا أصل في فحص المخزون');
          if (prior.status !== 'voided') products = applyInvoiceInventory(products, prior, 1);
          if (action === 'delete') invoices.delete(id);
          else invoices.set(id, { ...prior, status: 'voided' });
          touched = true;
        } else if (action === 'update') {
          if (!invoices.has(id)) throw new Error('تحديث فاتورة بلا أصل في فحص المخزون');
          if (Object.hasOwn(payload, 'items') || Object.hasOwn(payload, 'status'))
            throw new Error('تعديل مخزني مباشر للفاتورة غير قابل للمصالحة الآمنة');
          invoices.set(id, { ...invoices.get(id), ...payload });
        } else throw new Error('حركة فاتورة غير مدعومة في فحص المخزون');
      } else if (type === 'sales_return') {
        if (!invoices.has(payload.invoiceId) && !touched) return;
        if (action === 'create') {
          if (returns.has(id) || payload.id !== id) throw new Error('مردود مبيعات مكرر في فحص المخزون');
          const invoice = invoices.get(payload.invoiceId);
          if (!invoice || invoice.status === 'voided') throw new Error('مردود مبيعات يشير إلى فاتورة غير مثبتة في فحص المخزون');
          products = applySalesReturnInventory(products, invoice, payload, 1);
          returns.set(id, payload);
          touched = true;
        } else if (action === 'delete') {
          const prior = returns.get(id);
          if (!prior) throw new Error('عكس مردود مبيعات بلا أصل في فحص المخزون');
          const invoice = invoices.get(prior.invoiceId);
          if (!invoice) throw new Error('عكس مردود مبيعات يشير إلى فاتورة غير مثبتة في فحص المخزون');
          products = applySalesReturnInventory(products, invoice, prior, -1);
          returns.delete(id);
          touched = true;
        } else throw new Error('حركة مردود مبيعات غير مدعومة في فحص المخزون');
      }
    },
    verify(snapshot) {
      if (!touched) return 0;
      const rows = snapshot.state.khodar_pos_products_v3;
      if (!Array.isArray(rows)) throw new Error('سجل الأصناف المحلي مفقود؛ لم يبدأ الترحيل');
      const local = new Map();
      for (const row of rows) {
        if (!row?.id || local.has(row.id)) throw new Error('سجل أصناف محلي غير متسق؛ لم يبدأ الترحيل');
        local.set(row.id, row);
      }
      if (local.size !== products.length)
        throw new Error('أصناف محلية بلا أصل مطابق في سجل الخادم؛ لم يبدأ الترحيل');
      for (const expected of products) {
        const found = local.get(expected.id);
        if (!found || Number(found.currentStockKg ?? 0) !== Number(expected.currentStockKg ?? 0) ||
            Number(found.costPerKg ?? 0) !== Number(expected.costPerKg ?? 0) ||
            canonical(found.branchStock || {}) !== canonical(expected.branchStock || {}))
          throw new Error('مخزون صنف محلي لا يطابق حركات الخادم؛ لم يبدأ الترحيل');
      }
      return products.length;
    }
  };
}

export async function verifyCloudCheckpoint(snapshot, fetchPage, { maxPages = 10000 } = {}) {
  const tenantId = snapshot?.identity?.tenantId;
  const checkpoint = snapshot?.cursor;
  if (typeof tenantId !== 'string' || !tenantId || !Number.isSafeInteger(checkpoint) || checkpoint < 0 ||
      !snapshot.applied || typeof snapshot.applied !== 'object' || Array.isArray(snapshot.applied) ||
      !snapshot.state || typeof snapshot.state !== 'object' || Array.isArray(snapshot.state) ||
      !Array.isArray(snapshot.outbox) ||
      typeof fetchPage !== 'function')
    throw new Error('سجل الترحيل أو مؤشره غير صالح');

  let cursor = 0, observedEvents = 0;
  const seen = new Set(), acceptedPending = new Set();
  const pendingById = new Map();
  for (const pending of snapshot.outbox) {
    if (!pending?.id || pendingById.has(pending.id))
      throw new Error('طابور الترحيل يحوي معرّفات مفقودة أو مكررة');
    if (pending.tenantId !== tenantId)
      throw new Error('حركة معلّقة لا تنتمي إلى شركة الترحيل');
    pendingById.set(pending.id, pending);
  }
  const latestFinancial = new Map();
  const customerBalances = createCustomerBalanceAudit();
  const supplierBalances = createSupplierBalanceAudit();
  const inventory = createInventoryAudit();
  const liquidity = createLiquiditySourceAudit();
  for (let pageNumber = 0; pageNumber < maxPages; pageNumber++) {
    const page = await fetchPage({ tenantId, cursor, limit: 500 });
    if (page?.success !== true || page.fullTenantVisibility !== true || !Array.isArray(page.events) ||
        !Number.isSafeInteger(page.nextCursor) || page.nextCursor < cursor || typeof page.hasMore !== 'boolean')
      throw new Error('تعذر التحقق من كامل سجل مزامنة الشركة؛ لم يبدأ الترحيل');
    let sequence = cursor;
    for (const event of page.events) {
      if (!event || typeof event.id !== 'string' || !event.id || seen.has(event.id) ||
          event.tenantId !== tenantId || !Number.isSafeInteger(event.sequence) ||
          event.sequence <= sequence || event.sequence > page.nextCursor)
        throw new Error('صفحة مزامنة غير متسقة؛ لم يبدأ الترحيل');
      seen.add(event.id);
      sequence = event.sequence;
      if (event.sequence <= checkpoint) {
        if (snapshot.applied[event.id] !== true)
          throw new Error('حركة سحابية تسبق المؤشر لم تُطبّق محليًا؛ لم يبدأ الترحيل');
        const pending = pendingById.get(event.id);
        if (pending && (pending.entityType !== event.entityType || pending.entityId !== event.entityId ||
            pending.action !== event.action || canonical(pending.payload) !== canonical(event.payload) ||
            (pending.branchId ?? null) !== (event.branchId ?? null) ||
            (pending.groupId ?? null) !== (event.groupId ?? null)))
          throw new Error('حركة معلّقة تختلف عن الحركة المقبولة في الخادم؛ لم يبدأ الترحيل');
        if (pending) acceptedPending.add(event.id);
        if (IMMUTABLE_FINANCIAL_RECORDS[event.entityType]) {
          if (!['create', 'delete'].includes(event.action) || typeof event.entityId !== 'string' || !event.entityId ||
              !event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload) ||
              (event.action === 'create' && event.payload.id !== event.entityId))
            throw new Error('حركة مالية سحابية غير صالحة؛ لم يبدأ الترحيل');
          latestFinancial.set(`${event.entityType}:${event.entityId}`, event);
        }
        customerBalances.apply(event);
        supplierBalances.apply(event);
        inventory.apply(event);
        liquidity.apply(event);
        observedEvents++;
      }
    }
    if (sequence !== page.nextCursor)
      throw new Error('صفحة مزامنة تخفي أحداثًا من سجل الشركة؛ لم يبدأ الترحيل');
    if (page.nextCursor >= checkpoint) {
      // Lost acknowledgements leave already-applied events in the outbox.
      // They must not suppress balance/record checks or be replayed twice.
      // This is an audit view only: preserve the actual queue for normal retry.
      const remaining = snapshot.outbox.filter(event => !acceptedPending.has(event.id));
      // Reconstruct the local suffix in queue order, once. A missing opening
      // record or an incompatible interleaving fails the projection checks.
      for (const event of remaining) {
        if (IMMUTABLE_FINANCIAL_RECORDS[event.entityType]) {
          if (!['create','delete'].includes(event.action) || !event.entityId ||
              !event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload) ||
              (event.action === 'create' && event.payload.id !== event.entityId))
            throw new Error('حركة مالية معلّقة غير صالحة؛ لم يبدأ الترحيل');
          latestFinancial.set(`${event.entityType}:${event.entityId}`, event);
        }
        customerBalances.apply(event);
        supplierBalances.apply(event);
        inventory.apply(event);
        liquidity.apply(event);
      }
      const auditSnapshot = { ...snapshot, outbox: [] };
      verifyImmutableFinancialRecords(auditSnapshot, latestFinancial);
      return { verifiedThrough: checkpoint, observedEvents, serverPageCursor: page.nextCursor,
        verifiedAcceptedPendingEvents: acceptedPending.size,
        reconciledPendingEvents: remaining.length,
        verifiedCustomerBalances: customerBalances.verify(auditSnapshot),
        verifiedSupplierBalances: supplierBalances.verify(auditSnapshot),
        verifiedInventoryProducts: inventory.verify(auditSnapshot),
        ...liquidity.verify(auditSnapshot) };
    }
    if (!page.hasMore || page.nextCursor === cursor || page.events.length === 0)
      throw new Error('المؤشر المحلي يتجاوز سجل الخادم أو صفحة المزامنة لا تتقدم؛ لم يبدأ الترحيل');
    cursor = page.nextCursor;
  }
  throw new Error('تجاوز فحص الترحيل حد صفحات المزامنة الآمنة');
}

// A checkpoint alone cannot establish which branches financial records refer
// to. Require a current full-tenant manifest before moving a legacy aggregate.
export async function verifyServerBranches(snapshot, fetchBranches) {
  const tenantId = snapshot?.identity?.tenantId;
  const local = snapshot?.state?.khodar_pos_branches_v1;
  const selected = snapshot?.state?.khodar_pos_active_branch_id_v1;
  if (typeof tenantId !== 'string' || !tenantId || !Number.isSafeInteger(snapshot?.cursor) ||
      !Array.isArray(local) || !local.length || !Array.isArray(snapshot?.outbox) ||
      typeof fetchBranches !== 'function')
    throw new Error('سجل فروع الترحيل غير صالح؛ لم يبدأ الترحيل');
  if (snapshot.outbox.some(event => event?.entityType === 'branch'))
    throw new Error('حركات فروع محلية لم تُحسم مع الخادم؛ لم يبدأ الترحيل');
  const manifest = await fetchBranches({ tenantId });
  if (manifest?.success !== true || manifest.tenantId !== tenantId ||
      manifest.fullTenantVisibility !== true || !Array.isArray(manifest.branches) ||
      !Number.isSafeInteger(manifest.latestSequence) || manifest.latestSequence !== snapshot.cursor)
    throw new Error('تعذر التحقق من فروع الشركة عند نفس مؤشر المزامنة؛ لم يبدأ الترحيل');
  const fields = ['name','code','phone','address','managerName','isMain','status'];
  const serverById = new Map();
  for (const branch of manifest.branches) {
    if (!branch || typeof branch.id !== 'string' || !branch.id ||
        branch.tenantId !== tenantId || serverById.has(branch.id))
      throw new Error('قائمة فروع الخادم غير متسقة؛ لم يبدأ الترحيل');
    serverById.set(branch.id, branch);
  }
  if (serverById.size !== local.length || !serverById.has(selected))
    throw new Error('فروع السجل المحلي لا تطابق فروع الخادم؛ لم يبدأ الترحيل');
  const seen = new Set();
  for (const branch of local) {
    const remote = serverById.get(branch?.id);
    if (!remote || branch.tenantId !== tenantId || seen.has(branch.id) ||
        fields.some(field => {
          if (field === 'isMain') return Boolean(branch[field]) !== Boolean(remote[field]);
          return String(branch[field] ?? '') !== String(remote[field] ?? '');
        }))
      throw new Error('فروع السجل المحلي لا تطابق فروع الخادم؛ لم يبدأ الترحيل');
    seen.add(branch.id);
  }
  return { branchCount: seen.size, verifiedAtSequence: manifest.latestSequence };
}
