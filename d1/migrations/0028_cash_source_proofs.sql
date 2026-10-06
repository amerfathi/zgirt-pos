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
    WHERE d.tenant_id=NEW.tenant_id AND d.id=NEW.device_id
      AND d.revoked_at IS NULL AND w.drawer_id=NEW.drawer_id
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
