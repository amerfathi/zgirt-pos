-- A unique registry makes first creation of a commit group mutually exclusive.
-- It is written in the same D1 batch as all member events.
CREATE TABLE sync_commit_groups (
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 group_id TEXT NOT NULL,
 event_count INTEGER NOT NULL CHECK(event_count BETWEEN 1 AND 100),
 PRIMARY KEY (tenant_id, group_id)
);
INSERT INTO sync_commit_groups (tenant_id, group_id, event_count)
 SELECT tenant_id, group_id, COUNT(*) FROM sync_events_v2 WHERE group_id IS NOT NULL GROUP BY tenant_id, group_id;
