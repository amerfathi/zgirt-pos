-- Optimistic multi-device concurrency: every accepted event atomically claims
-- the domain/record heads it observed. Stale offline writers fail closed.
ALTER TABLE sync_events_v2 ADD COLUMN conflict_policy_version INTEGER;
ALTER TABLE sync_events_v2 ADD COLUMN preconditions_json TEXT;

CREATE TABLE sync_conflict_heads (
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 conflict_key TEXT NOT NULL,
 last_event_id TEXT NOT NULL,
 PRIMARY KEY (tenant_id, conflict_key)
);

CREATE TRIGGER sync_v2_check_conflict_heads
BEFORE INSERT ON sync_events_v2
WHEN NEW.conflict_policy_version = 1
AND NOT EXISTS (SELECT 1 FROM sync_events_v2 old WHERE old.tenant_id=NEW.tenant_id AND old.id=NEW.id)
AND EXISTS (
 SELECT 1 FROM json_each(NEW.preconditions_json) expected
 LEFT JOIN sync_conflict_heads head
   ON head.tenant_id = NEW.tenant_id AND head.conflict_key = expected.key
 WHERE head.last_event_id IS NOT expected.value
)
BEGIN
 SELECT RAISE(ABORT, 'SYNC_CAUSAL_CONFLICT');
END;

CREATE TRIGGER sync_v2_advance_conflict_heads
AFTER INSERT ON sync_events_v2
WHEN NEW.conflict_policy_version = 1
BEGIN
 INSERT INTO sync_conflict_heads (tenant_id, conflict_key, last_event_id)
 SELECT NEW.tenant_id, expected.key, NEW.id FROM json_each(NEW.preconditions_json) expected WHERE 1
 ON CONFLICT(tenant_id, conflict_key) DO UPDATE SET last_event_id = excluded.last_event_id;
END;
