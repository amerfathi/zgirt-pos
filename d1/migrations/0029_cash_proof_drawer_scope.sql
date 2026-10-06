-- Staged cash rollout only. Recheck the mutable drawer at commit time, not
-- merely before the network/API batch is assembled. Preserve all originals.
DROP TRIGGER cash_source_proof_scope;
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
