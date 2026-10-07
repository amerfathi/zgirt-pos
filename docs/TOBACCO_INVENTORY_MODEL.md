# ZGIRT — Authoritative Cigarette & Tobacco Packaging & Inventory Architecture

## 1. Domain Overview & Flexible Packaging Model

In **ZGIRT (زقيرت)**, the business domain is exclusively designed for **tobacco retail and wholesale operations**.

For **cigarette products (السجائر والدخان)**, the architecture strictly enforces:
- **No single-cigarette / individual-stick sales.**
- **No fractional-pack inventory.**
- **PACK (العلبة)** is the authoritative inventory base unit (strictly an **INTEGER** count).
- Fully configurable packaging hierarchy per product (no hardcoded multipliers):
  1. **Carton (كرتونة)**: Wholesale outer carton.
  2. **Sleeve (استيكة)**: Intermediate bundle containing a configurable number of packs.
  3. **Pack (علبة)**: Smallest selling and inventory unit.

---

## 2. Product-Specific Packaging Configuration

Each cigarette product has independent, merchant-defined packaging configuration:

1. **Packs per Sleeve (`packsPerSleeve` / عدد العلب في الاستيكة)**:
   - Example values: `5`, `10`, `20`, or any positive integer.
2. **Sleeves per Carton (`sleevesPerCarton` / عدد الاستيكات في الكرتونة)**:
   - Example values: `10`, `20`, `100`, or any positive integer.
3. **Calculated Packs per Carton (`packsPerCarton` / إجمالي العلب بالكرتونة)**:
   $$\text{packsPerCarton} = \text{packsPerSleeve} \times \text{sleevesPerCarton}$$

### Examples of Product Configurations:
- **Product A**: 5 packs / sleeve, 10 sleeves / carton $\implies$ 50 packs / carton.
- **Product B**: 10 packs / sleeve, 20 sleeves / carton $\implies$ 200 packs / carton.
- **Product C**: 20 packs / sleeve, 100 sleeves / carton $\implies$ 2000 packs / carton.

---

## 3. Authoritative Inventory Base Unit: **PACK (العلبة)**

All cigarette inventory is recorded, tracked, and stored internally as an **integer number of packs**:
- 1 Pack = 1 inventory unit.
- 1 Sleeve = configured `packsPerSleeve` packs.
- 1 Carton = configured `packsPerSleeve` $\times$ `sleevesPerCarton` packs.

No cigarette operation creates fractional packs, and no rounding or decimal drift occurs in inventory counts.

### Intelligent Stock Decomposition Display:
Although stored as an integer pack count, stock is displayed in natural hierarchical packaging:
$$\text{Cartons} = \left\lfloor \frac{\text{totalPacks}}{\text{packsPerCarton}} \right\rfloor$$
$$\text{Remainder} = \text{totalPacks} \pmod{\text{packsPerCarton}}$$
$$\text{Sleeves} = \left\lfloor \frac{\text{Remainder}}{\text{packsPerSleeve}} \right\rfloor$$
$$\text{Packs} = \text{Remainder} \pmod{\text{packsPerSleeve}}$$

**Example**: For a product with 10 packs/sleeve and 20 sleeves/carton (200 packs/carton), 624 packs are displayed as:
$$\text{3 كرتونة و 2 استيكة و 4 علبة}$$

---

## 4. Sales & Independent Configurable Pricing

Selling cigarette products is supported by:
- **Carton / كرتونة**
- **Sleeve / استيكة**
- **Pack / علبة**

Pricing is independent and merchant-configurable for:
- Retail pack price
- Retail sleeve price
- Retail carton price
- Wholesale sleeve price
- Wholesale carton price

Carton price does not have to be a simple multiple of pack price; merchants can freely configure wholesale discounts and tier overrides.

Multi-level barcode scanning is supported without synthetic codes:
- Pack Barcode
- Sleeve Barcode
- Carton Barcode

---

## 5. Purchasing, Returns & Damages Lifecycle

### A. Purchases (التوريد والمشتريات)
- Purchasing is supported in: **Cartons**, **Sleeves**, or **Packs**.
- Inflow is normalized to integer packs:
  - If purchasing 4 cartons of Product B (10 packs/sleeve, 20 sleeves/carton):
    $$\text{Received} = 4 \times 20 \times 10 = 800 \text{ packs}$$
- The purchase invoice retains the **original transaction packaging factors**:
  - `purchaseUnit`
  - `purchaseQuantity`
  - `packsPerSleeve` at transaction time
  - `sleevesPerCarton` at transaction time
  - `packsPerCarton` at transaction time
  - `normalizedCostPerPack`
- Weighted-average cost per pack is updated dynamically.

### B. Purchase Returns (مردودات المشتريات للمورد)
- Executed against original purchase records using the **transaction's recorded packaging factors**.
- Allowed in Cartons, Sleeves, or Packs.
- Locked strictly to historical purchase cost per pack.

### C. Sales Returns (مردودات المبيعات من الزبائن)
- Executed against original customer invoices using the **historical line-item packaging configuration and locked prices**.
- Allowed in Cartons, Sleeves, or Packs.
- Prevents returning more than the originally sold quantities.

### D. Damaged Stock (التوالف وإعدام البضاعة)
- Recorded as Carton, Sleeve, or Pack.
- Normalized into integer packs without fractional losses or produce/weight terminology.
- Financial loss evaluated using the locked cost per pack.

---

## 6. Legacy Storage Compatibility Boundaries

The underlying storage and replication engine inherited from Brraka (`khodar-pos`) contains immutable sync events expecting certain numeric field names:
- `quantity` (in packs) $\equiv$ `quantityKg` (for legacy ledger event assertion).
- `costPerPack` $\equiv$ `costPerKg` (for weighted inventory cost reconciliation).
- `packsCount` $\equiv$ `netWeight` (for invoice inventory deduction).
- `stockPacks` $\equiv$ `currentStockKg` (for store state synchronization).

These field names exist strictly as semantic aliases at the database and synchronization boundary. All user-facing workflows and business logic are 100% tobacco and packaging-driven.
