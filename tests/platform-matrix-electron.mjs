import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const origin = 'http://127.0.0.1:8788';
const credentials = { storeCode: 'MATRIX', username: 'owner', password: 'MatrixOnly!2026' };
const auth = await fetch(`${origin}/api/tenants/lookup`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(credentials) }).then(response => response.json());
assert.equal(auth.success, true, JSON.stringify(auth));
const before = await fetch(`${origin}/api/sync/pull?tenantId=matrix-tenant&cursor=0`, {
  headers: { Authorization: `Bearer ${auth.session.token}` }
}).then(response => response.json());
const webExpense = before.events.find(event => event.entityType === 'expense' && event.payload?.title === 'Matrix transport expense');
assert.ok(webExpense?.id, 'Web-created financial event is absent from the server fixture');
const androidExpense = before.events.find(event => event.entityType === 'expense' && event.payload?.title === 'Android matrix expense');

const profile = await mkdtemp(join(tmpdir(), 'braka-electron-matrix-'));
const electron = spawn(join(process.cwd(), 'node_modules/electron/dist/electron.exe'), [
  '--remote-debugging-port=9333', `--user-data-dir=${profile}`, '.'
], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let electronOutput = '';
electron.stdout.on('data', chunk => { electronOutput += chunk; });
electron.stderr.on('data', chunk => { electronOutput += chunk; });
let desktop;
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { desktop = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333' }); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  assert.ok(desktop, `Electron DevTools endpoint unavailable: ${electronOutput}`);
  const pages = await desktop.pages();
  const page = pages.find(candidate => candidate.url().startsWith('file:')) || pages[0];
  assert.ok(page, 'Electron renderer page absent');
  const pulls = [];
  const pushes = [];
  const failures = [];
  page.on('pageerror', error => failures.push(error instanceof Error ? error.message : String(error)));
  page.on('request', request => {
    if (request.url().endsWith('/api/sync/push')) {
      try { pushes.push(...(JSON.parse(request.postData() || '{}').events || [])); } catch { /* assertion below */ }
    }
  });
  page.on('response', async response => {
    if (response.url().includes('/api/sync/pull') && response.ok()) {
      const body = await response.json(); pulls.push(...(body.events || []));
    }
  });
  await page.waitForSelector('input[placeholder="أدخل اسم المستخدم أو البريد"]', { timeout: 25000 });
  await page.locator('button[title="تغيير كود المتجر"]').click();
  await page.locator('input[placeholder="مثال: BRK-101"]').fill('MATRIX');
  await page.locator('input[placeholder="أدخل اسم المستخدم أو البريد"]').fill('owner');
  await page.locator('input[type="password"]').fill('MatrixOnly!2026');
  await page.locator('form button[type="submit"]').click();
  await page.waitForFunction(() => document.body.innerText.includes('المصروفات والتشغيل'), { timeout: 30000 });
  await page.evaluate(() => [...document.querySelectorAll('button')]
    .find(button => button.textContent?.trim() === 'المصروفات والتشغيل')?.click());
  await page.evaluate(() => [...document.querySelectorAll('button')]
    .find(button => button.textContent?.trim() === 'المصروفات اليومية')?.click());
  await page.waitForFunction(() => document.body.innerText.includes('Matrix transport expense'), { timeout: 20000 });
  assert.ok(pulls.some(event => event.id === webExpense.id), 'Electron did not pull the identical Web transaction ID');
  if (androidExpense) {
    await page.waitForFunction(() => document.body.innerText.includes('Android matrix expense'), { timeout: 20000 });
    assert.ok(pulls.some(event => event.id === androidExpense.id), 'Electron did not pull the identical Android transaction ID');
  }
  const desktopText = await page.evaluate(() => document.body.innerText);
  assert.ok(desktopText.includes('-12.00'), 'Electron does not show the Web expense cash impact');

  await page.evaluate(() => [...document.querySelectorAll('button')]
    .find(button => button.textContent?.trim() === 'تسجيل مصروف جديد')?.click());
  await page.select('select:has(option[value="نثريات وصيانة"])', 'نثريات وصيانة');
  await page.locator('input[placeholder="مثال: تنزيل حمولة بصل، أكياس تعبئة..."]').fill('Desktop matrix expense');
  await page.locator('input[type="number"][placeholder="0.00"]').fill('13');
  await page.evaluate(() => [...document.querySelectorAll('button')]
    .find(button => button.textContent?.trim() === 'حفظ وقيد المصروف')?.click());
  await page.waitForFunction(() => document.body.innerText.includes('Desktop matrix expense'), { timeout: 15000 });
  await new Promise(resolve => setTimeout(resolve, 5000));
  const desktopExpense = pushes.find(event => event.entityType === 'expense' && event.payload?.title === 'Desktop matrix expense');
  assert.ok(desktopExpense?.id, 'Electron-created expense did not enter the sync push');

  const chrome = await puppeteer.launch({ executablePath: process.env.BRAKA_CHROME_PATH ||
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  try {
    const replica = await chrome.newPage();
    const webPulls = [];
    replica.on('response', async response => {
      if (response.url().includes('/api/sync/pull') && response.ok()) {
        const body = await response.json(); webPulls.push(...(body.events || []));
      }
    });
    await replica.goto(`${origin}/?login=true`, { waitUntil: 'networkidle2' });
    await replica.waitForSelector('input[placeholder="أدخل اسم المستخدم أو البريد المسجل"]', { timeout: 20000 });
    await replica.locator('button[title="تغيير كود المتجر"]').click();
    await replica.locator('input[placeholder="مثال: BRK-101"]').fill('MATRIX');
    await replica.locator('input[placeholder="أدخل اسم المستخدم أو البريد المسجل"]').fill('owner');
    await replica.locator('input[type="password"]').fill('MatrixOnly!2026');
    await replica.locator('form button[type="submit"]').click();
    await replica.waitForFunction(() => document.body.innerText.includes('المصروفات والتشغيل'), { timeout: 30000 });
    await replica.evaluate(() => [...document.querySelectorAll('button')]
      .find(button => button.textContent?.trim() === 'المصروفات والتشغيل')?.click());
    await replica.evaluate(() => [...document.querySelectorAll('button')]
      .find(button => button.textContent?.trim() === 'المصروفات اليومية')?.click());
    await replica.waitForFunction(() => document.body.innerText.includes('Desktop matrix expense'), { timeout: 20000 });
    const webText = await replica.evaluate(() => document.body.innerText);
    const expectedTotal = androidExpense ? '39.00' : '25.00';
    assert.ok(webText.includes(expectedTotal), 'Web replica does not show combined expense/cash impact');
    assert.ok(webPulls.some(event => event.id === desktopExpense.id && Number(event.payload?.amount) === 13),
      'Web did not pull the identical Electron transaction ID and amount');
  } finally { await chrome.close(); }
  assert.deepEqual(failures, []);
  console.log(JSON.stringify({ result: androidExpense ? 'web-android-desktop-directions-pass' : 'web-desktop-two-directions-pass',
    webToDesktopId: webExpense.id, androidToDesktopId: androidExpense?.id || null,
    desktopToWebId: desktopExpense.id, amounts: androidExpense ? [12, 14, 13] : [12, 13],
    combinedCashImpact: androidExpense ? -39 : -25 }));
} finally {
  desktop?.disconnect();
  electron.kill();
  await new Promise(resolve => electron.once('exit', resolve));
  await rm(profile, { recursive: true, force: true });
}
