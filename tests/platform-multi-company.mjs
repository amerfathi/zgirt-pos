// Actual browser/Electron UI journeys against the loopback-only D1 harness.
// No production accounts, no direct app-store calls, no credentials in artifacts.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const live = process.env.BRAKA_LIVE_TEST_CONFIG ? JSON.parse(await readFile(process.env.BRAKA_LIVE_TEST_CONFIG, 'utf8')) : null;
if (live && (live.origin !== 'https://khodar-pos.pages.dev' || Object.values(live.companies).some(id => !/^LIVEQA-[A-F0-9]{8}-C[AB]$/.test(String(id)))))
  throw Error('Refusing unsafe live tenant scope');
const origin = live?.origin || process.env.BRAKA_TEST_ORIGIN || 'http://127.0.0.1:8790';
if (!live && !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw Error('Local harness requires loopback');
const fixturePassword = live?.password || 'MatrixOnly!2026';
const companyId = company => live?.companies[company] || company;
const artifacts = resolve(live ? 'scratch/artifacts/live-multi-company' : 'scratch/artifacts/multi-company');
await mkdir(artifacts, { recursive: true });
const chrome = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const resources = [], results = [];
const cloudTokens = new Map();
const runId = Date.now().toString();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function fillInput(page, selector, value) {
  await page.waitForSelector(selector);
  await page.evaluate((selector, value) => {
    const field = document.querySelector(selector);
    field.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }, selector, value);
  await page.waitForFunction((selector, value) => document.querySelector(selector)?.value === value, {}, selector, value);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
const clickText = (page, text) => page.evaluate(text => {
  const button = [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === text);
  if (!button) throw Error(`Button absent: ${text}`);
  button.click();
}, text);
async function durable(page) {
  return page.evaluate(async () => {
    const identity = JSON.parse(sessionStorage.getItem('khodar_verified_session_user'));
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('braka_durable_aggregates_v1');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const rows = await new Promise((resolve, reject) => {
      const request = db.transaction('aggregates', 'readonly').objectStore('aggregates').getAll();
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    db.close();
    const row = rows.find(row => row.identity?.tenantId === identity.tenantId && row.identity?.id === identity.id);
    return row ? { tenant: identity.tenantId, user: identity.id, state: row.state,
      outbox: row.outbox, cursor: row.cursor } : null;
  });
}
async function cloud(company) {
  company = companyId(company);
  if (!cloudTokens.has(company)) {
    const auth = await fetch(`${origin}/api/tenants/lookup`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeCode: company, username: `owner-${company}`, password: fixturePassword }) }).then(r => r.json());
    assert.equal(auth.success, true);
    cloudTokens.set(company, auth.session.token);
  }
  const response = await fetch(`${origin}/api/sync/pull?tenantId=${company}&cursor=0`, { headers: { Authorization: `Bearer ${cloudTokens.get(company)}` } });
  assert.equal(response.status, 200);
  return response.json();
}
async function client(company, username, platform = 'web', port = 9340) {
  company = companyId(company);
  let browser, page;
  if (platform === 'android') {
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port || 9351}`, defaultViewport: null });
    page = (await browser.pages())[0];
    await (await page.createCDPSession()).send('Emulation.clearDeviceMetricsOverride');
    resources.push(() => browser.disconnect());
  } else if (platform === 'windows') {
    const profile = await mkdtemp(join(tmpdir(), 'braka-multicompany-'));
    const child = spawn(process.env.BRAKA_TEST_WINDOWS_EXECUTABLE || live?.windowsExecutable || join(resolve(), 'node_modules/electron/dist/electron.exe'), [
      `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '.'
    ], { windowsHide: true, stdio: 'ignore' });
    resources.push(async () => {
      browser?.disconnect(); child.kill();
      for (let i = 0; i < 50 && child.exitCode === null; i++) await delay(100);
      if (child.exitCode !== null) await rm(profile, { recursive: true, force: true });
    });
    for (let i = 0; i < 100; i++) {
      try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` }); break; } catch { await delay(100); }
    }
    assert.ok(browser, 'Electron did not expose the isolated renderer');
    page = (await browser.pages()).find(page => page.url().startsWith('file:'));
  } else {
    const context = await chrome.createBrowserContext(); resources.push(() => context.close());
    const webOrigin = process.env.BRAKA_TEST_WEB_ORIGIN || origin;
    if (webOrigin !== origin && !/^http:\/\/127\.0\.0\.1:\d+$/.test(webOrigin) &&
        !(live&&webOrigin==='https://qa-2614.khodar-pos.pages.dev')) throw Error('Candidate UI requires an explicit isolated QA origin');
    page = await context.newPage(); await page.goto(`${webOrigin}/?login=true`, { waitUntil: 'networkidle2' });
  }
  const errors = [], responses = [];
  page.on('request', request => {
    if (request.url().endsWith('/api/tenants/lookup')) {
      const body = JSON.parse(request.postData() || '{}');
      console.log(JSON.stringify({ loginRequest: { company, username, platform, submittedCode: body.storeCode, submittedUser: body.username } }));
    }
  });
  page.on('dialog', dialog => dialog.accept());
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/api/sync/')) responses.push({ route: new URL(response.url()).pathname, status: response.status() });
  });
  if (platform === 'android' && !await page.$('input[type="password"]')) {
    await page.evaluate(() => {
      const button = document.querySelector('button[title="تسجيل الخروج"]') ||
        [...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'تسجيل الخروج');
      if (!(button instanceof HTMLButtonElement)) throw Error('Android logout control absent');
      button.click();
    });
  }
  await page.waitForSelector('input[type="password"]', { timeout: 30000 });
  await page.locator('button[title="تغيير كود المتجر"]').click();
  await fillInput(page, 'input[placeholder="مثال: BRK-101"]', company);
  await clickText(page, 'تثبيت');
  await page.waitForFunction(company => !document.querySelector('input[placeholder="مثال: BRK-101"]') && document.body.innerText.includes(company), {}, company);
  await fillInput(page, 'input[placeholder*="أدخل اسم المستخدم"]', username);
  await fillInput(page, 'input[type="password"]', fixturePassword);
  await page.locator('form button[type="submit"]').click();
  try {
    if (platform === 'android') {
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button =>
        button.textContent.trim() === 'نقطة البيع' || button.textContent.trim() === 'نقطة البيع والميزان'), { timeout: 30000 });
      await page.evaluate(() => {
        const button = [...document.querySelectorAll('button')].find(button =>
          button.textContent.trim() === 'نقطة البيع' || button.textContent.trim() === 'نقطة البيع والميزان');
        if (!button) throw Error('Sale navigation absent'); button.click();
      });
    }
    await page.waitForFunction(company => document.body.innerText.includes(`${company} Tomatoes`), { timeout: 30000 }, company);
  } catch (error) {
    await page.screenshot({ path: join(artifacts, `failed-login-${company}-${username}-${platform}.png`), fullPage: true }).catch(() => {});
    console.log(JSON.stringify({ failedLogin: { company, username, platform }, screen: await page.evaluate(() => document.body.innerText), errors, responses }));
    throw error;
  }
  for (let i = 0; i < 100; i++) { if ((await durable(page))?.state?.khodar_pos_products_v3?.length) break; await delay(100); }
  const state = await durable(page);
  assert.ok(state, 'Durable financial store absent');
  assert.ok(state.state.khodar_pos_products_v3.every(product => product.tenantId === company));
  assert.ok(state.state.khodar_pos_products_v3.every(product => product.branchId === `${company}-branch-${username === 'branch2-cashier' ? 2 : 1}`));
  assert.ok(!(await page.evaluate(() => document.body.innerText)).includes(`${company === companyId('CA') ? companyId('CB') : companyId('CA')} Tomatoes`));
  const scopedOrigin=platform==='web'?(process.env.BRAKA_TEST_WEB_ORIGIN||origin):origin;
  const scope = await page.evaluate(async (origin, company, companies) => {
    const headers = { Authorization: `Bearer ${sessionStorage.getItem('khodar_pos_session_token')}` };
    const foreign = await fetch(`${origin}/api/sync/pull?tenantId=${company}`, { headers });
    const other = await fetch(`${origin}/api/sync/pull?tenantId=${company === companies.CA ? companies.CB : companies.CA}&cursor=0`, { headers });
    const own = await fetch(`${origin}/api/sync/pull?tenantId=${company}&cursor=0`, { headers }).then(r => r.json());
    return { foreignTenantStatus: other.status, ownTenantStatus: foreign.status, branches: [...new Set(own.events.map(event => event.branchId))] };
  }, scopedOrigin, company, { CA: companyId('CA'), CB: companyId('CB') });
  assert.equal(scope.foreignTenantStatus, 403);
  assert.deepEqual(scope.branches, [`${company}-branch-${username === 'branch2-cashier' ? 2 : 1}`]);
  return { page, company, username, platform, errors, responses };
}
async function prepareSale(c, note) {
  const name = `${c.company} Tomatoes ${c.username === 'branch2-cashier' ? 2 : 1}`;
  await c.page.evaluate(name => {
    const button = [...document.querySelectorAll('button')].find(button => button.textContent?.includes(name));
    if (!button) throw Error('Scoped product absent'); button.click();
  }, name);
  await c.page.waitForSelector('input[placeholder="أدخل الوزن الإجمالي على الميزان"]');
  // Existing fixture product defaults to tare 2 kg. Gross 3 kg => net 1 kg.
  await c.page.locator('input[placeholder="أدخل الوزن الإجمالي على الميزان"]').fill('3');
  await clickText(c.page, 'اعتماد الصنف بالفاتورة');
  await c.page.locator('input[placeholder="ملاحظات تظهر بالفاتورة قبل الطباعة (اختياري)..."]').fill(note);
}
async function commitSale(c) {
  const before = (await durable(c.page)).state.khodar_pos_invoices_v3.length;
  await clickText(c.page, 'حفظ بدون طباعة');
  for (let i = 0; i < 200; i++) {
    const after = await durable(c.page);
    if (after.state.khodar_pos_invoices_v3.length > before) return after;
    await delay(100);
  }
  throw Error(`Sale not durably saved (${c.platform}/${c.username}): ${(await c.page.evaluate(() => document.body.innerText)).slice(-800)}`);
}
async function scenario(name, identities, offline) {
  const checkpoint = step => console.log(JSON.stringify({ scenario: name, step }));
  checkpoint('login');
  const clients = [];
  for (const [company, username, platform, port] of identities) clients.push(await client(company, username, platform, port));
  const before = {};
  for (const company of new Set(clients.map(c => c.company))) before[company] = (await cloud(company)).events.filter(e => e.entityType === 'invoice').length;
  checkpoint('prepare-sale');
  // Native keyboard focus is shared across Windows. Prepare serially; saves below remain concurrent.
  for (const [i,c] of clients.entries()) {
    try{await prepareSale(c,`${name}-${runId}-${i}`);}
    catch(error){
      await c.page.screenshot({path:join(artifacts,`${name}-prepare-failure-${i}.png`),fullPage:true});
      console.log(JSON.stringify({prepareFailure:{company:c.company,user:c.username,platform:c.platform},errors:c.errors,
        screen:await c.page.evaluate(()=>document.body.innerText.slice(-1500))}));throw error;
    }
  }
  if (offline) await Promise.all(clients.map(c => c.page.setOfflineMode(true)));
  checkpoint('commit-sale');
  if (name.endsWith('sequential')) {
    for (const c of clients) {
      await commitSale(c);
      for (let i = 0; i < 100 && (await durable(c.page)).outbox.length; i++) await delay(100);
    }
  } else await Promise.all(clients.map(c => commitSale(c)));
  if (offline) {
    for (const c of clients) assert.ok((await durable(c.page)).outbox.some(event => event.entityType === 'invoice'), 'Offline invoice missing from durable outbox');
    for (const company of Object.keys(before)) assert.equal((await cloud(company)).events.filter(e => e.entityType === 'invoice').length, before[company], 'Offline mutation reached the server');
    await Promise.all(clients.map(c => c.page.setOfflineMode(false)));
  }
  const until = Date.now() + 18000;
  while (Date.now() < until) {
    if ((await Promise.all(clients.map(c => durable(c.page)))).every(row => !row.outbox.length)) break;
    await delay(400);
  }
  const observations = [];
  checkpoint('verify-server-and-restart');
  for (let i = 0; i < clients.length; i++) {
    const c = clients[i], snapshot = await cloud(c.company);
    let row = await durable(c.page), restartVerified = false;
    if (process.env.BRAKA_VERIFY_RESTART === 'true' && !row.outbox.length) {
      checkpoint(`reload-${c.platform}`);
      await c.page.reload({ waitUntil: 'domcontentloaded' });
      for (let attempt = 0; attempt < 100; attempt++) {
        row = await durable(c.page);
        if (row && row.cursor >= snapshot.nextCursor && !row.outbox.length) break;
        await delay(200);
      }
      if(!(row?.cursor>=snapshot.nextCursor)) console.log(JSON.stringify({restartFailure:{name,platform:c.platform,cursor:row?.cursor,expected:snapshot.nextCursor,pending:row?.outbox?.length,responses:c.responses,errors:c.errors,screen:(await c.page.evaluate(()=>document.body.innerText)).slice(0,1500)}}));
      assert.ok(row?.cursor >= snapshot.nextCursor, 'Restart did not refresh the accepted server prefix');
      for (const product of row.state.khodar_pos_products_v3) {
        const source = snapshot.events.find(event => event.entityType === 'product' && event.action === 'create' && event.entityId === product.id);
        assert.ok(source, 'Fixture product source absent');
        const weight = snapshot.events.filter(event => event.entityType === 'invoice' && event.action === 'create')
          .flatMap(event => event.payload.items).filter(item => item.productId === product.id)
          .reduce((sum, item) => sum + Number(item.netWeight || 0), 0);
        assert.equal(product.currentStockKg, source.payload.currentStockKg - weight, 'Restart duplicated or lost sale stock effects');
      }
      restartVerified = true;
    }
    const accepted = snapshot.events.filter(e => e.entityType === 'invoice' && e.payload?.notes === `${name}-${runId}-${i}`);
    const pending = row.outbox.filter(e => e.entityType === 'invoice' && e.payload?.notes === `${name}-${runId}-${i}`);
    const invoice = row.state.khodar_pos_invoices_v3.find(invoice => invoice.notes === `${name}-${runId}-${i}`);
    assert.ok(invoice, 'Saved invoice disappeared');
    assert.ok(accepted.length === 1 || pending.length === 1, 'Invoice neither accepted once nor retained pending');
    assert.ok(accepted.length <= 1, 'Duplicate financial source on server');
    let pendingSurvivesReload = null;
    if (pending.length) {
      await writeFile(join(artifacts, `${name}-${runId}-${i}-pending-ledger.json`), JSON.stringify(row, null, 2));
      await c.page.reload({ waitUntil: 'networkidle2' });
      const restored = await durable(c.page);
      pendingSurvivesReload = restored.outbox.some(event => event.id === pending[0].id) &&
        restored.state.khodar_pos_invoices_v3.some(row => row.id === invoice.id);
      assert.equal(pendingSurvivesReload, true, 'Conflicted financial record lost on renderer restart');
      await c.page.waitForFunction(() => !document.body.innerText.includes('جاري تهيئة المنظومة'), { timeout: 20000 });
    }
    checkpoint(`screenshot-${c.platform}`);
    await c.page.screenshot({ path: join(artifacts, `${name}-${i}.png`), fullPage: true });
    observations.push({ company: c.company, user: c.username, platform: c.platform,
      total: invoice.finalTotal ?? invoice.total, invoiceNumber: invoice.number ?? invoice.invoiceNumber,
      invoiceId: invoice.id,
      accepted: accepted.length, pending: pending.length, syncResponses: c.responses,
      pendingSurvivesReload, restartVerified, errors: c.errors, localStock: row.state.khodar_pos_products_v3.map(p => ({ id: p.id, stock: p.currentStockKg })) });
  }
  const result = { name, offline, observations, completelySynced: observations.every(o => o.accepted === 1 && o.pending === 0) };
  results.push(result); console.log(JSON.stringify(result));
  await writeFile(join(artifacts, `results-${runId}.json`), JSON.stringify(results, null, 2));
  for (const c of clients) if (c.platform !== 'android') await c.page.close();
}
try {
  /** @type {Array<[string, Array<[string, string, string, number?]>, boolean]>} */
  const cases = [
    ['different-companies-online', [['CA','cashier-1','web'], ['CB','cashier-1','windows',9340]], false],
    ['different-companies-offline', [['CA','branch2-cashier','web'], ['CB','cashier-2','windows',9341]], true],
    ['different-cashiers-same-branch-offline', [['CA','cashier-1','web'], ['CA','cashier-2','windows',9342]], true],
    ['different-cashiers-same-branch-sequential', [['CA','cashier-1','web'], ['CA','cashier-2','windows',9348]], false],
    ['same-account-two-devices-online', [['CB','cashier-1','web'], ['CB','cashier-1','windows',9343]], false],
    ['same-account-two-devices-offline', [['CB','cashier-2','web'], ['CB','cashier-2','windows',9344]], true],
    ['different-branches-same-company-offline', [['CA','cashier-1','web'], ['CA','branch2-cashier','windows',9345]], true],
    ['same-account-two-windows-online', [['CB','cashier-1','windows',9346], ['CB','cashier-1','windows',9347]], false]
  ];
  if (process.argv[2]?.includes('android')) cases.push(
    ['android-web-different-cashiers-offline', [['CA','cashier-1','web'], ['CA','cashier-2','android',9351]], true]
  );
  for (const [name, identities, offline] of cases) {
    if (process.argv[2] && !name.includes(process.argv[2])) continue;
    try { await scenario(name, identities, offline); }
    catch (error) {
      results.push({ name, status: 'FAILED', error: error.message, stack: error.stack });
      console.log(JSON.stringify(results.at(-1)));
      await writeFile(join(artifacts, `results-${runId}.json`), JSON.stringify(results, null, 2));
    }
  }
} finally {
  for (const release of resources.reverse()) { try { await release(); } catch { /* report already preserved */ } }
  await chrome.close();
}
// Retention is a safety property, not a passing synchronization outcome.
if (results.some(result => result.status === 'FAILED' || result.completelySynced === false)) process.exitCode = 1;
