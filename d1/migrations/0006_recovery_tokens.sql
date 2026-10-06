CREATE TABLE password_reset_tokens (
 token_hash TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 principal_id TEXT NOT NULL, principal_type TEXT NOT NULL CHECK(principal_type IN ('user','tenant')),
 expires_at TEXT NOT NULL, used_at TEXT, created_by TEXT NOT NULL
);
