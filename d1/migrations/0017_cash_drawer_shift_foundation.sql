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
