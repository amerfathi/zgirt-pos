/**
 * Packaging and Unit Hierarchy Engine for Tobacco & Retail Wholesale (ZGIRT)
 * 
 * Supports packaging profiles:
 * - Cigarettes: Carton (كرتونة) -> Sleeve (استيكة) -> Pack (علبة)
 *   * Authoritative base inventory unit: PACK (علبة) (Integer count)
 *   * No selling by individual cigarette pieces / sticks.
 *   * Configurable per product: packsPerSleeve (default 10) & sleevesPerCarton (default 20 or 50)
 *   * packsPerCarton = packsPerSleeve * sleevesPerCarton
 * - Vape / Lighter: Carton -> Box -> Piece (item count)
 * - Shisha / Molasses: Carton -> Container / Pack
 */

export const UNIT_TYPES = Object.freeze({
  CARTON: 'carton',   // كرتونة
  SLEEVE: 'sleeve',   // استيكة
  PACK: 'pack',       // علبة
  BOX: 'box',         // باكت / علبة وسط
  PIECE: 'piece'      // حبة (فقط للملحقات والفيب والولاعات - ممنوع للسجائر)
});

/**
 * Returns the effective packaging multipliers for a product
 */
export function getProductPackagingFactors(product = {}) {
  const packsPerSleeve = Number(product.packsPerSleeve || product.packs_per_sleeve || 10);
  const sleevesPerCarton = Number(product.sleevesPerCarton || product.sleeves_per_carton || 
    (product.packsPerCarton && packsPerSleeve ? Math.max(1, Math.round(Number(product.packsPerCarton) / packsPerSleeve)) : 20));
  const packsPerCarton = Number(product.packsPerCarton || product.packs_per_carton || (packsPerSleeve * sleevesPerCarton));

  return {
    packsPerSleeve: packsPerSleeve > 0 ? packsPerSleeve : 10,
    sleevesPerCarton: sleevesPerCarton > 0 ? sleevesPerCarton : 20,
    packsPerCarton: packsPerCarton > 0 ? packsPerCarton : (packsPerSleeve * sleevesPerCarton)
  };
}

/**
 * Normalizes any quantity of a unit into total packs (the central authoritative inventory ledger unit)
 * For cigarette products:
 * - 1 Pack = 1 pack
 * - 1 Sleeve = packsPerSleeve packs
 * - 1 Carton = packsPerCarton (packsPerSleeve * sleevesPerCarton) packs
 * Returns integer packs for cigarette operations.
 */
export function normalizeToPacks(quantity, unitType, product = {}) {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('Invalid quantity');

  const { packsPerSleeve, sleevesPerCarton, packsPerCarton } = getProductPackagingFactors(product);

  switch (unitType) {
    case UNIT_TYPES.CARTON:
    case 'carton':
    case 'كرتونة':
      return Math.round(qty * packsPerCarton);
    case UNIT_TYPES.SLEEVE:
    case 'sleeve':
    case 'استيكة':
      return Math.round(qty * packsPerSleeve);
    case UNIT_TYPES.PACK:
    case 'pack':
    case 'علبة':
      return Math.round(qty);
    case UNIT_TYPES.BOX:
    case 'box':
      return Math.round(qty * packsPerSleeve);
    case UNIT_TYPES.PIECE:
    case 'piece':
    case 'حبة': {
      // Disallow piece sales for cigarettes
      const category = String(product.category || '').trim();
      if (category === 'سجائر' || category === 'دخان' || category === 'cigarettes' || !category) {
        throw new Error('بيع أو تخزين السجائر بالحبة المفردة غير مدعوم؛ الوحدة الأساسية هي العلبة (Pack)');
      }
      const unitsPerPack = Number(product.unitsPerPack || product.units_per_pack || 1);
      return Math.round((qty / unitsPerPack) * 100) / 100;
    }
    default:
      throw new Error(`Unsupported unit type: ${unitType}`);
  }
}

/**
 * General helper to convert quantity of unitType to base packs
 */
export function toBaseUnit(quantity, unitType, packsPerSleeve = 10, sleevesPerCarton = 20) {
  const packsPerCarton = packsPerSleeve * sleevesPerCarton;
  const dummyProduct = { packsPerSleeve, sleevesPerCarton, packsPerCarton };
  return normalizeToPacks(quantity, unitType, dummyProduct);
}

/**
 * General helper to convert base packs back into specified unitType
 */
export function fromBaseUnit(packs, unitType, packsPerSleeve = 10, sleevesPerCarton = 20) {
  const p = Number(packs);
  const packsPerCarton = packsPerSleeve * sleevesPerCarton;
  switch (unitType) {
    case UNIT_TYPES.CARTON:
    case 'carton':
      return Math.floor(p / packsPerCarton);
    case UNIT_TYPES.SLEEVE:
    case 'sleeve':
      return Math.floor((p % packsPerCarton) / packsPerSleeve);
    case UNIT_TYPES.PACK:
    case 'pack':
      return p;
    default:
      return p;
  }
}

/**
 * Decomposes an integer pack count into natural hierarchical units:
 * Cartons, Sleeves, and leftover Packs.
 * Example: 624 packs with 10 packs/sleeve & 20 sleeves/carton (200 packs/carton):
 * => { cartons: 3, sleeves: 2, packs: 4, summary: '3 كرتونة، 2 استيكة، 4 علبة' }
 */
export function decomposePackStock(totalPacks, product = {}) {
  const p = Math.max(0, Math.floor(Number(totalPacks) || 0));
  const { packsPerSleeve, packsPerCarton } = getProductPackagingFactors(product);

  const cartons = Math.floor(p / packsPerCarton);
  const remainingAfterCartons = p % packsPerCarton;
  const sleeves = Math.floor(remainingAfterCartons / packsPerSleeve);
  const packs = remainingAfterCartons % packsPerSleeve;

  const parts = [];
  if (cartons > 0) parts.push(`${cartons} كرتونة`);
  if (sleeves > 0) parts.push(`${sleeves} استيكة`);
  if (packs > 0 || parts.length === 0) parts.push(`${packs} علبة`);

  return {
    cartons,
    sleeves,
    packs,
    totalPacks: p,
    formatted: parts.join(' و ')
  };
}

/**
 * Calculates line total and resolves price tier
 * Supports Carton, Sleeve, and Pack sales
 */
export function calculateLineItem({ 
  product, 
  unitType, 
  quantity, 
  saleMode = 'retail', 
  isWholesale = false, 
  customDiscountCents = 0,
  discountAmount = 0 
}) {
  const effectiveWholesale = isWholesale || saleMode === 'wholesale';
  const { packsPerSleeve, sleevesPerCarton, packsPerCarton } = getProductPackagingFactors(product);

  // Determine unit label
  let unitName = 'علبة';
  if (unitType === UNIT_TYPES.CARTON) unitName = 'كرتونة';
  else if (unitType === UNIT_TYPES.SLEEVE) unitName = 'استيكة';

  // Base prices
  let retailPack = 0;
  if (product.retailPricePack !== undefined && Number.isFinite(Number(product.retailPricePack))) {
    retailPack = Number(product.retailPricePack);
  } else if (product.retail_price_pack_cents !== undefined && Number.isFinite(Number(product.retail_price_pack_cents))) {
    retailPack = Number(product.retail_price_pack_cents) / 100;
  } else if (product.defaultPricePerKg !== undefined && Number.isFinite(Number(product.defaultPricePerKg))) {
    retailPack = Number(product.defaultPricePerKg);
  }

  let retailSleeve = 0;
  if (product.retailPriceSleeve !== undefined && Number.isFinite(Number(product.retailPriceSleeve))) {
    retailSleeve = Number(product.retailPriceSleeve);
  } else if (product.retail_price_sleeve_cents !== undefined && Number.isFinite(Number(product.retail_price_sleeve_cents))) {
    retailSleeve = Number(product.retail_price_sleeve_cents) / 100;
  } else {
    retailSleeve = Math.round(retailPack * packsPerSleeve * 100) / 100;
  }

  let retailCarton = 0;
  if (product.retailPriceCarton !== undefined && Number.isFinite(Number(product.retailPriceCarton))) {
    retailCarton = Number(product.retailPriceCarton);
  } else if (product.retail_price_carton_cents !== undefined && Number.isFinite(Number(product.retail_price_carton_cents))) {
    retailCarton = Number(product.retail_price_carton_cents) / 100;
  } else {
    retailCarton = Math.round(retailPack * packsPerCarton * 100) / 100;
  }

  let wholesaleSleeve = 0;
  if (product.wholesalePriceSleeve !== undefined && Number.isFinite(Number(product.wholesalePriceSleeve))) {
    wholesaleSleeve = Number(product.wholesalePriceSleeve);
  } else if (product.wholesale_price_sleeve_cents !== undefined && Number.isFinite(Number(product.wholesale_price_sleeve_cents))) {
    wholesaleSleeve = Number(product.wholesale_price_sleeve_cents) / 100;
  } else {
    wholesaleSleeve = Math.round(retailSleeve * 0.95 * 100) / 100;
  }

  let wholesaleCarton = 0;
  if (product.wholesalePriceCarton !== undefined && Number.isFinite(Number(product.wholesalePriceCarton))) {
    wholesaleCarton = Number(product.wholesalePriceCarton);
  } else if (product.wholesale_price_carton_cents !== undefined && Number.isFinite(Number(product.wholesale_price_carton_cents))) {
    wholesaleCarton = Number(product.wholesale_price_carton_cents) / 100;
  } else {
    wholesaleCarton = Math.round(retailCarton * 0.95 * 100) / 100;
  }

  let wholesalePack = 0;
  if (product.wholesalePricePack !== undefined && Number.isFinite(Number(product.wholesalePricePack))) {
    wholesalePack = Number(product.wholesalePricePack);
  } else if (product.wholesale_price_pack_cents !== undefined && Number.isFinite(Number(product.wholesale_price_pack_cents))) {
    wholesalePack = Number(product.wholesale_price_pack_cents) / 100;
  } else {
    wholesalePack = retailPack;
  }

  let unitPrice = 0;
  if (effectiveWholesale) {
    if (unitType === UNIT_TYPES.CARTON) {
      unitPrice = wholesaleCarton;
    } else if (unitType === UNIT_TYPES.SLEEVE) {
      unitPrice = wholesaleSleeve;
    } else {
      unitPrice = wholesalePack;
    }
  } else {
    if (unitType === UNIT_TYPES.CARTON) {
      unitPrice = retailCarton;
    } else if (unitType === UNIT_TYPES.SLEEVE) {
      unitPrice = retailSleeve;
    } else {
      unitPrice = retailPack;
    }
  }

  const subtotal = Math.round(unitPrice * quantity * 100) / 100;
  const total = Math.max(0, Math.round((subtotal - (discountAmount || (customDiscountCents ? customDiscountCents / 100 : 0))) * 100) / 100);
  const packsCount = normalizeToPacks(quantity, unitType, product);

  const subtotalCents = Math.round(unitPrice * quantity * 100);
  const effectiveDiscountCents = customDiscountCents || Math.round((discountAmount || 0) * 100);
  const totalCents = Math.max(0, subtotalCents - effectiveDiscountCents);

  return {
    productId: product.id,
    name: product.name || product.name_ar,
    unitType,
    unitName,
    quantity,
    packsCount,
    packsPerSleeve,
    sleevesPerCarton,
    packsPerCarton,
    unitPrice,
    unitPriceCents: Math.round(unitPrice * 100),
    subtotal,
    subtotalCents,
    discountAmount: discountAmount || (customDiscountCents ? customDiscountCents / 100 : 0),
    discountCents: effectiveDiscountCents,
    totalPrice: total,
    totalCents,
    // Ledger compatibility aliases:
    netWeight: packsCount,
    pricePerKg: unitPrice
  };
}

/**
 * Calculates summary totals for an invoice
 */
export function calculateInvoiceTotals(items = [], globalDiscount = 0) {
  const subtotal = items.reduce((sum, item) => sum + (Number(item.totalPrice ?? item.total ?? item.totalCents ? (item.totalCents / 100) : 0)), 0);
  const totalPacks = items.reduce((sum, item) => sum + (Number(item.packsCount || item.netWeight || 0)), 0);
  const finalTotal = Math.max(0, subtotal - Number(globalDiscount || 0));

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalPacks: Math.round(totalPacks),
    discount: Number(globalDiscount || 0),
    finalTotal: Math.round(finalTotal * 100) / 100
  };
}
