import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UNIT_TYPES,
  toBaseUnit,
  fromBaseUnit,
  calculateLineItem,
  calculateInvoiceTotals
} from '../packages/core/src/packaging.js';
import {
  applyPurchaseInventory,
  applyPurchaseReturnPurchase,
  applyPurchaseReturnInventory,
  applySalesReturnInvoice,
  applySalesReturnInventory,
  applyDamageInventory,
  adjustBalance
} from '../src/services/businessEffects.js';
import { applyInvoiceInventory } from '../src/services/invoiceInventory.js';

test('Tobacco Domain: Packaging Conversions (Carton -> Packs -> Pieces)', () => {
  const packsPerCarton = 10;
  const unitsPerPack = 20;

  // 1 carton = 10 packs
  assert.equal(toBaseUnit(1, UNIT_TYPES.CARTON, packsPerCarton, unitsPerPack), 10);
  // 5 packs = 5 packs
  assert.equal(toBaseUnit(5, UNIT_TYPES.PACK, packsPerCarton, unitsPerPack), 5);
  // 10 pieces = 0.5 packs
  assert.equal(toBaseUnit(10, UNIT_TYPES.PIECE, packsPerCarton, unitsPerPack), 0.5);

  // Conversion back from base packs
  // 50 packs = 5 cartons
  assert.equal(fromBaseUnit(50, UNIT_TYPES.CARTON, packsPerCarton, unitsPerPack), 5);
  // 3.5 packs = 70 pieces
  assert.equal(fromBaseUnit(3.5, UNIT_TYPES.PIECE, packsPerCarton, unitsPerPack), 70);
});

test('Tobacco Domain: Retail Pack Sale (Stock deduction, Revenue, Pricing)', () => {
  const product = {
    id: 'prod-marlboro',
    name: 'مارلبورو أحمر',
    currentStockKg: 100, // 100 packs
    costPerKg: 20.0,     // 20.0 SAR per pack
    retailPricePack: 28.0,
    retailPriceCarton: 275.0,
    wholesalePriceCarton: 260.0,
    packsPerCarton: 10,
    unitsPerPack: 20
  };

  // Sale of 3 packs
  const line = calculateLineItem({
    product,
    unitType: UNIT_TYPES.PACK,
    quantity: 3,
    saleMode: 'retail'
  });

  assert.equal(line.quantity, 3);
  assert.equal(line.unitPrice, 28.0);
  assert.equal(line.totalPrice, 84.0);
  assert.equal(line.packsCount, 3);

  // Apply to inventory via applyInvoiceInventory
  const invoice = {
    id: 'inv-001',
    branchId: 'branch-main',
    items: [line]
  };

  const updatedProducts = applyInvoiceInventory([product], invoice, -1);
  assert.equal(updatedProducts[0].currentStockKg, 97); // 100 - 3 = 97 packs
});

test('Tobacco Domain: Wholesale Carton Sale (Conversion factor, Stock deduction)', () => {
  const product = {
    id: 'prod-winston',
    name: 'وينستون أزرق',
    currentStockKg: 200, // 200 packs = 20 cartons
    costPerKg: 15.0,
    retailPricePack: 22.0,
    retailPriceCarton: 215.0,
    wholesalePriceCarton: 205.0,
    packsPerCarton: 10,
    unitsPerPack: 20
  };

  // Wholesale purchase of 4 cartons
  const line = calculateLineItem({
    product,
    unitType: UNIT_TYPES.CARTON,
    quantity: 4,
    saleMode: 'wholesale'
  });

  assert.equal(line.quantity, 4);
  assert.equal(line.unitPrice, 205.0); // Wholesale carton price
  assert.equal(line.totalPrice, 820.0); // 4 * 205 = 820.00
  assert.equal(line.packsCount, 40);    // 4 cartons * 10 packs = 40 packs

  const invoice = {
    id: 'inv-002',
    branchId: 'branch-main',
    items: [line]
  };

  const updatedProducts = applyInvoiceInventory([product], invoice, -1);
  assert.equal(updatedProducts[0].currentStockKg, 160); // 200 - 40 = 160 packs
});

test('Tobacco Domain: Single Piece Sale (Fractional pack deduction)', () => {
  const product = {
    id: 'prod-dunhill',
    name: 'دنهل أبيض',
    currentStockKg: 50,
    costPerKg: 22.0,
    retailPricePack: 30.0,
    packsPerCarton: 10,
    unitsPerPack: 20 // 20 cigarettes per pack -> 1.5 SAR per piece
  };

  const line = calculateLineItem({
    product,
    unitType: UNIT_TYPES.PIECE,
    quantity: 4, // 4 cigarettes
    saleMode: 'retail'
  });

  assert.equal(line.quantity, 4);
  assert.equal(line.unitPrice, 1.5); // 30 / 20 = 1.5 SAR
  assert.equal(line.totalPrice, 6.0); // 4 * 1.5 = 6.0 SAR
  assert.equal(line.packsCount, 0.2); // 4 / 20 = 0.2 packs

  const invoice = {
    id: 'inv-003',
    branchId: 'branch-main',
    items: [line]
  };

  const updatedProducts = applyInvoiceInventory([product], invoice, -1);
  assert.equal(updatedProducts[0].currentStockKg, 49.8); // 50 - 0.2 = 49.8 packs
});

test('Tobacco Domain: Purchasing & Weighted Average Cost per Pack', () => {
  const product = {
    id: 'prod-rothmans',
    name: 'روثمانز أزرق',
    currentStockKg: 50, // 50 packs currently in stock
    costPerKg: 16.0,    // 16.0 SAR per pack
    branchStock: { 'branch-main': 50 }
  };

  // Purchase: 10 cartons (each carton 10 packs = 100 packs) at 180 SAR per carton (18.0 SAR per pack)
  const purchase = {
    id: 'pur-101',
    branchId: 'branch-main',
    productId: 'prod-rothmans',
    productName: 'روثمانز أزرق',
    quantityKg: 100, // 100 packs
    costPerKg: 18.0,  // 18.0 SAR per pack
    totalCost: 1800.0
  };

  // Existing value: 50 * 16.0 = 800 SAR
  // Inflow value: 100 * 18.0 = 1800 SAR
  // New stock: 150 packs
  // New average cost: (800 + 1800) / 150 = 2600 / 150 = 17.33 SAR per pack
  const updatedProducts = applyPurchaseInventory([product], purchase, 1);
  assert.equal(updatedProducts[0].currentStockKg, 150);
  assert.equal(updatedProducts[0].costPerKg, 17.33);
});

test('Tobacco Domain: Purchase Return Workflow (Vendor Debt & Stock deduction)', () => {
  const product = {
    id: 'prod-rothmans',
    name: 'روثمانز أزرق',
    currentStockKg: 150,
    costPerKg: 17.33,
    branchStock: { 'branch-main': 150 }
  };

  const originalPurchase = {
    id: 'pur-101',
    branchId: 'branch-main',
    productId: 'prod-rothmans',
    supplierId: 'sup-tobacco-distributor',
    quantityKg: 100,
    costPerKg: 18.0,
    totalCost: 1800.0,
    returnedKg: 0,
    totalReturnedAmount: 0
  };

  // Return 2 cartons = 20 packs at historical purchase cost 18.0 SAR = 360.00 SAR
  const purchaseReturn = {
    id: 'ret-pur-01',
    purchaseId: 'pur-101',
    productId: 'prod-rothmans',
    supplierId: 'sup-tobacco-distributor',
    returnedKg: 20, // 20 packs
    totalRefundAmount: 360.0,
    refundMethod: 'supplier_debt_deduction'
  };

  // Update purchase record
  const updatedPurchases = applyPurchaseReturnPurchase([originalPurchase], purchaseReturn, 1);
  assert.equal(updatedPurchases[0].returnedKg, 20);
  assert.equal(updatedPurchases[0].totalReturnedAmount, 360.0);
  assert.equal(updatedPurchases[0].hasReturns, true);

  // Update inventory
  const updatedProducts = applyPurchaseReturnInventory([product], originalPurchase, purchaseReturn, 1);
  assert.equal(updatedProducts[0].currentStockKg, 130); // 150 - 20 = 130 packs

  // Update supplier payable balance (decrease debt owed to supplier)
  const suppliers = [{ id: 'sup-tobacco-distributor', balance: 5000.0 }];
  const updatedSuppliers = adjustBalance(suppliers, 'sup-tobacco-distributor', -360.0);
  assert.equal(updatedSuppliers[0].balance, 4640.0);
});

test('Tobacco Domain: Sales Return Workflow with Locked Historical Price Invariance', () => {
  // Product price subsequently increased in catalog from 25.0 to 30.0!
  const product = {
    id: 'prod-camel',
    name: 'كامل أصفر',
    currentStockKg: 80,
    costPerKg: 18.0,
    pricePerKg: 30.0, // New catalog price
    branchStock: { 'branch-main': 80 }
  };

  // Original invoice sold 5 packs at old price 25.0 SAR
  const originalInvoice = {
    id: 'inv-historical-01',
    branchId: 'branch-main',
    items: [
      {
        productId: 'prod-camel',
        name: 'كامل أصفر',
        netWeight: 5, // 5 packs
        pricePerKg: 25.0, // Historical sale price per pack
        unitPrice: 25.0,
        returnedWeight: 0
      }
    ],
    hasReturns: false,
    totalReturnedAmount: 0
  };

  // Customer returns 2 packs
  const salesReturn = {
    id: 'ret-sale-01',
    invoiceId: 'inv-historical-01',
    items: [
      {
        sourceLineIndex: 0,
        productId: 'prod-camel',
        returnedWeight: 2, // 2 packs returned
        originalPricePerKg: 25.0
      }
    ],
    totalRefundAmount: 50.0, // 2 * 25.0 = 50.0 SAR strictly at historical price!
    refundMethod: 'cash',
    inventoryAction: 'restock'
  };

  // 1. Update invoice
  const updatedInvoices = applySalesReturnInvoice([originalInvoice], salesReturn, 1);
  assert.equal(updatedInvoices[0].items[0].returnedWeight, 2);
  assert.equal(updatedInvoices[0].totalReturnedAmount, 50.0);
  assert.equal(updatedInvoices[0].hasReturns, true);

  // 2. Restock product in inventory
  const updatedProducts = applySalesReturnInventory([product], originalInvoice, salesReturn, 1);
  assert.equal(updatedProducts[0].currentStockKg, 82); // 80 + 2 = 82 packs restocked!
});

test('Tobacco Domain: Damaged Tobacco Stock Write-Off (Crushed Pack / Spoiled Carton)', () => {
  const product = {
    id: 'prod-davidoff',
    name: 'ديفيدوف كلاسيك',
    currentStockKg: 100, // 100 packs
    costPerKg: 24.0,     // 24.0 SAR per pack
    branchStock: { 'branch-main': 100 }
  };

  // Write off 1 damaged carton = 10 packs at cost 24.0 = 240.0 SAR
  const damageRecord = {
    id: 'dmg-001',
    branchId: 'branch-main',
    productId: 'prod-davidoff',
    productName: 'ديفيدوف كلاسيك',
    quantityKg: 10,  // 10 packs
    costPerKg: 24.0,
    totalLoss: 240.0,
    reason: 'كرتونة مكسورة ومهشمة'
  };

  const updatedProducts = applyDamageInventory([product], damageRecord, 1);
  assert.equal(updatedProducts[0].currentStockKg, 90); // 100 - 10 = 90 packs remaining
});
