import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UNIT_TYPES,
  getProductPackagingFactors,
  normalizeToPacks,
  toBaseUnit,
  fromBaseUnit,
  decomposePackStock,
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

test('Tobacco Domain: Configurable Packaging Hierarchy (Products A, B, C)', () => {
  // Product A: 5 packs / sleeve, 10 sleeves / carton = 50 packs / carton
  const prodA = {
    id: 'prod-a',
    name: 'صنف أ',
    category: 'سجائر',
    packsPerSleeve: 5,
    sleevesPerCarton: 10
  };
  const factorsA = getProductPackagingFactors(prodA);
  assert.equal(factorsA.packsPerSleeve, 5);
  assert.equal(factorsA.sleevesPerCarton, 10);
  assert.equal(factorsA.packsPerCarton, 50);

  assert.equal(normalizeToPacks(1, UNIT_TYPES.CARTON, prodA), 50);
  assert.equal(normalizeToPacks(2, UNIT_TYPES.SLEEVE, prodA), 10);
  assert.equal(normalizeToPacks(3, UNIT_TYPES.PACK, prodA), 3);

  // Product B: 10 packs / sleeve, 20 sleeves / carton = 200 packs / carton
  const prodB = {
    id: 'prod-b',
    name: 'صنف ب',
    category: 'سجائر',
    packsPerSleeve: 10,
    sleevesPerCarton: 20
  };
  const factorsB = getProductPackagingFactors(prodB);
  assert.equal(factorsB.packsPerSleeve, 10);
  assert.equal(factorsB.sleevesPerCarton, 20);
  assert.equal(factorsB.packsPerCarton, 200);

  assert.equal(normalizeToPacks(1, UNIT_TYPES.CARTON, prodB), 200);
  assert.equal(normalizeToPacks(3, UNIT_TYPES.SLEEVE, prodB), 30);
  assert.equal(normalizeToPacks(7, UNIT_TYPES.PACK, prodB), 7);

  // Product C: 20 packs / sleeve, 100 sleeves / carton = 2000 packs / carton
  const prodC = {
    id: 'prod-c',
    name: 'صنف ج',
    category: 'سجائر',
    packsPerSleeve: 20,
    sleevesPerCarton: 100
  };
  const factorsC = getProductPackagingFactors(prodC);
  assert.equal(factorsC.packsPerSleeve, 20);
  assert.equal(factorsC.sleevesPerCarton, 100);
  assert.equal(factorsC.packsPerCarton, 2000);

  assert.equal(normalizeToPacks(1, UNIT_TYPES.CARTON, prodC), 2000);
  assert.equal(normalizeToPacks(2, UNIT_TYPES.SLEEVE, prodC), 40);
  assert.equal(normalizeToPacks(5, UNIT_TYPES.PACK, prodC), 5);
});

test('Tobacco Domain: Authoritative Pack Base Unit & Stock Decomposition', () => {
  // Product B: 10 packs/sleeve, 20 sleeves/carton (200 packs/carton)
  const prodB = {
    id: 'prod-b',
    packsPerSleeve: 10,
    sleevesPerCarton: 20
  };

  // Stock: 624 packs -> 3 cartons, 2 sleeves, 4 packs
  const decomp = decomposePackStock(624, prodB);
  assert.equal(decomp.cartons, 3);
  assert.equal(decomp.sleeves, 2);
  assert.equal(decomp.packs, 4);
  assert.equal(decomp.totalPacks, 624);
  assert.equal(decomp.formatted, '3 كرتونة و 2 استيكة و 4 علبة');

  // Exact carton match: 400 packs -> 2 cartons, 0 sleeves, 0 packs
  const exactDecomp = decomposePackStock(400, prodB);
  assert.equal(exactDecomp.cartons, 2);
  assert.equal(exactDecomp.sleeves, 0);
  assert.equal(exactDecomp.packs, 0);
});

test('Tobacco Domain: Independent Configurable Pricing (Pack, Sleeve, Carton)', () => {
  const product = {
    id: 'prod-marlboro',
    name: 'مارلبورو أحمر',
    category: 'سجائر',
    packsPerSleeve: 10,
    sleevesPerCarton: 20, // 200 packs / carton
    retailPricePack: 28.0,
    retailPriceSleeve: 275.0,     // Special sleeve retail price
    retailPriceCarton: 5400.0,    // Special carton retail price (override, not strictly 28*200)
    wholesalePriceSleeve: 265.0,  // Wholesale sleeve price
    wholesalePriceCarton: 5200.0  // Wholesale carton price
  };

  // Retail Pack Sale
  const packSale = calculateLineItem({
    product,
    unitType: UNIT_TYPES.PACK,
    quantity: 2,
    saleMode: 'retail'
  });
  assert.equal(packSale.unitPrice, 28.0);
  assert.equal(packSale.totalPrice, 56.0);
  assert.equal(packSale.packsCount, 2);

  // Retail Sleeve Sale
  const sleeveSale = calculateLineItem({
    product,
    unitType: UNIT_TYPES.SLEEVE,
    quantity: 1,
    saleMode: 'retail'
  });
  assert.equal(sleeveSale.unitPrice, 275.0);
  assert.equal(sleeveSale.totalPrice, 275.0);
  assert.equal(sleeveSale.packsCount, 10);

  // Retail Carton Sale
  const cartonSale = calculateLineItem({
    product,
    unitType: UNIT_TYPES.CARTON,
    quantity: 1,
    saleMode: 'retail'
  });
  assert.equal(cartonSale.unitPrice, 5400.0);
  assert.equal(cartonSale.totalPrice, 5400.0);
  assert.equal(cartonSale.packsCount, 200);

  // Wholesale Sleeve Sale
  const wsSleeveSale = calculateLineItem({
    product,
    unitType: UNIT_TYPES.SLEEVE,
    quantity: 3,
    saleMode: 'wholesale'
  });
  assert.equal(wsSleeveSale.unitPrice, 265.0);
  assert.equal(wsSleeveSale.totalPrice, 795.0);
  assert.equal(wsSleeveSale.packsCount, 30);

  // Wholesale Carton Sale
  const wsCartonSale = calculateLineItem({
    product,
    unitType: UNIT_TYPES.CARTON,
    quantity: 2,
    saleMode: 'wholesale'
  });
  assert.equal(wsCartonSale.unitPrice, 5200.0);
  assert.equal(wsCartonSale.totalPrice, 10400.0);
  assert.equal(wsCartonSale.packsCount, 400);
});

test('Tobacco Domain: Individual Cigarette Piece Sale is Blocked for Cigarettes', () => {
  const cigaretteProd = {
    id: 'prod-cigs',
    name: 'سجائر وينستون',
    category: 'سجائر',
    packsPerSleeve: 10,
    sleevesPerCarton: 20
  };

  assert.throws(() => {
    normalizeToPacks(1, UNIT_TYPES.PIECE, cigaretteProd);
  }, /بيع أو تخزين السجائر بالحبة المفردة غير مدعوم/);
});

test('Tobacco Domain: Purchases with Product-Specific Packaging & Weighted Average Cost', () => {
  // Product B: 10 packs/sleeve, 20 sleeves/carton (200 packs/carton)
  const product = {
    id: 'prod-winston',
    name: 'وينستون أزرق',
    category: 'سجائر',
    packsPerSleeve: 10,
    sleevesPerCarton: 20,
    packsPerCarton: 200,
    currentStockKg: 200, // 200 packs initial stock
    costPerKg: 15.0,     // 15.0 SAR per pack initial cost
    branchStock: { 'branch-main': 200 }
  };

  // Purchase: 4 cartons at 3200 SAR per carton = 12800 SAR
  // 4 cartons * 200 packs = 800 packs
  // Cost per pack = 3200 / 200 = 16.0 SAR per pack
  const purchase = {
    id: 'pur-201',
    branchId: 'branch-main',
    productId: 'prod-winston',
    productName: 'وينستون أزرق',
    purchaseUnit: 'carton',
    purchaseQuantity: 4,
    packsPerSleeve: 10,
    sleevesPerCarton: 20,
    packsPerCarton: 200,
    quantityKg: 800, // 800 packs
    costPerKg: 16.0,  // 16.0 SAR per pack
    totalCost: 12800.0
  };

  // Existing value: 200 * 15.0 = 3000 SAR
  // Incoming value: 800 * 16.0 = 12800 SAR
  // New stock: 1000 packs
  // Weighted average cost = (3000 + 12800) / 1000 = 15800 / 1000 = 15.80 SAR per pack
  const updatedProducts = applyPurchaseInventory([product], purchase, 1);
  assert.equal(updatedProducts[0].currentStockKg, 1000);
  assert.equal(updatedProducts[0].costPerKg, 15.8);
});

test('Tobacco Domain: Purchase Return Workflow (Cartons, Sleeves, Packs at Historical Cost)', () => {
  const product = {
    id: 'prod-winston',
    name: 'وينستون أزرق',
    currentStockKg: 1000,
    costPerKg: 15.8,
    branchStock: { 'branch-main': 1000 }
  };

  const originalPurchase = {
    id: 'pur-201',
    branchId: 'branch-main',
    productId: 'prod-winston',
    supplierId: 'sup-main',
    purchaseUnit: 'carton',
    purchaseQuantity: 4,
    packsPerSleeve: 10,
    sleevesPerCarton: 20,
    packsPerCarton: 200,
    quantityKg: 800, // 800 packs originally received
    costPerKg: 16.0,  // Historical cost: 16.0 SAR per pack
    totalCost: 12800.0,
    returnedKg: 0,
    totalReturnedAmount: 0
  };

  // Return 1 carton = 200 packs at historical cost 16.0 = 3200.0 SAR
  const purchaseReturn = {
    id: 'ret-pur-01',
    purchaseId: 'pur-201',
    productId: 'prod-winston',
    supplierId: 'sup-main',
    returnedKg: 200, // 200 packs
    totalRefundAmount: 3200.0,
    refundMethod: 'supplier_debt_deduction'
  };

  const updatedPurchases = applyPurchaseReturnPurchase([originalPurchase], purchaseReturn, 1);
  assert.equal(updatedPurchases[0].returnedKg, 200);
  assert.equal(updatedPurchases[0].totalReturnedAmount, 3200.0);
  assert.equal(updatedPurchases[0].hasReturns, true);

  const updatedProducts = applyPurchaseReturnInventory([product], originalPurchase, purchaseReturn, 1);
  assert.equal(updatedProducts[0].currentStockKg, 800); // 1000 - 200 = 800 packs
});

test('Tobacco Domain: Sales Return with Historical Packaging & Price Invariance', () => {
  // Product packaging & catalog price changed in store settings later!
  const product = {
    id: 'prod-camel',
    name: 'كامل أصفر',
    currentStockKg: 500,
    costPerKg: 18.0,
    retailPricePack: 35.0, // New catalog price
    packsPerSleeve: 10,
    sleevesPerCarton: 20,
    packsPerCarton: 200,
    branchStock: { 'branch-main': 500 }
  };

  // Original invoice sold 2 sleeves (Product A packaging at that time: 5 packs/sleeve = 10 packs)
  // at historical price 30.0 SAR per pack
  const originalInvoice = {
    id: 'inv-camel-01',
    branchId: 'branch-main',
    items: [
      {
        productId: 'prod-camel',
        name: 'كامل أصفر',
        unitType: 'sleeve',
        unitName: 'استيكة',
        quantity: 2,
        packsPerSleeve: 5, // Historical transaction factor
        packsPerCarton: 50,
        netWeight: 10,     // 10 packs sold
        pricePerKg: 30.0,  // Historical price per pack locked on invoice
        unitPrice: 150.0,
        returnedWeight: 0
      }
    ],
    hasReturns: false,
    totalReturnedAmount: 0
  };

  // Customer returns 1 sleeve (= 5 packs at historical 30.0 SAR = 150.0 SAR)
  const salesReturn = {
    id: 'ret-sale-camel',
    invoiceId: 'inv-camel-01',
    items: [
      {
        sourceLineIndex: 0,
        productId: 'prod-camel',
        returnedWeight: 5, // 5 packs returned
        originalPricePerKg: 30.0
      }
    ],
    totalRefundAmount: 150.0,
    refundMethod: 'cash',
    inventoryAction: 'restock'
  };

  const updatedInvoices = applySalesReturnInvoice([originalInvoice], salesReturn, 1);
  assert.equal(updatedInvoices[0].items[0].returnedWeight, 5);
  assert.equal(updatedInvoices[0].totalReturnedAmount, 150.0);

  const updatedProducts = applySalesReturnInventory([product], originalInvoice, salesReturn, 1);
  assert.equal(updatedProducts[0].currentStockKg, 505); // 500 + 5 = 505 integer packs
});

test('Tobacco Domain: Damaged Tobacco Write-Off (Carton, Sleeve, Pack Normalization)', () => {
  const product = {
    id: 'prod-davidoff',
    name: 'ديفيدوف كلاسيك',
    category: 'سجائر',
    packsPerSleeve: 10,
    sleevesPerCarton: 20,
    packsPerCarton: 200,
    currentStockKg: 500, // 500 packs
    costPerKg: 24.0,     // 24.0 SAR per pack
    branchStock: { 'branch-main': 500 }
  };

  // Write off 1 crushed sleeve = 10 packs
  const damageRecord = {
    id: 'dmg-002',
    branchId: 'branch-main',
    productId: 'prod-davidoff',
    productName: 'ديفيدوف كلاسيك',
    damageUnit: 'sleeve',
    enteredQuantity: 1,
    quantityKg: 10,  // 10 packs normalized
    costPerKg: 24.0,
    totalLoss: 240.0,
    reason: 'استيكة مسحوقة وتالفة'
  };

  const updatedProducts = applyDamageInventory([product], damageRecord, 1);
  assert.equal(updatedProducts[0].currentStockKg, 490); // 500 - 10 = 490 packs
});
