// Proves parity of the inputs used by getFinancialPosition, not the correctness
// of its accounting formulas (which is a separate independent reconciliation).
/** @type {Record<string, [string, string[]]>} */
const SOURCES = {
  invoice: ['khodar_pos_invoices_v3', ['status','saleType','paidAmount','cashAmount','bankAmount']],
  purchase: ['khodar_pos_purchases_v3', ['paidCashAmount','paidBankAmount','paymentMethod','paymentType','totalCost','creditAmount','paidAmount']],
  customer_payment: ['khodar_pos_customer_payments_v3', ['method','amount']],
  supplier_payment: ['khodar_pos_supplier_payments_v3', ['paymentMethod','amount']],
  expense: ['khodar_pos_expenses_v3', ['paymentMethod','amount','isSupplierPayment','isWorkerPayment']],
  worker_transaction: ['khodar_pos_worker_transactions_v3', ['type','paymentMethod','amount']],
  partner_drawing: ['khodar_pos_partner_drawings_v3', ['method','amount']],
  profit_distribution: ['khodar_pos_profit_distributions_v3', ['shares']],
  sales_return: ['khodar_pos_sales_returns_v3', ['refundMethod','totalRefundAmount']],
  purchase_return: ['khodar_pos_purchase_returns_v3', ['refundMethod','totalRefundAmount']]
};
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a],[b]) => a.localeCompare(b))) : item);
const select = (row, fields) => Object.fromEntries(fields.filter(field => Object.hasOwn(row, field)).map(field => [field, row[field]]));

export function createLiquiditySourceAudit() {
  const ledgers = new Map();
  let opening = 0;
  return {
    apply({entityType,entityId = undefined,action,payload}) {
      if (entityType === 'settings') {
        if (action !== 'update' || !payload || typeof payload !== 'object')
          throw new Error('حركة إعدادات غير صالحة لفحص السيولة');
        if (Object.hasOwn(payload, 'openingCashDrawerFloat')) opening = payload.openingCashDrawerFloat;
        return;
      }
      if (!SOURCES[entityType]) return;
      if (!entityId || !payload || typeof payload !== 'object' || Array.isArray(payload))
        throw new Error('حركة مصدر سيولة غير صالحة');
      if (!ledgers.has(entityType)) ledgers.set(entityType, new Map());
      const rows = ledgers.get(entityType), prior = rows.get(entityId);
      if (action === 'create' && !prior && payload.id === entityId) rows.set(entityId, payload);
      else if (action === 'delete' && prior) rows.delete(entityId);
      else if ((action === 'update' || (action === 'void' && entityType === 'invoice')) && prior)
        rows.set(entityId, { ...prior, ...payload, ...(action === 'void' ? {status:'voided'} : {}) });
      else throw new Error('مصدر سيولة بلا أصل أو حركة مكررة؛ لم يبدأ الترحيل');
    },
    verify(snapshot) {
      let count = 0;
      for (const [type, source] of Object.entries(SOURCES)) {
        const [key, fields] = source;
        const expected = ledgers.get(type) || new Map();
        const rows = snapshot.state[key];
        if (rows === undefined && !ledgers.has(type)) continue;
        if (!Array.isArray(rows)) throw new Error('سجل مصدر سيولة محلي مفقود؛ لم يبدأ الترحيل');
        const seen = new Set();
        for (const row of rows) {
          if (!row?.id || seen.has(row.id) || !expected.has(row.id) ||
              canonical(select(row,fields)) !== canonical(select(expected.get(row.id),fields)))
            throw new Error('مصدر النقد أو البنك المحلي لا يطابق سجل الحركات؛ لم يبدأ الترحيل');
          seen.add(row.id);
        }
        if (seen.size !== expected.size)
          throw new Error('مصدر النقد أو البنك المحلي لا يطابق سجل الحركات؛ لم يبدأ الترحيل');
        count += seen.size;
      }
      const localOpening = snapshot.state.khodar_pos_settings_v3?.openingCashDrawerFloat ?? 0;
      if (!Number.isFinite(Number(opening)) || !Number.isFinite(Number(localOpening)) || Number(opening) !== Number(localOpening))
        throw new Error('عهدة افتتاحية بلا مصدر مطابق؛ لم يبدأ الترحيل');
      return { verifiedLiquidityRecords: count, verifiedOpeningCash: Number(opening) };
    }
  };
}
