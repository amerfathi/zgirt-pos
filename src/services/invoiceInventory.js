// Shared by local sale posting/reversal and inbound synchronization.
import { MissingDependencyError } from './missingDependency.js';
export function applyInvoiceInventory(products, invoice, direction) {
  const branchId = invoice.branchId || 'branch-main';
  for (const item of invoice.items || []) {
    const weight = Number(item.netWeight ?? item.grossWeight ?? 0);
    if (!Number.isFinite(weight) || weight <= 0) continue;
    const matches = products.filter(product => (!product.branchId || product.branchId === branchId) &&
      (item.productId ? item.productId === product.id :
      String(item.name || '').trim() === String(product.name || '').trim()));
    if (matches.length !== 1) throw new MissingDependencyError('صنف الفاتورة غير موجود أو غير محدد؛ لم تتغير كمية المخزون');
  }
  return products.map(product => {
    const quantity = (invoice.items || []).reduce((sum, item) => {
      const matches = (!product.branchId || product.branchId === branchId) &&
        (item.productId ? item.productId === product.id
        : String(item.name || '').trim() === String(product.name || '').trim());
      const weight = Number(item.netWeight ?? item.grossWeight ?? 0);
      return matches && Number.isFinite(weight) && weight > 0 ? sum + Math.round(weight * 100) : sum;
    }, 0) / 100;
    if (!quantity) return product;
    const stock = Number(product.currentStockKg) || 0;
    const branchStock = product.branchStock || {};
    const branchQuantity = Number(branchStock[branchId] ?? stock);
    return { ...product,
      currentStockKg: Math.round((stock + direction * quantity) * 100) / 100,
      branchStock: { ...branchStock, [branchId]: Math.round((branchQuantity + direction * quantity) * 100) / 100 }
    };
  });
}
