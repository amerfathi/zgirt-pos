const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/** @param {string} installer @param {number} parentPid
 * @param {{helperPath?:string,expectedHash:string,journalDirectory:string,expectedParentExe?:string}} options
 * @param {(command:string,args:string[],options:{detached:boolean,stdio:'ignore',windowsHide:boolean}) => import('node:events').EventEmitter & {unref():void}} spawnProcess */
async function launchInstallerAfterAppExit(installer, parentPid, options, spawnProcess = spawn) {
  if (!Number.isSafeInteger(parentPid) || parentPid < 1 || !path.isAbsolute(installer) || path.extname(installer).toLowerCase() !== '.exe')
    throw new Error('Invalid verified installer or parent');
  if (!options || !/^[a-f0-9]{64}$/.test(options.expectedHash)) throw new Error('Missing verified installer checksum');
  const helper = options.helperPath || path.join(__dirname, '../build/Braka.UpdateHelper.exe');
  if (!fs.existsSync(helper)) throw new Error('Update helper is missing. Reinstall the application package.');
  fs.mkdirSync(options.journalDirectory, { recursive: true });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'braka-native-handoff-'));
  const ready = path.join(directory, 'ready');
  // Run from a private temporary copy, not resources being replaced by NSIS.
  const temporaryHelper = path.join(directory, 'Braka.UpdateHelper.exe');
  fs.copyFileSync(helper, temporaryHelper, fs.constants.COPYFILE_EXCL);
  const journal = path.join(options.journalDirectory, path.basename(directory) + '.log');
  const child = spawnProcess(temporaryHelper, [installer, String(parentPid), options.expectedParentExe || process.execPath,
    options.expectedHash, ready, journal], { detached: true, stdio: 'ignore', windowsHide: true });
  await new Promise((resolve, reject) => {
    let settled = false;
    const state = () => { try { return fs.readFileSync(ready, 'utf8'); } catch { return ''; } };
    const finish = error => {
      if (settled) return;
      settled = true; clearTimeout(timeout); clearInterval(poll);
      child.removeListener('error', failed); child.removeListener('exit', exited);
      if (error) {
        try { fs.writeFileSync(ready + '.cancel', 'cancelled'); } catch {}
        reject(error);
      } else resolve(undefined);
    };
    const failed = error => finish(error);
    const exited = () => finish(new Error('Update helper stopped before confirming readiness'));
    const check = () => {
      const value = state();
      if (value === 'ready') finish();
      else if (value === 'failed') finish(new Error('Update helper rejected the handoff; application remains open'));
    };
    const poll = setInterval(check, 100);
    const timeout = setTimeout(() => finish(new Error('Update helper readiness timed out; application remains open')), 15000);
    child.once('error', failed); child.once('exit', exited);
  });
  child.unref();
  return { journal };
}
module.exports = { launchInstallerAfterAppExit };
