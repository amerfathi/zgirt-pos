CREATE TABLE cash_devices (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_proof_hash TEXT NOT NULL,
  registered_by TEXT NOT NULL,
  registered_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  PRIMARY KEY (tenant_id, id)
);
