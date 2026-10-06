-- Additive inbox only. Does not modify accepted financial events or balances.
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
