import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toCents,
  fromCents,
  openShiftRecord,
  recordCashTransaction,
  closeShiftRecord,
  executeSaleTransaction,
  UNIT_TYPES
} from '../packages/core/src/index.js';

test('Financial Consistency & Cash Shift Integrity Scenario', async (t) => {
  // 1. Setup Cash Shift starting with 500.00 SAR (50000 cents)
  const shiftId = 'shift-001';
  const tenantId = 'tenant-test-01';
  const branchId = 'branch-main';
  const cashierId = 'cashier-amer';
  const deviceId = 'pos-terminal-1';

  let shift = openShiftRecord({
    id: shiftId,
    tenantId,
    branchId,
    drawerId: 'drawer-front',
    cashierUserId: cashierId,
    deviceId,
    openingCashCents: 50000
  });

  assert.equal(shift.openingCashCents, 50000);
  assert.equal(shift.expectedCashCents, 50000);
  assert.equal(shift.status, 'open');

  // 2. Mock Tobacco Products: Marlboro Red (1 Carton = 10 Packs, 1 Pack = 20 Pieces)
  const marlboro = {
    id: 'prod-marlboro-red',
    name_ar: 'مارلبورو أحمر',
    packs_per_carton: 10,
    units_per_pack: 20,
    cost_pack_cents: 2200, // 22.00
    retail_price_pack_cents: 2800, // 28.00
    retail_price_carton_cents: 27500, // 275.00
    wholesale_price_carton_cents: 26000 // 260.00
  };

  // 3. Customer Setup
  let customer = {
    id: 'cust-wholesale-01',
    name: 'سوبرماركت الأمل',
    balance_cents: 0
  };

  // 4. Perform a Cash Retail Sale: 2 Packs of Marlboro Red
  // Total: 2 * 28.00 = 56.00 (5600 cents)
  const retailSale = executeSaleTransaction({
    tenantId,
    branchId,
    cashierUserId: cashierId,
    shift,
    items: [
      { product: marlboro, unitType: UNIT_TYPES.PACK, quantity: 2 }
    ],
    saleType: 'retail',
    paidCashCents: 5600,
    paidCardCents: 0
  });

  assert.equal(retailSale.invoice.totalCents, 5600);
  assert.equal(retailSale.invoice.paymentStatus, 'paid');
  assert.equal(retailSale.stockDeductions[0].deductPacks, 2);
  
  // Shift cash should now be 50000 + 5600 = 55600
  shift = retailSale.updatedShift;
  assert.equal(shift.expectedCashCents, 55600);

  // 5. Perform a Wholesale Credit Sale: 5 Cartons of Marlboro Red to Wholesale Customer
  // Total: 5 * 260.00 = 1300.00 (130000 cents)
  // Customer pays 300.00 cash, 1000.00 remains as debt (credit due)
  const wholesaleSale = executeSaleTransaction({
    tenantId,
    branchId,
    cashierUserId: cashierId,
    shift,
    customer,
    items: [
      { product: marlboro, unitType: UNIT_TYPES.CARTON, quantity: 5 }
    ],
    saleType: 'wholesale',
    paidCashCents: 30000,
    paidCardCents: 0
  });

  assert.equal(wholesaleSale.invoice.totalCents, 130000);
  assert.equal(wholesaleSale.invoice.creditDueCents, 100000);
  assert.equal(wholesaleSale.invoice.paymentStatus, 'partial');
  // 5 cartons * 10 packs = 50 packs stock deduction
  assert.equal(wholesaleSale.stockDeductions[0].deductPacks, 50);

  // Customer debt should now be +100000 cents (1000.00)
  customer = wholesaleSale.updatedCustomer;
  assert.equal(customer.balance_cents, 100000);

  // Shift cash should now be 55600 + 30000 = 85600 cents
  shift = wholesaleSale.updatedShift;
  assert.equal(shift.expectedCashCents, 85600);

  // 6. Record Cash Expense from Drawer (e.g. municipal cleaning/supplies: 50.00 = 5000 cents)
  shift = recordCashTransaction(shift, {
    amountCents: -5000,
    type: 'expense',
    notes: 'مصروف نظافة وبلدية'
  });

  // Expected cash now: 85600 - 5000 = 80600 cents (806.00)
  assert.equal(shift.expectedCashCents, 80600);

  // 7. Customer pays back 500.00 (50000 cents) of their debt in cash
  customer.balance_cents -= 50000;
  shift = recordCashTransaction(shift, {
    amountCents: 50000,
    type: 'customer_payment',
    notes: 'سداد دفعة من الحساب'
  });

  assert.equal(customer.balance_cents, 50000); // 500.00 remains
  assert.equal(shift.expectedCashCents, 130600); // 1306.00

  // 8. Close Shift with counted cash: Exactly 130600 cents
  shift = closeShiftRecord(shift, {
    countedCashCents: 130600
  });

  assert.equal(shift.status, 'closed');
  assert.equal(shift.varianceCents, 0, 'Shift closed with ZERO variance');
  assert.equal(fromCents(shift.expectedCashCents), 1306.00);
});
