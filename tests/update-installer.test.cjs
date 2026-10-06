const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { launchInstallerAfterAppExit } = require('../electron/update-installer.cjs');
const installer = path.resolve('scratch/fixture-installer.exe');
const options = { helperPath: path.join(__dirname, '../electron/native/UpdateHelper.cs'),
  expectedHash: 'a'.repeat(64), journalDirectory: path.resolve('scratch/update-test-journals') };

test('application shutdown is authorized only after helper readiness, not process spawn', async () => {
  let unreferenced = false, settled = false, ready;
  const child = Object.assign(new EventEmitter(), { unref: () => { unreferenced = true; } });
  const started = launchInstallerAfterAppExit(installer, 4321, options, (file, args, config) => {
    assert.notEqual(file, options.helperPath, 'helper must not lock installed resources during upgrade');
    assert.equal(path.basename(file), 'Braka.UpdateHelper.exe');
    assert.deepEqual(fs.readFileSync(file), fs.readFileSync(options.helperPath));
    assert.equal(args[0], installer);
    assert.equal(args[1], '4321');
    assert.equal(args[3], options.expectedHash);
    assert.deepEqual(config, { detached: true, stdio: 'ignore', windowsHide: true });
    ready = args[4]; queueMicrotask(() => child.emit('spawn')); return child;
  }).then(() => { settled = true; });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(settled, false); assert.equal(unreferenced, false);
  fs.writeFileSync(ready, 'ready');
  await started; assert.equal(unreferenced, true);
});

test('helper launch failure does not authorize shutdown', async () => {
  const child = Object.assign(new EventEmitter(), { unref: () => assert.fail('failed handoff') });
  const started = launchInstallerAfterAppExit(installer, 55, options, () => {
    queueMicrotask(() => child.emit('error', new Error('launch denied'))); return child;
  });
  await assert.rejects(started, /launch denied/);
});

test('helper exit or rejection before readiness fails without claiming success', async () => {
  for (const kind of ['exit', 'failed']) {
    const child = Object.assign(new EventEmitter(), { unref: () => assert.fail('failed handoff') });
    await assert.rejects(launchInstallerAfterAppExit(installer, 55, options, (_file, args) => {
      queueMicrotask(() => kind === 'exit' ? child.emit('exit', 20) : fs.writeFileSync(args[4], 'failed'));
      return child;
    }), /readiness|remains open/);
  }
});

test('missing helper fails before any process is launched', async () => {
  await assert.rejects(launchInstallerAfterAppExit(installer, 55,
    { ...options, helperPath: path.resolve('scratch/no-such-helper.exe') }, () => assert.fail('no helper')),
  /missing/);
});

test('update handoff closes gracefully only after validated helper readiness', () => {
  const main = fs.readFileSync(path.join(__dirname, '../electron/main.cjs'), 'utf8');
  const handler = main.slice(main.indexOf("ipcMain.handle('install-update'"), main.indexOf("app.whenReady()"));
  assert.match(handler, /await launchInstallerAfterAppExit/);
  assert.match(handler, /expectedHash: verifiedUpdate.manifest.sha256/);
  assert.doesNotMatch(handler, /app.quit\(\)/);
  const native = fs.readFileSync(path.join(__dirname, '../electron/native/UpdateHelper.cs'), 'utf8');
  assert.match(native, /ProcessWindowStyle.Normal/);
  assert.doesNotMatch(native, /\.Kill\(|taskkill|powershell/i);
  const nsis = fs.readFileSync(path.join(__dirname, '../electron/installer.nsh'), 'utf8');
  assert.match(nsis, /nsProcess::_FindProcess/);
  assert.doesNotMatch(nsis, /taskkill|nsExec::Exec/i);
});
