-- Indexed immutable original IDs: normal cashier pushes must not scan every
-- archived review JSON. Populated atomically with the resolution receipt.
CREATE TABLE sync_review_originals (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  event_id TEXT NOT NULL,
  review_id TEXT NOT NULL REFERENCES sync_review_resolutions(review_id) ON DELETE RESTRICT,
  PRIMARY KEY(tenant_id,event_id)
);
INSERT INTO sync_review_originals(tenant_id,event_id,review_id)
SELECT r.tenant_id,json_extract(source.value,'$.id'),r.review_id
FROM sync_review_resolutions r,json_each(r.receipt_json,'$.events') source;
CREATE TRIGGER sync_review_index_originals AFTER INSERT ON sync_review_resolutions
BEGIN
  INSERT INTO sync_review_originals(tenant_id,event_id,review_id)
  SELECT NEW.tenant_id,json_extract(source.value,'$.id'),NEW.review_id
  FROM json_each(NEW.receipt_json,'$.events') source;
END;
