const amount = (value, label) => {
  const number = Number(value);
  if (value === undefined || value === null || value === '' || !Number.isFinite(number) || number < 0 ||
      Math.abs(number * 100 - Math.round(number * 100)) > 1e-6)
    throw new Error(`مبلغ غير صالح: ${label}`);
  return Math.round(number * 100);
};
const optionalAmount = (value, label) => value === undefined || value === null ? 0 : amount(value, label);

// Positive values enter the drawer; negative values leave it. No client-supplied
// cash delta is trusted: future server reconciliation derives it from the synced record.
export function cashMovementFromRecord(type, row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('سجل مالي غير صالح');
  let cents = 0;
  switch (type) {
    case 'invoice':
      if (row.status === 'voided') return 0;
      if (row.saleType === 'cash') cents = amount(row.paidAmount, 'نقد الفاتورة');
      else if (row.saleType === 'split') cents = amount(row.cashAmount, 'نقد الفاتورة المجزأة');
      break;
    case 'customer_payment':
      if (!row.method || row.method === 'cash') cents = amount(row.amount, 'سداد العميل');
      break;
    case 'expense':
      if (row.paymentMethod !== 'bank' && !row.isSupplierPayment && !row.isWorkerPayment)
        cents = -amount(row.amount, 'المصروف النقدي');
      break;
    case 'purchase':
      if (row.paidCashAmount !== undefined) cents = -amount(row.paidCashAmount, 'نقد المشتريات');
      else if (row.paymentMethod === 'cash')
        cents = -Math.max(0, amount(row.totalCost, 'المشتريات') - optionalAmount(row.creditAmount, 'دين المشتريات'));
      else if (row.paymentType === 'cash') cents = -amount(row.paidAmount, 'نقد المشتريات');
      break;
    case 'supplier_payment':
      if (row.paymentMethod !== 'bank') cents = -amount(row.amount, 'سداد المورد');
      break;
    case 'worker_transaction':
      if (['advance','salary_payment'].includes(row.type) && row.paymentMethod !== 'bank')
        cents = -amount(row.amount, 'حركة العامل');
      break;
    case 'partner_drawing':
      if (row.method !== 'bank') cents = -amount(row.amount, 'مسحوب الشريك');
      break;
    case 'profit_distribution':
      if (!Array.isArray(row.shares)) throw new Error('حصص توزيع الأرباح غير صالحة');
      cents = -row.shares.filter(share => share.method !== 'bank')
        .reduce((sum, share) => sum + amount(share.netPayout, 'حصة الشريك'), 0);
      break;
    case 'sales_return':
      if (row.refundMethod === 'cash') cents = -amount(row.totalRefundAmount, 'مردود البيع');
      break;
    case 'purchase_return':
      if (row.refundMethod === 'cash') cents = amount(row.totalRefundAmount, 'مردود الشراء');
      break;
    default:
      throw new Error('نوع الحركة المالية غير مدعوم');
  }
  return cents / 100;
}
