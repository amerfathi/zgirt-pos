-- Enforce retry equality inside the same write transaction, including two
-- conflicting events in one batch and concurrent requests.
CREATE TRIGGER sync_v2_reject_changed_retry
BEFORE INSERT ON sync_events_v2
WHEN EXISTS (
 SELECT 1 FROM sync_events_v2 old
 WHERE old.tenant_id = NEW.tenant_id AND old.id = NEW.id
 AND (old.branch_id IS NOT NEW.branch_id
   OR old.entity_type IS NOT NEW.entity_type
   OR old.entity_id IS NOT NEW.entity_id
   OR old.action IS NOT NEW.action
   OR old.payload_json IS NOT NEW.payload_json)
)
BEGIN
 SELECT RAISE(ABORT, 'SYNC_IDEMPOTENCY_CONFLICT');
END;
