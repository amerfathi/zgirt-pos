-- Rebuildable server-owned validation cache. Financial sources/receipts remain
-- immutable in their existing tables. This migration has no cash dependency.
CREATE TABLE sync_review_checkpoint_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  actor_id TEXT NOT NULL,
  target_cursor INTEGER NOT NULL CHECK(target_cursor>=0),
  processed_cursor INTEGER NOT NULL CHECK(processed_cursor>=0 AND processed_cursor<=target_cursor),
  processed_count INTEGER NOT NULL CHECK(processed_count>=0 AND processed_count<=total_count),
  total_count INTEGER NOT NULL,
  header_json TEXT NOT NULL CHECK(json_valid(header_json)),
  ledger_json TEXT NOT NULL CHECK(json_valid(ledger_json)),
  status TEXT NOT NULL DEFAULT 'validating' CHECK(status IN ('validating','ready')),
  created_at TEXT NOT NULL DEFAULT(datetime('now')),
  CHECK(status<>'ready' OR (processed_cursor=target_cursor AND processed_count=total_count))
);
CREATE INDEX sync_review_checkpoint_actor ON sync_review_checkpoint_jobs(tenant_id,actor_id,created_at);
CREATE INDEX idx_sync_v2_entity_sequence ON sync_events_v2(tenant_id,entity_type,entity_id,sequence);
CREATE TRIGGER sync_review_checkpoint_monotonic BEFORE UPDATE ON sync_review_checkpoint_jobs
BEGIN
  SELECT RAISE(ABORT,'SYNC_REVIEW_STALE') WHERE NEW.id<>OLD.id OR NEW.tenant_id<>OLD.tenant_id
    OR NEW.actor_id<>OLD.actor_id OR NEW.target_cursor<>OLD.target_cursor OR NEW.header_json<>OLD.header_json
    OR NEW.total_count<>OLD.total_count OR NEW.processed_cursor<=OLD.processed_cursor
    OR NEW.processed_count<=OLD.processed_count OR OLD.status='ready';
END;
CREATE TRIGGER sync_review_checkpoint_claim BEFORE INSERT ON sync_review_resolutions
WHEN json_extract(NEW.receipt_json,'$.checkpointJobId') IS NOT NULL
BEGIN
  SELECT RAISE(ABORT,'SYNC_REVIEW_STALE') WHERE NOT EXISTS(
    SELECT 1 FROM sync_review_checkpoint_jobs j WHERE j.id=json_extract(NEW.receipt_json,'$.checkpointJobId')
      AND j.tenant_id=NEW.tenant_id AND j.actor_id=NEW.decided_by AND j.status='ready'
      AND j.target_cursor=(SELECT COALESCE(MAX(sequence),0) FROM sync_events_v2 WHERE tenant_id=NEW.tenant_id)
  );
END;
