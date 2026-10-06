// Runs the freshly packaged Windows app from win-unpacked without installing it.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer-core';

const profile = await mkdtemp(join(tmpdir(), 'braka-package-smoke-'));
const executable = join(process.cwd(), 'dist-electron', 'win-unpacked', 'براكه.exe');
const child = spawn(executable, ['--remote-debugging-port=9343', `--user-data-dir=${profile}`],
  { cwd: process.cwd(), stdio: 'ignore', windowsHide: true });
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try { browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9343' }); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  assert.ok(browser, 'Packaged app did not expose a renderer');
  const page = (await browser.pages()).find(candidate => candidate.url().startsWith('file:'));
  assert.ok(page, 'Packaged app did not open its local assets');
  await page.waitForSelector('input[placeholder="أدخل اسم المستخدم أو البريد"]', { timeout: 20000 });
  const state = await page.evaluate(() => ({
    hasLogin: Boolean(document.querySelector('input[placeholder="أدخل اسم المستخدم أو البريد"]')) && document.body.innerText.includes('كلمة المرور'),
    hasVersion: document.body.innerText.includes('2.6.9'),
    logoLoaded: [...document.images].some(image => image.alt?.includes('براكه') && image.complete && image.naturalWidth > 0)
  }));
  assert.deepEqual(state, { hasLogin: true, hasVersion: true, logoLoaded: true });
  console.log(JSON.stringify({ packagedWindowsApp: 'booted', ...state }));
} finally {
  if (browser) await browser.disconnect();
  child.kill();
  if (child.exitCode === null) await Promise.race([once(child, 'exit'), new Promise(resolve => setTimeout(resolve, 3000))]);
  if (resolve(profile).startsWith(resolve(tmpdir()) + sep) && basename(profile).startsWith('braka-package-smoke-')) {
    for (let attempt = 0; attempt < 6; attempt++) {
      try { await rm(profile, { recursive: true, force: true }); break; }
      catch (error) {
        if (error.code !== 'EBUSY' || attempt === 5) throw error;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
}
