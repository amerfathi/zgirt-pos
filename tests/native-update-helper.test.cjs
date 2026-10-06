const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const root = path.resolve(__dirname, '..');

test('Windows update handoff does not execute an encoded shell', () => {
  const source = fs.readFileSync(path.join(root, 'electron/update-installer.cjs'), 'utf8');
  assert.doesNotMatch(source, /powershell|EncodedCommand/i);
  assert.match(source, /Braka\.UpdateHelper\.exe/);
});

test('packaging builds and ships the native update helper', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.match(pkg.scripts['electron:build'], /build-update-helper/);
  assert.ok(pkg.build.extraResources.some(entry => entry.to === 'Braka.UpdateHelper.exe'));
});

test('native helper survives parent exit and launches the exact verified target', { skip: process.platform !== 'win32' }, async () => {
  const source = path.join(root, 'electron/native/UpdateHelper.cs');
  assert.ok(fs.existsSync(source), 'native handoff implementation is missing');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'braka-native-update-test-'));
  const helperPath = path.join(directory, 'Braka.UpdateHelper.exe');
  const installer = path.join(directory, 'fixture.exe');
  const marker = path.join(directory, 'started');
  const compiler = path.join(process.env.SystemRoot, 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  execFileSync(compiler, ['/nologo', '/target:winexe', '/reference:System.Windows.Forms.dll', `/out:${helperPath}`, source]);
  execFileSync(compiler, ['/nologo', '/target:winexe', `/out:${installer}`, path.join(root, 'tests/fixtures/update-installer-fixture.cs')]);
  const expectedHash = crypto.createHash('sha256').update(fs.readFileSync(installer)).digest('hex');
  const options = { helperPath, expectedHash, journalDirectory: directory };
  const script = `require(${JSON.stringify(path.join(root, 'electron/update-installer.cjs'))}).launchInstallerAfterAppExit(${JSON.stringify(installer)}, process.pid, ${JSON.stringify(options)}).catch(error=>{console.error(error.message);process.exitCode=1;})`;
  await promisify(execFile)(process.execPath, ['-e', script], { timeout: 30000, windowsHide: true, env: { ...process.env, BRAKA_TEST_MARKER: marker } });
  const deadline = Date.now() + 15000;
  while (!fs.existsSync(marker) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(fs.readFileSync(marker, 'utf8'), 'started');
  const { launchInstallerAfterAppExit } = require('../electron/update-installer.cjs');
  await assert.rejects(launchInstallerAfterAppExit(installer, process.pid,
    { ...options, expectedHash: '0'.repeat(64) }), /readiness|rejected/);
  await assert.rejects(launchInstallerAfterAppExit(installer, process.pid,
    { ...options, expectedParentExe: path.join(directory, 'different-parent.exe') }), /readiness|rejected/);
  const logs = fs.readdirSync(directory).filter(name => name.endsWith('.log')).map(name => fs.readFileSync(path.join(directory, name), 'utf8'));
  assert.equal(logs.filter(log => log.includes('installer_started')).length, 1);
  assert.equal(logs.filter(log => log.includes('failed_InvalidDataException')).length, 2);
  // Deliberately retain this isolated evidence folder; never touch installed app data.
});
