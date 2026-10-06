-- ====================================================================
-- Cloudflare D1 SQL Schema for Khodar POS (سوق الخضار - كاشير ومحاسبة)
-- Architecture: High-Performance Multi-Tenant Relational Schema (SQLite/D1)
-- Designed for 1,000+ Concurrent Merchants with Complete Tenant Isolation
-- ====================================================================

PRAGMA foreign_keys = ON;

-- 1. Tenants (المشتركون / المؤسسات)
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'company_owner', -- super_admin, company_owner
    status TEXT DEFAULT 'active',      -- active, suspended, expired
    expires_at TEXT,
    allowed_branches INTEGER DEFAULT 3,
    phone TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 2. Branches (الفروع لكل مؤسسة)
CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    phone TEXT,
    address TEXT,
    manager_name TEXT,
    is_main INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_branches_tenant ON branches(tenant_id);

-- 3. Products (أصناف الخضار والفواكه)
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'خضار',
    buy_price REAL DEFAULT 0,
    sell_price REAL DEFAULT 0,
    unit TEXT DEFAULT 'كيلو',
    current_stock_kg REAL DEFAULT 0,
    min_stock_alert REAL DEFAULT 10,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_active ON products(tenant_id, is_active);

-- 4. Branch Inventory (مخزون كل صنف داخل كل فرع)
CREATE TABLE IF NOT EXISTS branch_inventory (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    stock_kg REAL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(branch_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_branch_inventory_lookup ON branch_inventory(tenant_id, branch_id, product_id);

-- 5. Customers (العملاء والذمم المدينة)
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    balance REAL DEFAULT 0, -- رصيد المديونية المستحقة على العميل
    credit_limit REAL DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);

-- 6. Customer Payments (سدادات ديون العملاء)
CREATE TABLE IF NOT EXISTS customer_payments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT DEFAULT 'cash', -- cash, bank
    notes TEXT,
    date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_customer_payments_tenant ON customer_payments(tenant_id, customer_id);

-- 7. Suppliers (الموردون وسوق الجملة)
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    balance REAL DEFAULT 0, -- رصيد المستحقات للمورد (دائن)
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id);

-- 8. Supplier Payments (سداد مستحقات الموردين)
CREATE TABLE IF NOT EXISTS supplier_payments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT DEFAULT 'cash', -- cash, bank
    notes TEXT,
    date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_tenant ON supplier_payments(tenant_id, supplier_id);

-- 9. Invoices (فواتير المبيعات)
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    invoice_number INTEGER NOT NULL,
    customer_id TEXT,
    customer_name TEXT DEFAULT 'زبون نقدي',
    subtotal REAL NOT NULL,
    discount REAL DEFAULT 0,
    total REAL NOT NULL,
    paid_amount REAL NOT NULL,
    payment_method TEXT DEFAULT 'cash', -- cash, network, split, credit
    cash_paid REAL DEFAULT 0,
    bank_paid REAL DEFAULT 0,
    status TEXT DEFAULT 'completed', -- completed, voided
    created_by TEXT,
    date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    synced_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_branch ON invoices(tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_date ON invoices(tenant_id, date);

-- 10. Invoice Items (بنود الفواتير والأوزان)
CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    invoice_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity_kg REAL NOT NULL,
    tare_kg REAL DEFAULT 0,
    net_weight_kg REAL NOT NULL,
    unit_price REAL NOT NULL,
    cost_price REAL DEFAULT 0,
    total REAL NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_invoice_items_lookup ON invoice_items(tenant_id, invoice_id);

-- 11. Purchases (مشتريات الجملة والتوريد)
CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    supplier_id TEXT,
    supplier_name TEXT,
    invoice_number TEXT,
    total_amount REAL NOT NULL,
    paid_cash_amount REAL DEFAULT 0,
    paid_bank_amount REAL DEFAULT 0,
    remaining_debt REAL DEFAULT 0,
    date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_purchases_tenant ON purchases(tenant_id, branch_id);

-- 12. Expenses (المصروفات التشغيلية والنثريات)
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT DEFAULT 'cash', -- cash, bank
    is_supplier_payment INTEGER DEFAULT 0,
    notes TEXT,
    date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expenses(tenant_id, branch_id);

-- 13. Workers & Salaries (العمال والرواتب والسلف)
CREATE TABLE IF NOT EXISTS workers (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    branch_id TEXT,
    name TEXT NOT NULL,
    phone TEXT,
    monthly_salary REAL DEFAULT 0,
    current_balance REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_workers_tenant ON workers(tenant_id);

CREATE TABLE IF NOT EXISTS worker_transactions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    worker_id TEXT NOT NULL,
    type TEXT NOT NULL, -- advance (سلفة), deduction (خصم), bonus (مكافأة), salary_payment (صرف راتب)
    amount REAL NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    notes TEXT,
    date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_worker_trans_tenant ON worker_transactions(tenant_id, worker_id);

-- 14. Partners & Profit Distributions (الشركاء والمسحوبات وتوزيع الأرباح)
CREATE TABLE IF NOT EXISTS partners (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    share_percentage REAL NOT NULL,
    initial_capital REAL DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS partner_drawings (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    partner_id TEXT NOT NULL,
    partner_name TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    notes TEXT,
    date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE
);

-- 15. Real-Time Sync Event Log (سجل مزامنة التعديلات)
CREATE TABLE IF NOT EXISTS sync_events (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    branch_id TEXT,
    entity_type TEXT NOT NULL, -- invoice, product, customer, expense, purchase, etc.
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,      -- create, update, delete
    payload_json TEXT NOT NULL,
    client_timestamp INTEGER NOT NULL,
    server_timestamp INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sync_events_pull ON sync_events(tenant_id, server_timestamp);

-- 16. Cloud Backups (نسخ احتياطية مشفرة وسريعة لكل مؤسسة)
CREATE TABLE IF NOT EXISTS tenant_backups (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    size_bytes INTEGER DEFAULT 0,
    version TEXT DEFAULT '1.0',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_backups_tenant ON tenant_backups(tenant_id, created_at);

-- 17. Staff Users & Granular Permissions (المستخدمون والكاشير والصلاحيات)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    branch_id TEXT DEFAULT 'all',
    name TEXT NOT NULL,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'cashier', -- admin, cashier, accountant, inventory_manager, custom
    status TEXT DEFAULT 'active', -- active, inactive
    phone TEXT,
    permissions_json TEXT NOT NULL, -- JSON blob of 10 granular permissions
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, username)
);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
