-- Additive staged schema. Do not apply to production before cash rollout audit.
-- A physical drawer has one offline writer device, shared by its cashiers.
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
