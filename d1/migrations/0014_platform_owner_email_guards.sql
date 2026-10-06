CREATE TRIGGER platform_owner_email_unique_on_tenant_insert
BEFORE INSERT ON tenants
WHEN EXISTS (SELECT 1 FROM tenants owner WHERE owner.role='super_admin' AND LOWER(owner.username)=LOWER(NEW.username))
  OR (NEW.role='super_admin' AND EXISTS (SELECT 1 FROM users WHERE LOWER(username)=LOWER(NEW.username)))
BEGIN
  SELECT RAISE(ABORT, 'PLATFORM_OWNER_EMAIL_CONFLICT');
END;

CREATE TRIGGER platform_owner_email_unique_on_tenant_update
BEFORE UPDATE OF username,role ON tenants
WHEN EXISTS (SELECT 1 FROM tenants owner WHERE owner.role='super_admin' AND owner.id<>NEW.id AND LOWER(owner.username)=LOWER(NEW.username))
  OR (NEW.role='super_admin' AND EXISTS (SELECT 1 FROM users WHERE LOWER(username)=LOWER(NEW.username)))
BEGIN
  SELECT RAISE(ABORT, 'PLATFORM_OWNER_EMAIL_CONFLICT');
END;

CREATE TRIGGER platform_owner_email_unique_on_user_insert
BEFORE INSERT ON users
WHEN EXISTS (SELECT 1 FROM tenants owner WHERE owner.role='super_admin' AND LOWER(owner.username)=LOWER(NEW.username))
BEGIN
  SELECT RAISE(ABORT, 'PLATFORM_OWNER_EMAIL_CONFLICT');
END;

CREATE TRIGGER platform_owner_email_unique_on_user_update
BEFORE UPDATE OF username ON users
WHEN EXISTS (SELECT 1 FROM tenants owner WHERE owner.role='super_admin' AND LOWER(owner.username)=LOWER(NEW.username))
BEGIN
  SELECT RAISE(ABORT, 'PLATFORM_OWNER_EMAIL_CONFLICT');
END;
