/**
 * Packaging and Unit Hierarchy Engine for Tobacco Retail and Wholesale
 * Units: Carton (كرتونة) -> Pack (علبة / باقة) -> Piece (سجارة فردي)
 */

export const UNIT_TYPES = Object.freeze({
  CARTON: 'carton',
  PACK: 'pack',
  PIECE: 'piece'
});

/**
 * Normalizes any quantity of a unit into total packs (the central inventory ledger unit)
 */
export function normalizeToPacks(quantity, unitType, product) {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('Invalid quantity');
  
  const packsPerCarton = Number(product.packs_per_carton || product.packsPerCarton || 10);
  const unitsPerPack = Number(product.units_per_pack || product.unitsPerPack || 20);

  switch (unitType) {
    case UNIT_TYPES.CARTON:
      return Math.round(qty * packsPerCarton * 100) / 100;
    case UNIT_TYPES.PACK:
      return qty;
    case UNIT_TYPES.PIECE:
      return Math.round((qty / unitsPerPack) * 100) / 100;
    default:
      throw new Error(`Unsupported unit type: ${unitType}`);
  }
}

/**
 * Normalizes any quantity into total fundamental pieces (for break-pack sales)
 */
export function normalizeToPieces(quantity, unitType, product) {
  const packs = normalizeToPacks(quantity, unitType, product);
  const unitsPerPack = Number(product.units_per_pack || product.unitsPerPack || 20);
  return Math.round(packs * unitsPerPack);
}

/**
 * General helper to convert quantity of unitType to base packs
 */
export function toBaseUnit(quantity, unitType, packsPerCarton = 10, unitsPerPack = 20) {
  const dummyProduct = { packsPerCarton, unitsPerPack };
  return normalizeToPacks(quantity, unitType, dummyProduct);
}

/**
 * General helper to convert base packs back into specified unitType
 */
export function fromBaseUnit(packs, unitType, packsPerCarton = 10, unitsPerPack = 20) {
  const p = Number(packs);
  switch (unitType) {
    case UNIT_TYPES.CARTON:
      return Math.round((p / packsPerCarton) * 100) / 100;
    case UNIT_TYPES.PACK:
      return p;
    case UNIT_TYPES.PIECE:
      return Math.round(p * unitsPerPack);
    default:
      return p;
  }
}

/**
 * Calculates line total and resolves price tier
 * Supports both cents-based inputs and standard currency (SAR) inputs
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
  const packsPerCarton = Number(product.packs_per_carton || product.packsPerCarton || 10);
  const unitsPerPack = Number(product.units_per_pack || product.unitsPerPack || 20);

  // Check if product uses currency units (SAR) or cents
  const usesCents = product.retail_price_pack_cents !== undefined || product.cost_pack_cents !== undefined;

  let unitPrice = 0;
  let unitPriceCents = 0;

  if (usesCents) {
    if (effectiveWholesale) {
      if (unitType === UNIT_TYPES.CARTON) {
        unitPriceCents = product.wholesale_price_carton_cents || (product.wholesale_price_pack_cents * packsPerCarton);
      } else {
        unitPriceCents = product.wholesale_price_pack_cents || product.retail_price_pack_cents;
      }
    } else {
      if (unitType === UNIT_TYPES.CARTON) {
        unitPriceCents = product.retail_price_carton_cents || (product.retail_price_pack_cents * packsPerCarton);
      } else if (unitType === UNIT_TYPES.PACK) {
        unitPriceCents = product.retail_price_pack_cents;
      } else {
        unitPriceCents = product.retail_price_piece_cents || Math.ceil(product.retail_price_pack_cents / unitsPerPack);
      }
    }
    const subtotalCents = Math.round(unitPriceCents * quantity);
    const totalCents = Math.max(0, subtotalCents - (customDiscountCents || 0));
    const packsCount = normalizeToPacks(quantity, unitType, product);

    return {
      productId: product.id,
      name: product.name_ar || product.name,
      unitType,
      quantity,
      packsCount,
      unitPriceCents,
      subtotalCents,
      discountCents: customDiscountCents || 0,
      totalCents
    };
  }

  // Currency decimal mode (e.g. SAR)
  if (effectiveWholesale) {
    if (unitType === UNIT_TYPES.CARTON) {
      unitPrice = product.wholesalePriceCarton || product.wholesale_price_carton || ((product.wholesalePricePack || product.retailPricePack || 0) * packsPerCarton);
    } else {
      unitPrice = product.wholesalePricePack || product.wholesale_price_pack || product.retailPricePack || product.retail_price_pack || 0;
    }
  } else {
    if (unitType === UNIT_TYPES.CARTON) {
      unitPrice = product.retailPriceCarton || product.retail_price_carton || ((product.retailPricePack || 0) * packsPerCarton);
    } else if (unitType === UNIT_TYPES.PACK) {
      unitPrice = product.retailPricePack || product.retail_price_pack || 0;
    } else {
      unitPrice = product.retailPricePiece || Math.round(((product.retailPricePack || 0) / unitsPerPack) * 100) / 100;
    }
  }

  const subtotal = Math.round(unitPrice * quantity * 100) / 100;
  const total = Math.max(0, Math.round((subtotal - (discountAmount || 0)) * 100) / 100);
  const packsCount = normalizeToPacks(quantity, unitType, product);

  return {
    productId: product.id,
    name: product.name,
    unitType,
    unitName: unitType === UNIT_TYPES.CARTON ? 'كرتونة' : unitType === UNIT_TYPES.PIECE ? 'سيجارة' : 'علبة',
    quantity,
    packsCount,
    packsPerCarton,
    unitsPerPack,
    unitPrice,
    subtotal,
    discountAmount: discountAmount || 0,
    totalPrice: total,
    // Ledger compatibility aliases:
    netWeight: packsCount,
    pricePerKg: unitPrice
  };
}

/**
 * Calculates summary totals for an invoice
 */
export function calculateInvoiceTotals(items = [], globalDiscount = 0) {
  const subtotal = items.reduce((sum, item) => sum + (Number(item.totalPrice ?? item.totalCents ?? 0)), 0);
  const totalPacks = items.reduce((sum, item) => sum + (Number(item.packsCount || 0)), 0);
  const finalTotal = Math.max(0, subtotal - Number(globalDiscount || 0));

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalPacks: Math.round(totalPacks * 100) / 100,
    discount: Number(globalDiscount || 0),
    finalTotal: Math.round(finalTotal * 100) / 100
  };
}
