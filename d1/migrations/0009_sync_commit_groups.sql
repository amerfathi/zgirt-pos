-- Preserve the local aggregate transaction boundary across pull pagination.
ALTER TABLE sync_events_v2 ADD COLUMN group_id TEXT;
CREATE INDEX idx_sync_v2_tenant_group ON sync_events_v2(tenant_id, group_id);
