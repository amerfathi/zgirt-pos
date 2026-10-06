-- EMPTY DATABASE BOOTSTRAP ONLY. Generated from migrations 0001 through 0014.
-- Existing databases: use the D1 migration ledger; do not rerun this file.
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
CREATE TRIGGER branches_limit_before_insert
BEFORE INSERT ON branches
WHEN (SELECT COUNT(*) FROM branches WHERE tenant_id = NEW.tenant_id) >=
     (SELECT COALESCE(allowed_branches, 1) FROM tenants WHERE id = NEW.tenant_id)
BEGIN
  SELECT RAISE(ABORT, 'BRANCH_LIMIT_EXCEEDED');
END;

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

-- Migration 0002: App Releases & Multi-Platform Update Management
CREATE TABLE IF NOT EXISTS app_releases (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,          -- 'web', 'windows', 'android', 'ios'
    version TEXT NOT NULL,           -- '2.4.0'
    minimum_version TEXT NOT NULL,   -- '2.2.0'
    status TEXT NOT NULL DEFAULT 'published', -- 'published', 'draft', 'deprecated'
    update_type TEXT NOT NULL DEFAULT 'recommended', -- 'optional', 'recommended', 'required'
    release_notes TEXT NOT NULL,     -- JSON array of strings
    download_url TEXT,
    file_size_bytes INTEGER DEFAULT 0,
    sha256 TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    published_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_releases_platform ON app_releases(platform, published_at DESC);

-- Releases are intentionally not seeded. A production release must be created
-- only after its artifact and signed manifest have been verified.

-- Security/runtime baseline. Apply once after 0001 and 0002 on every environment.
ALTER TABLE tenants ADD COLUMN store_code TEXT;
ALTER TABLE tenants ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_store_code ON tenants(store_code);
ALTER TABLE users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN branch_ids_json TEXT;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  principal_type TEXT NOT NULL CHECK(principal_type IN ('tenant', 'user')),
  credential_version INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_principal ON sessions(principal_id, revoked_at);

CREATE TABLE IF NOT EXISTS trial_requests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  tenant_username TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  timestamp INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trial_requests_timestamp ON trial_requests(timestamp DESC);

-- Release integrity data. sha256 is mandatory for Windows packages published after this migration.
CREATE UNIQUE INDEX IF NOT EXISTS idx_release_platform_version ON app_releases(platform, version);

CREATE TABLE IF NOT EXISTS request_limits (key TEXT PRIMARY KEY, bucket INTEGER NOT NULL, count INTEGER NOT NULL);
CREATE TRIGGER IF NOT EXISTS revoke_user_sessions AFTER UPDATE OF password_hash, role, status, tenant_id, branch_id, permissions_json ON users
BEGIN
  UPDATE sessions SET revoked_at = datetime('now') WHERE principal_id = NEW.id AND principal_type = 'user';
END;
CREATE TRIGGER IF NOT EXISTS revoke_user_branch_grants_sessions AFTER UPDATE OF branch_ids_json ON users
WHEN OLD.branch_ids_json IS NOT NEW.branch_ids_json
BEGIN
  UPDATE sessions SET revoked_at = datetime('now') WHERE principal_id = NEW.id AND revoked_at IS NULL;
END;
CREATE TRIGGER IF NOT EXISTS revoke_tenant_sessions AFTER UPDATE OF password_hash, role, status, expires_at ON tenants
BEGIN
  UPDATE sessions SET revoked_at = datetime('now') WHERE tenant_id = NEW.id;
END;

-- Integer server sequence avoids timestamp collisions and clock-based cursor loss.
CREATE TABLE sync_events_v2 (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 id TEXT NOT NULL,
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 branch_id TEXT,
 entity_type TEXT NOT NULL,
 entity_id TEXT NOT NULL,
 action TEXT NOT NULL,
 payload_json TEXT NOT NULL,
 client_timestamp INTEGER NOT NULL,
 server_timestamp INTEGER NOT NULL,
 UNIQUE(tenant_id, id)
);
INSERT INTO sync_events_v2 (id,tenant_id,branch_id,entity_type,entity_id,action,payload_json,client_timestamp,server_timestamp)
 SELECT id,tenant_id,branch_id,entity_type,entity_id,action,payload_json,client_timestamp,server_timestamp FROM sync_events ORDER BY server_timestamp,id;
CREATE INDEX idx_sync_v2_tenant_sequence ON sync_events_v2(tenant_id, sequence);
ALTER TABLE sync_events_v2 ADD COLUMN group_id TEXT;
CREATE INDEX idx_sync_v2_tenant_group ON sync_events_v2(tenant_id, group_id);
CREATE TABLE sync_commit_groups (
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 group_id TEXT NOT NULL,
 event_count INTEGER NOT NULL CHECK(event_count BETWEEN 1 AND 100),
 PRIMARY KEY (tenant_id, group_id)
);
INSERT INTO sync_commit_groups (tenant_id, group_id, event_count)
 SELECT tenant_id, group_id, COUNT(*) FROM sync_events_v2 WHERE group_id IS NOT NULL GROUP BY tenant_id, group_id;

CREATE TABLE password_reset_tokens (
 token_hash TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 principal_id TEXT NOT NULL, principal_type TEXT NOT NULL CHECK(principal_type IN ('user','tenant')),
 expires_at TEXT NOT NULL, used_at TEXT, created_by TEXT NOT NULL
);

ALTER TABLE app_releases ADD COLUMN signed_manifest TEXT;

-- Enforce retry equality inside the same write transaction, including two
-- conflicting events in one batch and concurrent requests.
CREATE TRIGGER sync_v2_reject_changed_retry
BEFORE INSERT ON sync_events_v2
WHEN EXISTS (
 SELECT 1 FROM sync_events_v2 old
 WHERE old.tenant_id = NEW.tenant_id AND old.id = NEW.id
 AND (old.branch_id IS NOT NEW.branch_id
   OR old.entity_type IS NOT NEW.entity_type
   OR old.entity_id IS NOT NEW.entity_id
   OR old.action IS NOT NEW.action
   OR old.payload_json IS NOT NEW.payload_json)
)
BEGIN
 SELECT RAISE(ABORT, 'SYNC_IDEMPOTENCY_CONFLICT');
END;
ALTER TABLE sync_events_v2 ADD COLUMN conflict_policy_version INTEGER;
ALTER TABLE sync_events_v2 ADD COLUMN preconditions_json TEXT;
CREATE TABLE sync_conflict_heads (
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 conflict_key TEXT NOT NULL,
 last_event_id TEXT NOT NULL,
 PRIMARY KEY (tenant_id, conflict_key)
);
CREATE TRIGGER sync_v2_check_conflict_heads
BEFORE INSERT ON sync_events_v2
WHEN NEW.conflict_policy_version = 1
AND NOT EXISTS (SELECT 1 FROM sync_events_v2 old WHERE old.tenant_id=NEW.tenant_id AND old.id=NEW.id)
AND EXISTS (
 SELECT 1 FROM json_each(NEW.preconditions_json) expected
 LEFT JOIN sync_conflict_heads head
   ON head.tenant_id = NEW.tenant_id AND head.conflict_key = expected.key
 WHERE head.last_event_id IS NOT expected.value
)
BEGIN
 SELECT RAISE(ABORT, 'SYNC_CAUSAL_CONFLICT');
END;
CREATE TRIGGER sync_v2_advance_conflict_heads
AFTER INSERT ON sync_events_v2
WHEN NEW.conflict_policy_version = 1
BEGIN
 INSERT INTO sync_conflict_heads (tenant_id, conflict_key, last_event_id)
 SELECT NEW.tenant_id, expected.key, NEW.id FROM json_each(NEW.preconditions_json) expected WHERE 1
 ON CONFLICT(tenant_id, conflict_key) DO UPDATE SET last_event_id = excluded.last_event_id;
END;

CREATE TABLE platform_security_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_principal_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_platform_security_events_tenant_created
  ON platform_security_events(tenant_id, created_at DESC);

CREATE TRIGGER platform_owner_email_unique_on_tenant_insert
BEFORE INSERT ON tenants
WHEN EXISTS (SELECT 1 FROM tenants owner WHERE owner.role='super_admin' AND LOWER(owner.username)=LOWER(NEW.username))
  OR (NEW.role='super_admin' AND EXISTS (SELECT 1 FROM users WHERE LOWER(username)=LOWER(NEW.username)))
BEGIN SELECT RAISE(ABORT, 'PLATFORM_OWNER_EMAIL_CONFLICT'); END;
CREATE TRIGGER platform_owner_email_unique_on_tenant_update
BEFORE UPDATE OF username,role ON tenants
WHEN EXISTS (SELECT 1 FROM tenants owner WHERE owner.role='super_admin' AND owner.id<>NEW.id AND LOWER(owner.username)=LOWER(NEW.username))
  OR (NEW.role='super_admin' AND EXISTS (SELECT 1 FROM users WHERE LOWER(username)=LOWER(NEW.username)))
BEGIN SELECT RAISE(ABORT, 'PLATFORM_OWNER_EMAIL_CONFLICT'); END;
CREATE TRIGGER platform_owner_email_unique_on_user_insert
BEFORE INSERT ON users
WHEN EXISTS (SELECT 1 FROM tenants owner WHERE owner.role='super_admin' AND LOWER(owner.username)=LOWER(NEW.username))
BEGIN SELECT RAISE(ABORT, 'PLATFORM_OWNER_EMAIL_CONFLICT'); END;
CREATE TRIGGER platform_owner_email_unique_on_user_update
BEFORE UPDATE OF username ON users
WHEN EXISTS (SELECT 1 FROM tenants owner WHERE owner.role='super_admin' AND LOWER(owner.username)=LOWER(NEW.username))
BEGIN SELECT RAISE(ABORT, 'PLATFORM_OWNER_EMAIL_CONFLICT'); END;

CREATE TABLE cash_drawers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_cash_drawers_tenant_branch ON cash_drawers(tenant_id,branch_id);

CREATE TABLE cash_shifts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  drawer_id TEXT NOT NULL REFERENCES cash_drawers(id),
  opened_by TEXT NOT NULL,
  offline_device_id TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  accounting_date TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  opening_cash_cents INTEGER NOT NULL CHECK(opening_cash_cents >= 0),
  status TEXT NOT NULL CHECK(status IN ('open','closed')),
  closed_at TEXT,
  closed_by TEXT,
  counted_cash_cents INTEGER,
  expected_cash_cents INTEGER,
  variance_cents INTEGER,
  CHECK((status='open' AND closed_at IS NULL AND counted_cash_cents IS NULL) OR
        (status='closed' AND closed_at IS NOT NULL AND counted_cash_cents IS NOT NULL))
);
CREATE UNIQUE INDEX idx_cash_shifts_one_open_drawer ON cash_shifts(tenant_id,branch_id,drawer_id) WHERE status='open';
CREATE INDEX idx_cash_shifts_tenant_branch_date ON cash_shifts(tenant_id,branch_id,accounting_date);

CREATE TABLE cash_shift_movements (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_event_id TEXT NOT NULL,
  shift_id TEXT NOT NULL REFERENCES cash_shifts(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  drawer_id TEXT NOT NULL REFERENCES cash_drawers(id),
  accounting_date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id,source_event_id),
  FOREIGN KEY (tenant_id,source_event_id) REFERENCES sync_events_v2(tenant_id,id)
);
CREATE INDEX idx_cash_shift_movements_shift ON cash_shift_movements(tenant_id,shift_id);
CREATE TRIGGER cash_shift_movements_require_open
BEFORE INSERT ON cash_shift_movements
WHEN NOT EXISTS (
  SELECT 1 FROM cash_shifts shift
  JOIN sync_events_v2 event ON event.tenant_id=NEW.tenant_id AND event.id=NEW.source_event_id
  WHERE shift.id=NEW.shift_id AND shift.tenant_id=NEW.tenant_id AND shift.branch_id=NEW.branch_id
    AND shift.drawer_id=NEW.drawer_id AND shift.accounting_date=NEW.accounting_date
    AND shift.status='open' AND event.branch_id=NEW.branch_id
    AND json_extract(event.payload_json,'$.cashShiftId')=NEW.shift_id
)
BEGIN SELECT RAISE(ABORT,'CASH_SHIFT_INVALID_SOURCE'); END;
ALTER TABLE cash_shift_movements ADD COLUMN reverses_source_event_id TEXT;
CREATE UNIQUE INDEX idx_cash_shift_single_reversal
  ON cash_shift_movements(tenant_id,reverses_source_event_id)
  WHERE reverses_source_event_id IS NOT NULL;
ALTER TABLE cash_shifts ADD COLUMN device_proof_hash TEXT;

CREATE TABLE cash_devices (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_proof_hash TEXT NOT NULL,
  registered_by TEXT NOT NULL,
  registered_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  PRIMARY KEY (tenant_id, id)
);

ALTER TABLE tenants ADD COLUMN time_zone TEXT NOT NULL DEFAULT 'Asia/Riyadh';

CREATE TABLE sync_conflict_reviews (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  submitted_by TEXT NOT NULL,
  submission_key TEXT NOT NULL,
  proposed_json TEXT NOT NULL,
  server_json TEXT NOT NULL,
  heads_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, submitted_by, submission_key)
);
CREATE INDEX sync_conflict_reviews_owner ON sync_conflict_reviews(tenant_id,status,created_at,id);
CREATE TABLE sync_review_decisions (
  review_id TEXT PRIMARY KEY REFERENCES sync_conflict_reviews(id) ON DELETE RESTRICT,
  decided_by TEXT NOT NULL,
  choice TEXT NOT NULL CHECK(choice IN ('local','server')),
  created_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE TABLE sync_review_resolutions (
  review_id TEXT PRIMARY KEY REFERENCES sync_conflict_reviews(id) ON DELETE RESTRICT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  decided_by TEXT NOT NULL,
  choice TEXT NOT NULL CHECK(choice IN ('local','server')),
  expected_heads_json TEXT NOT NULL,
  receipt_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE INDEX sync_review_resolutions_tenant ON sync_review_resolutions(tenant_id,review_id);
CREATE TRIGGER sync_review_resolution_guard BEFORE INSERT ON sync_review_resolutions
BEGIN
  SELECT RAISE(ABORT,'SYNC_REVIEW_STALE') WHERE NOT EXISTS(SELECT 1 FROM sync_conflict_reviews r
    WHERE r.id=NEW.review_id AND r.tenant_id=NEW.tenant_id AND r.status='pending')
    ;
  SELECT RAISE(ABORT,'SYNC_REVIEW_STALE') WHERE EXISTS(SELECT 1 FROM sync_review_decisions d WHERE d.review_id=NEW.review_id AND d.choice<>NEW.choice);
  SELECT RAISE(ABORT,'SYNC_REVIEW_STALE') WHERE EXISTS(SELECT 1 FROM json_each(NEW.expected_heads_json) h
    WHERE h.value IS NOT (SELECT last_event_id FROM sync_conflict_heads WHERE tenant_id=NEW.tenant_id AND conflict_key=h.key))
    OR EXISTS(SELECT 1 FROM sync_conflict_heads s WHERE s.tenant_id=NEW.tenant_id
      AND s.last_event_id IS NOT json_extract(NEW.expected_heads_json,'$."'||s.conflict_key||'"'))
    ;
END;
CREATE TABLE sync_review_originals (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  event_id TEXT NOT NULL,
  review_id TEXT NOT NULL REFERENCES sync_review_resolutions(review_id) ON DELETE RESTRICT,
  PRIMARY KEY(tenant_id,event_id)
);
CREATE TRIGGER sync_review_index_originals AFTER INSERT ON sync_review_resolutions
BEGIN
  INSERT INTO sync_review_originals(tenant_id,event_id,review_id)
  SELECT NEW.tenant_id,json_extract(source.value,'$.id'),NEW.review_id
  FROM json_each(NEW.receipt_json,'$.events') source;
END;

CREATE TABLE cash_drawer_writers (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  drawer_id TEXT NOT NULL REFERENCES cash_drawers(id) ON DELETE RESTRICT,
  device_id TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(tenant_id,drawer_id),
  FOREIGN KEY(tenant_id,device_id) REFERENCES cash_devices(tenant_id,id) ON DELETE RESTRICT
);
CREATE INDEX idx_cash_drawer_writers_device ON cash_drawer_writers(tenant_id,device_id);
CREATE TRIGGER cash_drawer_writer_scope BEFORE INSERT ON cash_drawer_writers
BEGIN
  SELECT RAISE(ABORT,'CASH_WRITER_SCOPE') WHERE NOT EXISTS(
    SELECT 1 FROM cash_drawers WHERE id=NEW.drawer_id AND tenant_id=NEW.tenant_id AND status='active'
  ) OR NOT EXISTS(
    SELECT 1 FROM cash_devices WHERE id=NEW.device_id AND tenant_id=NEW.tenant_id AND revoked_at IS NULL
  );
END;
CREATE TRIGGER cash_drawer_writer_immutable BEFORE UPDATE ON cash_drawer_writers
BEGIN
  SELECT RAISE(ABORT,'CASH_WRITER_REASSIGN_REQUIRES_RECOVERY');
END;
-- Staged immutable source authorship, committed with the financial source.
CREATE TABLE cash_source_proofs (
  tenant_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  cashier_id TEXT NOT NULL,
  principal_type TEXT NOT NULL CHECK(principal_type IN ('tenant','user')),
  credential_version INTEGER NOT NULL,
  drawer_id TEXT NOT NULL,
  proof_json TEXT NOT NULL CHECK(json_valid(proof_json)),
  accepted_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(tenant_id,event_id),
  FOREIGN KEY(tenant_id,event_id) REFERENCES sync_events_v2(tenant_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(tenant_id,device_id) REFERENCES cash_devices(tenant_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(tenant_id,drawer_id) REFERENCES cash_drawer_writers(tenant_id,drawer_id) ON DELETE RESTRICT
);
CREATE TRIGGER cash_source_proof_scope BEFORE INSERT ON cash_source_proofs
BEGIN
  SELECT RAISE(ABORT,'CASH_SOURCE_AUTH_CHANGED') WHERE NOT EXISTS(
    SELECT 1 FROM cash_devices d JOIN cash_drawer_writers w
    ON w.tenant_id=d.tenant_id AND w.device_id=d.id
    JOIN cash_drawers drawer ON drawer.tenant_id=w.tenant_id AND drawer.id=w.drawer_id
    JOIN sync_events_v2 source ON source.tenant_id=NEW.tenant_id AND source.id=NEW.event_id
    WHERE d.tenant_id=NEW.tenant_id AND d.id=NEW.device_id
      AND d.revoked_at IS NULL AND w.drawer_id=NEW.drawer_id
      AND drawer.status='active' AND drawer.branch_id=source.branch_id
  ) OR (NEW.principal_type='user' AND NOT EXISTS(
    SELECT 1 FROM users WHERE id=NEW.cashier_id AND tenant_id=NEW.tenant_id
      AND status='active' AND auth_version=NEW.credential_version
  )) OR (NEW.principal_type='tenant' AND NOT EXISTS(
    SELECT 1 FROM tenants WHERE id=NEW.cashier_id AND id=NEW.tenant_id
      AND status='active' AND auth_version=NEW.credential_version
  ));
END;
CREATE TRIGGER cash_source_proof_no_update BEFORE UPDATE ON cash_source_proofs
BEGIN SELECT RAISE(ABORT,'CASH_SOURCE_PROOF_IMMUTABLE'); END;
CREATE TRIGGER cash_source_proof_no_delete BEFORE DELETE ON cash_source_proofs
BEGIN SELECT RAISE(ABORT,'CASH_SOURCE_PROOF_IMMUTABLE'); END;
-- Rebuildable server-owned validation cache. Financial sources/receipts remain
-- immutable in their existing tables. This migration has no cash dependency.
CREATE TABLE sync_review_checkpoint_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  actor_id TEXT NOT NULL,
  target_cursor INTEGER NOT NULL CHECK(target_cursor>=0),
  processed_cursor INTEGER NOT NULL CHECK(processed_cursor>=0 AND processed_cursor<=target_cursor),
  processed_count INTEGER NOT NULL CHECK(processed_count>=0 AND processed_count<=total_count),
  total_count INTEGER NOT NULL,
  header_json TEXT NOT NULL CHECK(json_valid(header_json)),
  ledger_json TEXT NOT NULL CHECK(json_valid(ledger_json)),
  status TEXT NOT NULL DEFAULT 'validating' CHECK(status IN ('validating','ready')),
  created_at TEXT NOT NULL DEFAULT(datetime('now')),
  CHECK(status<>'ready' OR (processed_cursor=target_cursor AND processed_count=total_count))
);
CREATE INDEX sync_review_checkpoint_actor ON sync_review_checkpoint_jobs(tenant_id,actor_id,created_at);
CREATE INDEX idx_sync_v2_entity_sequence ON sync_events_v2(tenant_id,entity_type,entity_id,sequence);
CREATE TRIGGER sync_review_checkpoint_monotonic BEFORE UPDATE ON sync_review_checkpoint_jobs
BEGIN
  SELECT RAISE(ABORT,'SYNC_REVIEW_STALE') WHERE NEW.id<>OLD.id OR NEW.tenant_id<>OLD.tenant_id
    OR NEW.actor_id<>OLD.actor_id OR NEW.target_cursor<>OLD.target_cursor OR NEW.header_json<>OLD.header_json
    OR NEW.total_count<>OLD.total_count OR NEW.processed_cursor<=OLD.processed_cursor
    OR NEW.processed_count<=OLD.processed_count OR OLD.status='ready';
END;
CREATE TRIGGER sync_review_checkpoint_claim BEFORE INSERT ON sync_review_resolutions
WHEN json_extract(NEW.receipt_json,'$.checkpointJobId') IS NOT NULL
BEGIN
  SELECT RAISE(ABORT,'SYNC_REVIEW_STALE') WHERE NOT EXISTS(
    SELECT 1 FROM sync_review_checkpoint_jobs j WHERE j.id=json_extract(NEW.receipt_json,'$.checkpointJobId')
      AND j.tenant_id=NEW.tenant_id AND j.actor_id=NEW.decided_by AND j.status='ready'
      AND j.target_cursor=(SELECT COALESCE(MAX(sequence),0) FROM sync_events_v2 WHERE tenant_id=NEW.tenant_id)
  );
END;
