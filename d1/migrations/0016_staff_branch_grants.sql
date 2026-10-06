ALTER TABLE users ADD COLUMN branch_ids_json TEXT;
UPDATE users SET auth_version = auth_version + 1;

-- A scope change invalidates existing sessions as well as the local sync scope.
CREATE TRIGGER IF NOT EXISTS revoke_user_branch_grants_sessions
AFTER UPDATE OF branch_ids_json ON users
WHEN OLD.branch_ids_json IS NOT NEW.branch_ids_json
BEGIN
  UPDATE sessions SET revoked_at = datetime('now') WHERE principal_id = NEW.id AND revoked_at IS NULL;
END;
