-- Enforce the subscribed branch count at the database write boundary.
-- Existing over-limit tenants retain their branches for review; only a new
-- branch insert is denied. This serializes concurrent first writers in D1.
CREATE TRIGGER branches_limit_before_insert
BEFORE INSERT ON branches
WHEN (SELECT COUNT(*) FROM branches WHERE tenant_id = NEW.tenant_id) >=
     (SELECT COALESCE(allowed_branches, 1) FROM tenants WHERE id = NEW.tenant_id)
BEGIN
  SELECT RAISE(ABORT, 'BRANCH_LIMIT_EXCEEDED');
END;
