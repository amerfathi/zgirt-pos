const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const bcrypt = require('bcryptjs');

test('pre-commercial cleanup emits a locked bcrypt12 owner and no demo credentials', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'braka-clean-state-'));
  const output = path.join(directory, 'reset.sql');
  try {
    execFileSync(process.execPath, [
      path.resolve(__dirname, '..', 'scripts', 'prepare-precommercial-cleanup.cjs'),
      'owner@example.test',
      output,
    ], { stdio: 'pipe' });

    const sql = fs.readFileSync(output, 'utf8');
    const ownerInsert = sql.match(/VALUES \('tenant-super-admin',[\s\S]*?'(\$2[aby]\$12\$[^']+)'/);
    assert.ok(ownerInsert, 'owner must use a bcrypt cost-12 hash');
    assert.equal(bcrypt.compareSync('admin', ownerInsert[1]), false);
    assert.equal(bcrypt.compareSync('123', ownerInsert[1]), false);
    assert.match(sql, /'owner@example\.test'/);
    assert.doesNotMatch(sql, /'tenant-demo'/);
    assert.doesNotMatch(sql, /'rel-win-2-4-0'/);
    assert.match(sql, /DELETE FROM d1_migrations;/);
    assert.match(sql, /VALUES \('branch-platform-admin', 'tenant-super-admin', 'إدارة المنصة', 'PLATFORM'/);
    assert.match(sql, /0015_platform_owner_main_branch\.sql/);
    assert.match(sql, /0016_staff_branch_grants\.sql/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
