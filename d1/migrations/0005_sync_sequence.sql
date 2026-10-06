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
