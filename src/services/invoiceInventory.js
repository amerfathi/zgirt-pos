// Shared by local sale posting/reversal and inbound synchronization.
import { MissingDependencyError } from './missingDependency.js';

function getItemQuantity(item) {
  // If tobacco item has packsCount or quantity specified:
  if (item.packsCount !== undefined && Number.isFinite(Number(item.packsCount))) {
    return Number(item.packsCount);
  }
  if (item.unitType !== undefined && item.quantity !== undefined && Number.isFinite(Number(item.quantity))) {
    const packsPerCarton = Number(item.packsPerCarton) || 10;
    const unitsPerPack = Number(item.unitsPerPack) || 20;
    if (item.unitType === 'carton') return Number(item.quantity) * packsPerCarton;
    if (item.unitType === 'piece') return Number(item.quantity) / unitsPerPack;
    return Number(item.quantity);
  }
  return Number(item.netWeight ?? item.grossWeight ?? item.quantity ?? 0);
}

export function applyInvoiceInventory(products, invoice, direction) {
  const branchId = invoice.branchId || 'branch-main';
  for (const item of invoice.items || []) {
    const qty = getItemQuantity(item);
    if (!Number.isFinite(qty) || qty <= 0) continue;
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
      const qty = getItemQuantity(item);
      return matches && Number.isFinite(qty) && qty > 0 ? sum + Math.round(qty * 100) : sum;
    }, 0) / 100;
    if (!quantity) return product;
    const stock = Number(product.currentStockKg ?? product.stockPacks ?? 0) || 0;
    const branchStock = product.branchStock || {};
    const branchQuantity = Number(branchStock[branchId] ?? stock);
    const newStock = Math.round((stock + direction * quantity) * 100) / 100;
    const newBranch = Math.round((branchQuantity + direction * quantity) * 100) / 100;
    return { ...product,
      currentStockKg: newStock,
      ...(product.stockPacks !== undefined ? { stockPacks: newStock } : {}),
      branchStock: { ...branchStock, [branchId]: newBranch }
    };
  });
}

