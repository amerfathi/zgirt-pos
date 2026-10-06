-- Records intent only; neither acceptance nor outbox acknowledgement.
CREATE TABLE sync_review_decisions (
  review_id TEXT PRIMARY KEY REFERENCES sync_conflict_reviews(id) ON DELETE RESTRICT,
  decided_by TEXT NOT NULL,
  choice TEXT NOT NULL CHECK(choice IN ('local','server')),
  created_at TEXT NOT NULL DEFAULT(datetime('now'))
);
