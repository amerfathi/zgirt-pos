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
  
  const packsPerCarton = product.packs_per_carton || product.packsPerCarton || 10;
  const unitsPerPack = product.units_per_pack || product.unitsPerPack || 20;

  switch (unitType) {
    case UNIT_TYPES.CARTON:
      return qty * packsPerCarton;
    case UNIT_TYPES.PACK:
      return qty;
    case UNIT_TYPES.PIECE:
      // Note: Fractional packs or piece remainder
      return qty / unitsPerPack;
    default:
      throw new Error(`Unsupported unit type: ${unitType}`);
  }
}

/**
 * Normalizes any quantity into total fundamental pieces (for break-pack sales)
 */
export function normalizeToPieces(quantity, unitType, product) {
  const packs = normalizeToPacks(quantity, unitType, product);
  const unitsPerPack = product.units_per_pack || product.unitsPerPack || 20;
  return packs * unitsPerPack;
}

/**
 * Calculates line total and resolves price tier
 */
export function calculateLineItem({ product, unitType, quantity, isWholesale = false, customDiscountCents = 0 }) {
  let unitPriceCents = 0;

  if (isWholesale) {
    if (unitType === UNIT_TYPES.CARTON) {
      unitPriceCents = product.wholesale_price_carton_cents || (product.wholesale_price_pack_cents * (product.packs_per_carton || 10));
    } else {
      unitPriceCents = product.wholesale_price_pack_cents || product.retail_price_pack_cents;
    }
  } else {
    // Retail
    if (unitType === UNIT_TYPES.CARTON) {
      unitPriceCents = product.retail_price_carton_cents || (product.retail_price_pack_cents * (product.packs_per_carton || 10));
    } else if (unitType === UNIT_TYPES.PACK) {
      unitPriceCents = product.retail_price_pack_cents;
    } else {
      unitPriceCents = product.retail_price_piece_cents || Math.ceil(product.retail_price_pack_cents / (product.units_per_pack || 20));
    }
  }

  const subtotalCents = Math.round(unitPriceCents * quantity);
  const totalCents = Math.max(0, subtotalCents - (customDiscountCents || 0));
  const packsCount = normalizeToPacks(quantity, unitType, product);

  return {
    productId: product.id,
    unitType,
    quantity,
    packsCount,
    unitPriceCents,
    subtotalCents,
    discountCents: customDiscountCents || 0,
    totalCents
  };
}
