/* Regression guard for release-blocking source patterns. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const checked = [
  'functions/api/users/index.js', 'functions/api/tenants/index.js',
  'functions/api/sync/push.js', 'functions/api/sync/pull.js',
  'functions/api/backup.js', 'functions/api/trial-requests/index.js'
];
for (const file of checked) {
  const source = read(file);
  assert(!source.includes('if (!token) return true'), `${file} must not accept anonymous authentication`);
}
assert(read('functions/api/sync/push.js').includes('authenticateRequest'), 'sync push must authenticate');
assert(read('functions/api/sync/pull.js').includes('requireTenant'), 'sync pull must enforce tenant scope');
assert(read('functions/api/backup.js').includes('requireAdmin'), 'backup must require administrator');
const electronMain = read('electron/main.cjs');
assert(electronMain.includes('webSecurity: true'), 'Electron web security must remain enabled');
for (const channel of ['window-minimize', 'window-maximize', 'window-close', 'window-is-maximized',
  'download-update', 'cancel-download-update', 'install-update']) {
  const handler = electronMain.slice(electronMain.indexOf(`'${channel}'`), electronMain.indexOf(`'${channel}'`) + 240);
  assert(handler.includes('trustedSender(event)'), `Electron ${channel} IPC must verify its sender`);
}
assert(!fs.existsSync(path.join(root, 'android/app/khodar.keystore')), 'compromised Android keystore must not be tracked');
assert(read('d1/migrations/0003_security_and_runtime_schema.sql').includes('CREATE TABLE IF NOT EXISTS sessions'), 'session migration is required');
console.log('Security regression guards passed.');
