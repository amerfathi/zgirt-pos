# ZGIRT — Authoritative Tobacco Inventory Architecture

## 1. Domain Overview & Principles

In **ZGIRT (زقيرت)**, the business domain is exclusively dedicated to **tobacco retail and wholesale operations** (cigarettes, shisha/molasses, rolling tobacco, vapes, and accessories).

The core packaging hierarchy consists of three levels:
1. **Carton (كرتونة)**: The wholesale distribution unit containing a configured number of packs (default: 10 packs).
2. **Pack (علبة / باقة)**: The central consumer unit and standard retail unit.
3. **Piece (حبة / سجارة فردي)**: The fundamental individual stick sold from an opened pack (default: 20 pieces per pack).

---

## 2. The Authoritative Inventory Base Unit: **PACK (العلبة)**

To maintain absolute mathematical precision and seamless compatibility with durable state replication, double-entry ledgers, and Cloudflare D1 synchronization:

- **The Authoritative Ledger Base Unit is the Pack (العلبة).**
- Stock quantities represent the total count of packs available in inventory.
- Cartons are calculated and converted deterministically using each product's configured `packs_per_carton` (or `packsPerCarton`).
- Pieces sold from an unsealed pack represent fractional packs (e.g. 1 piece = `1 / units_per_pack` of a pack, rounded to two decimal places).
- For integer piece accounting where fractional packs are avoided, 1 Pack = `units_per_pack` integer pieces.

### Hierarchy Formulae:
$$\text{Packs from Cartons} = \text{Cartons} \times \text{packsPerCarton}$$
$$\text{Packs from Pieces} = \frac{\text{Pieces}}{\text{unitsPerPack}}$$
$$\text{Total Base Packs} = (\text{Cartons} \times \text{packsPerCarton}) + \text{Packs} + \left(\frac{\text{Pieces}}{\text{unitsPerPack}}\right)$$

---

## 3. Legacy Compatibility Boundaries (Boundary Aliasing)

The underlying storage and replication engine inherited from Brraka (`khodar-pos`) contains immutable sync events, causal conflict policies, and durable assertions expecting certain numeric field names:
- `currentStockKg`
- `costPerKg`
- `netWeight`
- `quantityKg`
- `returnedKg`

### Invariant Rules:
1. **INTERNAL SYSTEM BOUNDARY ONLY**: These legacy field names are strictly **semantic aliases** for the Authoritative Base Unit (Packs) at the storage and sync boundaries.
2. **ZERO PRODUCE SEMANTICS**: No weight, weighing scale, tare deduction, or vegetable concepts exist in the user interface or business domain logic.
3. **EXACT EQUALITY PRESERVATION**:
   - `quantity` (in packs) $\equiv$ `quantityKg` (for legacy ledger event assertion).
   - `costPerPack` $\equiv$ `costPerKg` (for weighted inventory cost reconciliation).
   - `packsCount` $\equiv$ `netWeight` (for invoice inventory deduction).
   - `stockPacks` $\equiv$ `currentStockKg` (for store state synchronization).

---

## 4. Purchasing, Returns & Damages Lifecycle

### A. Purchases (التوريد والمشتريات)
- A tobacco purchase is conducted by selecting:
  - Unit type: **Carton (كرتونة)** or **Pack (علبة)**.
  - Number of cartons or packs purchased.
  - Cost per carton or cost per pack.
- Normalization:
  - Total packs received = `unit === 'carton' ? quantity * packsPerCarton : quantity`.
  - Cost per pack = `totalCost / totalPacksReceived`.
- The inventory increases by `totalPacksReceived`, and the weighted-average cost per pack is updated deterministically:
$$\text{New Cost Per Pack} = \frac{(\text{Prior Stock} \times \text{Prior Cost}) + (\text{Received Packs} \times \text{Received Cost})}{\text{Prior Stock} + \text{Received Packs}}$$

### B. Purchase Returns (مردودات المشتريات)
- Returns to suppliers are executed against the original purchase record.
- Quantities are specified in cartons or packs.
- The return price is strictly **locked to the historical purchase cost** from the original purchase invoice. Catalog price changes do NOT affect historical returns.
- Inventory is deducted by the exact normalized packs returned.

### C. Sales Returns (مردودات المبيعات)
- Customer refunds and returns are executed against the original customer sales invoice.
- Items are returned in their original sold packaging unit (carton, pack, or piece).
- The refund amount is strictly **locked to the historical line item price** on that specific invoice.
- Inventory is restored to stock by the exact normalized packs returned.

### D. Damaged & Spoiled Stock (الهالك والتوالف)
- Broken packs, damaged cartons, or expired tobacco are logged with unit selection (carton, pack, piece).
- Financial loss is calculated using the locked weighted cost per pack.
- Stock is decremented atomically with full audit trails.

---

## 5. Carton Breaking (فك الكراتين لرف البيع)

- In the single base-unit model (Packs), breaking a closed carton into 10 shelf packs does not change total enterprise packs ($1 \times 10 = 10$).
- When carton breaking is invoked in the POS interface, it functions as an operational shelf-replenishment action, confirming the opening of a sealed carton for loose pack display while preserving immutable inventory totals.
