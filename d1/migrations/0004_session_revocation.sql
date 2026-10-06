CREATE TABLE IF NOT EXISTS request_limits (key TEXT PRIMARY KEY, bucket INTEGER NOT NULL, count INTEGER NOT NULL);
CREATE TRIGGER IF NOT EXISTS revoke_user_sessions AFTER UPDATE OF password_hash, role, status, tenant_id, branch_id, permissions_json ON users
BEGIN
  UPDATE sessions SET revoked_at = datetime('now') WHERE principal_id = NEW.id AND principal_type = 'user';
END;
CREATE TRIGGER IF NOT EXISTS revoke_tenant_sessions AFTER UPDATE OF password_hash, role, status, expires_at ON tenants
BEGIN
  UPDATE sessions SET revoked_at = datetime('now') WHERE tenant_id = NEW.id;
END;
