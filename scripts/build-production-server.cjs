// Reproducible compatibility bundle. No staging directory, credentials or migrations.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
function validateCompatibilityInputs(root, read = file => fs.readFileSync(file, 'utf8')) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'deployment/production/compatibility-inputs.json'), 'utf8'));
  for (const [file, expected] of Object.entries(manifest.sourceHashes)) {
    const hash = crypto.createHash('sha256').update(read(path.join(root, file)).replace(/\r\n/g, '\n')).digest('hex');
    if (hash !== expected) throw new Error(`Production compatibility source changed: ${file}; review its override before deployment`);
  }
}
function buildProductionServer() {
const root = path.resolve(__dirname, '..');
validateCompatibilityInputs(root);
fs.mkdirSync(path.join(root, 'scratch'), { recursive: true });
const destination = fs.mkdtempSync(path.join(root, 'scratch', 'production-bundle-'));
const excluded = new Set(['_lib/cashDeviceProof.js', '_lib/offlineGrantSignature.js']);
function copyTree(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name), to = path.join(target, entry.name);
    if (entry.isDirectory()) copyTree(from, to); else fs.copyFileSync(from, to);
  }
}
// Only copy tracked API and source inputs: no scratch artifacts or local exports.
const inputs = execFileSync('git', ['ls-files', 'functions', 'src', 'wrangler.toml'], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/);
for (const file of inputs) {
  const relative = file.replace(/^functions\//, '');
  if (file.startsWith('functions/api/cash/') || excluded.has(relative)) continue;
  const target = path.join(destination, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, file), target);
}
copyTree(path.join(root, 'deployment/production/overrides/functions'), path.join(destination, 'functions'));
if (!fs.existsSync(path.join(root, 'dist/index.html'))) throw new Error('Run npm run build before packaging production');
copyTree(path.join(root, 'dist'), path.join(destination, 'dist'));
const hashes = {};
function hashTree(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) hashTree(file);
    else hashes[path.relative(destination, file).replaceAll('\\', '/')] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  }
}
hashTree(destination);
fs.writeFileSync(path.join(destination, 'bundle-manifest.json'), JSON.stringify({
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  compatibility: 'production-with-cash-disabled', files: hashes,
  warning: 'No migrations applied. Cash shifts remain disabled. Manifest does not certify uncommitted inputs.'
}, null, 2));
console.log(JSON.stringify({ destination, files: Object.keys(hashes).length, migrationsApplied: false }));
return destination;
}
module.exports = { buildProductionServer, validateCompatibilityInputs };
if (require.main === module) buildProductionServer();
