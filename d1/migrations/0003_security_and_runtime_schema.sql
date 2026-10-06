-- Security/runtime baseline. Apply once after 0001 and 0002 on every environment.
ALTER TABLE tenants ADD COLUMN store_code TEXT;
ALTER TABLE tenants ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_store_code ON tenants(store_code);
ALTER TABLE users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;

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
