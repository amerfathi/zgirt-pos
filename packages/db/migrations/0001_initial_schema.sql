-- ZGIRT (زقيرت) Tobacco POS — Core Schema
-- Database: Cloudflare D1 (SQLite)
-- Strict Multi-Tenant Isolation with Foreign Key Cascades & Triggers

PRAGMA foreign_keys = ON;

-- 1. Tenants / Companies (المؤسسات / الشركات المالكة)
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    trade_license TEXT,
    tax_number TEXT,
    phone TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired')),
    currency TEXT DEFAULT 'USD',
    allowed_branches INTEGER DEFAULT 5,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 2. Branches (الفروع ونقاط البيع)
CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    phone TEXT,
    address TEXT,
    is_main INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_branches_tenant ON branches(tenant_id);

CREATE TRIGGER IF NOT EXISTS trg_branches_limit
BEFORE INSERT ON branches
WHEN (SELECT COUNT(*) FROM branches WHERE tenant_id = NEW.tenant_id) >=
     (SELECT COALESCE(allowed_branches, 1) FROM tenants WHERE id = NEW.tenant_id)
BEGIN
  SELECT RAISE(ABORT, 'BRANCH_LIMIT_EXCEEDED');
END;

-- 3. Users & RBAC (المستخدمون والأدوار)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'store_manager', 'cashier', 'accountant', 'inventory', 'auditor')),
    branch_id TEXT, -- Null means all branches (owner/admin)
    permissions_json TEXT, -- Optional granular overrides
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    auth_version INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
    UNIQUE(tenant_id, username)
);
CREATE INDEX IF NOT EXISTS idx_users_tenant_auth ON users(tenant_id, username, status);

-- 4. Sessions (جلسات المصادقة الآمنة)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    credential_version INTEGER DEFAULT 1,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash, revoked_at, expires_at);

-- 5. Brands & Tobacco Categories (الماركات والتصنيفات)
CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    country_of_origin TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_brands_tenant ON brands(tenant_id);

-- 6. Products (منتجات التبغ والسجائر مع الهيكلية الحجمية)
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    brand_id TEXT,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    sku TEXT,
    category TEXT DEFAULT 'cigarettes', -- cigarettes, cigars, vape, molass_tobacco, accessories
    
    -- Packaging Multipliers: 1 Carton = packs_per_carton Packs; 1 Pack = units_per_pack Pieces
    packs_per_carton INTEGER NOT NULL DEFAULT 10,
    units_per_pack INTEGER NOT NULL DEFAULT 20,
    
    -- Barcodes per tier
    barcode_piece TEXT,
    barcode_pack TEXT,
    barcode_carton TEXT,
    
    -- Base unit for inventory stock is always "PIECE" (حبة فردي) or "PACK" (علبة)
    base_unit TEXT DEFAULT 'pack' CHECK (base_unit IN ('piece', 'pack', 'carton')),
    
    -- Cost in Integer Cents
    cost_piece_cents INTEGER DEFAULT 0,
    cost_pack_cents INTEGER DEFAULT 0,
    cost_carton_cents INTEGER DEFAULT 0,
    
    -- Retail Prices in Integer Cents
    retail_price_piece_cents INTEGER DEFAULT 0,
    retail_price_pack_cents INTEGER DEFAULT 0,
    retail_price_carton_cents INTEGER DEFAULT 0,
    
    -- Wholesale Prices in Integer Cents
    wholesale_price_pack_cents INTEGER DEFAULT 0,
    wholesale_price_carton_cents INTEGER DEFAULT 0,
    
    min_stock_alert_packs INTEGER DEFAULT 50,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_products_tenant_active ON products(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_barcodes ON products(tenant_id, barcode_pack, barcode_carton);

-- 7. Branch Inventory (مخزون الفروع بالوحدة الأساسية - علب/بواكي)
CREATE TABLE IF NOT EXISTS branch_inventory (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    stock_packs INTEGER NOT NULL DEFAULT 0,
    stock_pieces INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(branch_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_branch_inventory_lookup ON branch_inventory(tenant_id, branch_id, product_id);

-- 8. Customers & Wholesale Accounts (العملاء وتجار الجملة والذمم)
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    customer_type TEXT DEFAULT 'retail' CHECK (customer_type IN ('retail', 'wholesale')),
    balance_cents INTEGER NOT NULL DEFAULT 0, -- Positive = Customer owes money, Negative = Prepaid
    credit_limit_cents INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_type ON customers(tenant_id, customer_type);

-- 9. Suppliers (الموردون وشركات التوزيع)
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    company_name TEXT,
    phone TEXT,
    balance_cents INTEGER NOT NULL DEFAULT 0, -- Positive = We owe supplier
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id);

-- 10. Cash Drawers & Shifts (الورديات النقدية والأدراج)
CREATE TABLE IF NOT EXISTS cash_shifts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    drawer_id TEXT NOT NULL,
    cashier_user_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    opened_at TEXT NOT NULL,
    closed_at TEXT,
    opening_cash_cents INTEGER NOT NULL DEFAULT 0,
    expected_cash_cents INTEGER NOT NULL DEFAULT 0,
    counted_cash_cents INTEGER,
    variance_cents INTEGER,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'closed_local')),
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (cashier_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_branch_status ON cash_shifts(tenant_id, branch_id, status);

-- 11. Sales Invoices (فواتير المبيعات - تجزئة وجملة)
CREATE TABLE IF NOT EXISTS sales_invoices (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    shift_id TEXT,
    cashier_user_id TEXT NOT NULL,
    customer_id TEXT,
    invoice_number TEXT NOT NULL,
    sale_type TEXT DEFAULT 'retail' CHECK (sale_type IN ('retail', 'wholesale')),
    
    subtotal_cents INTEGER NOT NULL,
    discount_cents INTEGER NOT NULL DEFAULT 0,
    tax_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL,
    
    paid_cash_cents INTEGER NOT NULL DEFAULT 0,
    paid_card_cents INTEGER NOT NULL DEFAULT 0,
    credit_due_cents INTEGER NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL CHECK (payment_status IN ('paid', 'partial', 'unpaid', 'void')),
    
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (cashier_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (shift_id) REFERENCES cash_shifts(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_branch ON sales_invoices(tenant_id, branch_id, created_at);

-- 12. Sales Invoice Items (بنود فاتورة البيع)
CREATE TABLE IF NOT EXISTS sales_invoice_items (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    invoice_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    unit_type TEXT NOT NULL CHECK (unit_type IN ('carton', 'pack', 'piece')),
    quantity INTEGER NOT NULL,
    packs_count INTEGER NOT NULL, -- Total normalized packs for inventory deduction
    unit_price_cents INTEGER NOT NULL,
    total_cents INTEGER NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON sales_invoice_items(invoice_id);

-- 13. Purchase Invoices (فواتير مشتريات التبغ من الوكلاء)
CREATE TABLE IF NOT EXISTS purchase_invoices (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    total_cents INTEGER NOT NULL,
    paid_cash_cents INTEGER NOT NULL DEFAULT 0,
    credit_due_cents INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS purchase_invoice_items (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    purchase_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    cartons_count INTEGER NOT NULL DEFAULT 0,
    packs_count INTEGER NOT NULL DEFAULT 0,
    total_cost_cents INTEGER NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (purchase_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 14. Customer Payments / Collections (سدادات ديون العملاء)
CREATE TABLE IF NOT EXISTS customer_payments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    shift_id TEXT,
    branch_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank', 'check')),
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (shift_id) REFERENCES cash_shifts(id) ON DELETE SET NULL,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
);

-- 15. Expenses (المصروفات النثرية والتشغيلية)
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    shift_id TEXT,
    category TEXT NOT NULL, -- rent, electricity, municipal_fees, packaging, other
    amount_cents INTEGER NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (shift_id) REFERENCES cash_shifts(id) ON DELETE SET NULL
);

-- 16. Audit Log (سجل العمليات الحساسة)
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT,
    branch_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details_json TEXT,
    ip_address TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_created ON audit_logs(tenant_id, created_at);

-- 17. Causal Sync Engine (محرك المزامنة السببية للأجهزة والمحطات المنفصلة)
CREATE TABLE IF NOT EXISTS sync_events (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL,
    branch_id TEXT,
    group_id TEXT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'void')),
    payload_json TEXT NOT NULL,
    conflict_policy_version INTEGER DEFAULT 1,
    preconditions_json TEXT,
    client_timestamp TEXT NOT NULL,
    server_timestamp TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sync_events_seq ON sync_events(tenant_id, sequence);

CREATE TABLE IF NOT EXISTS sync_conflict_heads (
    tenant_id TEXT NOT NULL,
    conflict_key TEXT NOT NULL,
    last_event_id TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (tenant_id, conflict_key),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
