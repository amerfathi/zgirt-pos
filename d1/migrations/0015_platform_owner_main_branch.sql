-- Every authenticated identity opens a branch-bound aggregate. Keep the
-- platform owner isolated from tenant demo data while satisfying that invariant.
INSERT INTO branches
  (id, tenant_id, name, code, phone, address, manager_name, is_main, status)
SELECT
  'branch-platform-admin', id, 'إدارة المنصة', 'PLATFORM', '', '', '', 1, 'active'
FROM tenants
WHERE id = 'tenant-super-admin'
  AND role = 'super_admin'
  AND NOT EXISTS (
    SELECT 1 FROM branches WHERE tenant_id = 'tenant-super-admin'
  );
