const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');

const [, , ownerEmail, outputFile] = process.argv;
if (!ownerEmail || !outputFile) {
  console.error('Usage: node scripts/prepare-precommercial-cleanup.cjs <owner-email> <private-output.sql>');
  process.exit(1);
}

const normalizedEmail = ownerEmail.trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
  console.error('Owner email is invalid.');
  process.exit(1);
}

const repositoryRoot = path.resolve(__dirname, '..');
const resolvedOutput = path.resolve(outputFile);
if (resolvedOutput.startsWith(`${repositoryRoot}${path.sep}`)) {
  console.error('Refusing to write credential-bearing cleanup SQL inside the repository.');
  process.exit(1);
}

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const schema = fs.readFileSync(path.join(repositoryRoot, 'd1', 'schema.sql'), 'utf8');
const bootstrapSecret = crypto.randomBytes(48).toString('base64url');
const passwordHash = bcrypt.hashSync(bootstrapSecret, 12);

const dropOrder = [
  'platform_security_events', 'password_reset_tokens', 'sessions', 'request_limits', 'sync_conflict_heads',
  'sync_commit_groups', 'sync_events_v2', 'sync_events', 'tenant_backups', 'users',
  'partner_drawings', 'partners', 'worker_transactions', 'workers', 'expenses',
  'purchases', 'invoice_items', 'invoices', 'supplier_payments', 'suppliers',
  'customer_payments', 'customers', 'branch_inventory', 'products', 'branches',
  'app_releases', 'trial_requests', 'tenants',
];
const migrations = Array.from({ length: 16 }, (_, index) =>
  `${String(index + 1).padStart(4, '0')}_${[
    'initial_schema', 'create_app_releases', 'security_and_runtime_schema',
    'session_revocation', 'sync_sequence', 'recovery_tokens', 'signed_releases',
    'sync_immutable_retry', 'sync_commit_groups', 'sync_group_registry',
    'branch_limit', 'sync_conflict_heads', 'platform_security_audit', 'platform_owner_email_guards',
    'platform_owner_main_branch', 'staff_branch_grants',
  ][index]}.sql`
);

const sql = [
  '-- Generated private pre-commercial reset. Do not commit or share this file.',
  'PRAGMA foreign_keys = ON;',
  ...dropOrder.map((table) => `DROP TABLE IF EXISTS ${table};`),
  schema,
  `INSERT INTO tenants (id, company_name, username, password_hash, role, status, expires_at, allowed_branches, phone, notes, store_code, auth_version) VALUES ('tenant-super-admin', 'BRAKA Platform Owner', ${quote(normalizedEmail)}, ${quote(passwordHash)}, 'super_admin', 'active', '2099-12-31', 99, '', 'Pre-commercial clean-state platform owner', 'BRK-000', 1);`,
  "INSERT INTO branches (id, tenant_id, name, code, phone, address, manager_name, is_main, status) VALUES ('branch-platform-admin', 'tenant-super-admin', 'إدارة المنصة', 'PLATFORM', '', '', '', 1, 'active');",
  "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL);",
  'DELETE FROM d1_migrations;',
  ...migrations.map((name, index) => `INSERT INTO d1_migrations (id, name) VALUES (${index + 1}, ${quote(name)});`),
  '',
].join('\n');

fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
fs.writeFileSync(resolvedOutput, sql, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
console.log(`Prepared private cleanup SQL at ${resolvedOutput}.`);
console.log('The bootstrap credential was intentionally discarded; use the one-use reset flow to set the owner password.');
