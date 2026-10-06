/**
 * Deterministic Financial and Inventory Transaction Pipeline
 * Ensures strict atomicity: cash, debt, inventory, and shift journals update simultaneously.
 */

import { calculateLineItem } from './packaging.js';
import { recordCashTransaction } from './cashShift.js';

export function executeSaleTransaction({
  invoiceId = crypto.randomUUID(),
  invoiceNumber,
  tenantId,
  branchId,
  cashierUserId,
  shift,
  customer,
  items,
  saleType = 'retail',
  paidCashCents = 0,
  paidCardCents = 0,
  notes = '',
  timestamp = new Date().toISOString()
}) {
  if (!items || !items.length) {
    throw new Error('Sale must contain at least one item');
  }

  let subtotalCents = 0;
  let totalDiscountCents = 0;
  const processedItems = [];
  const stockDeductions = [];

  for (const item of items) {
    const calculated = calculateLineItem({
      product: item.product,
      unitType: item.unitType,
      quantity: item.quantity,
      isWholesale: saleType === 'wholesale',
      customDiscountCents: item.discountCents || 0
    });

    subtotalCents += calculated.subtotalCents;
    totalDiscountCents += calculated.discountCents;

    processedItems.push({
      ...calculated,
      id: crypto.randomUUID(),
      invoiceId
    });

    stockDeductions.push({
      productId: item.product.id,
      deductPacks: calculated.packsCount
    });
  }

  const totalCents = Math.max(0, subtotalCents - totalDiscountCents);
  const paidTotal = paidCashCents + paidCardCents;
  const creditDueCents = Math.max(0, totalCents - paidTotal);

  if (creditDueCents > 0 && !customer) {
    throw new Error('Credit sales require a registered customer');
  }

  let paymentStatus = 'paid';
  if (creditDueCents === totalCents) {
    paymentStatus = 'unpaid';
  } else if (creditDueCents > 0) {
    paymentStatus = 'partial';
  }

  const invoice = {
    id: invoiceId,
    invoiceNumber: invoiceNumber || `INV-${Date.now().toString(36).toUpperCase()}`,
    tenantId,
    branchId,
    shiftId: shift?.id || null,
    cashierUserId,
    customerId: customer?.id || null,
    saleType,
    subtotalCents,
    discountCents: totalDiscountCents,
    taxCents: 0,
    totalCents,
    paidCashCents,
    paidCardCents,
    creditDueCents,
    paymentStatus,
    notes,
    createdAt: timestamp,
    items: processedItems
  };

  // Update Customer balance if credit sale
  let updatedCustomer = null;
  if (customer && creditDueCents > 0) {
    updatedCustomer = {
      ...customer,
      balance_cents: (customer.balance_cents || 0) + creditDueCents
    };
  }

  // Update Shift cash journal if cash was paid
  let updatedShift = shift;
  if (shift && paidCashCents > 0) {
    updatedShift = recordCashTransaction(shift, {
      amountCents: paidCashCents,
      type: 'sale',
      referenceId: invoiceId,
      notes: `Invoice ${invoice.invoiceNumber}`,
      timestamp
    });
  }

  return {
    invoice,
    stockDeductions,
    updatedCustomer,
    updatedShift
  };
}
