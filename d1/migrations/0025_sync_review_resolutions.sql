-- Immutable resolution receipts. The guard is evaluated in the SAME batch as
-- the replacement events, so another cashier cannot race owner approval.
CREATE TABLE sync_review_resolutions (
  review_id TEXT PRIMARY KEY REFERENCES sync_conflict_reviews(id) ON DELETE RESTRICT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  decided_by TEXT NOT NULL,
  choice TEXT NOT NULL CHECK(choice IN ('local','server')),
  expected_heads_json TEXT NOT NULL,
  receipt_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE INDEX sync_review_resolutions_tenant ON sync_review_resolutions(tenant_id,review_id);
CREATE TRIGGER sync_review_resolution_guard BEFORE INSERT ON sync_review_resolutions
BEGIN
  SELECT RAISE(ABORT,'SYNC_REVIEW_STALE') WHERE NOT EXISTS(SELECT 1 FROM sync_conflict_reviews r
    WHERE r.id=NEW.review_id AND r.tenant_id=NEW.tenant_id AND r.status='pending')
    ;
  SELECT RAISE(ABORT,'SYNC_REVIEW_STALE') WHERE EXISTS(SELECT 1 FROM sync_review_decisions d WHERE d.review_id=NEW.review_id AND d.choice<>NEW.choice);
  SELECT RAISE(ABORT,'SYNC_REVIEW_STALE') WHERE EXISTS(SELECT 1 FROM json_each(NEW.expected_heads_json) h
    WHERE h.value IS NOT (SELECT last_event_id FROM sync_conflict_heads WHERE tenant_id=NEW.tenant_id AND conflict_key=h.key))
    OR EXISTS(SELECT 1 FROM sync_conflict_heads s WHERE s.tenant_id=NEW.tenant_id
      AND s.last_event_id IS NOT json_extract(NEW.expected_heads_json,'$."'||s.conflict_key||'"'))
    ;
END;
