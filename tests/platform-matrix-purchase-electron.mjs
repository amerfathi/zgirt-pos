import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const origin = 'http://127.0.0.1:8788';
const auth = await fetch(`${origin}/api/tenants/lookup`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ storeCode: 'MATRIX', username: 'owner', password: 'MatrixOnly!2026' }) }).then(response => response.json());
const cloud = await fetch(`${origin}/api/sync/pull?tenantId=matrix-tenant&cursor=0`, {
  headers: { Authorization: `Bearer ${auth.session.token}` }
}).then(response => response.json());
const purchase = cloud.events.find(event => event.entityType === 'purchase' && event.payload?.productName === 'Matrix tomatoes');
const product = cloud.events.find(event => event.entityType === 'product' && event.payload?.name === 'Matrix tomatoes');
const supplier = cloud.events.find(event => event.entityType === 'supplier' && event.payload?.name === 'Matrix supplier');
assert.ok(purchase?.id && product?.id && supplier?.id, 'Canonical purchase group is absent from D1');

const profile = await mkdtemp(join(tmpdir(), 'braka-electron-purchase-'));
const processHandle = spawn(join(process.cwd(), 'node_modules/electron/dist/electron.exe'), [
  '--remote-debugging-port=9333', `--user-data-dir=${profile}`, '.'
], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let output = '';
processHandle.stdout.on('data', chunk => { output += chunk; });
processHandle.stderr.on('data', chunk => { output += chunk; });
let desktop;
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { desktop = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333' }); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  assert.ok(desktop, output);
  const page = (await desktop.pages()).find(item => item.url().startsWith('file:'));
  assert.ok(page, 'Electron page absent');
  const pulls = [];
  page.on('response', async response => {
    if (response.url().includes('/api/sync/pull') && response.ok()) pulls.push(...((await response.json()).events || []));
  });
  await page.waitForSelector('input[placeholder="أدخل اسم المستخدم أو البريد"]', { timeout: 25000 });
  await page.locator('button[title="تغيير كود المتجر"]').click();
  await page.locator('input[placeholder="مثال: BRK-101"]').fill('MATRIX');
  await page.locator('input[placeholder="أدخل اسم المستخدم أو البريد"]').fill('owner');
  await page.locator('input[type="password"]').fill('MatrixOnly!2026');
  await page.locator('form button[type="submit"]').click();
  await page.waitForFunction(() => document.body.innerText.includes('التوريد والمخزون'), { timeout: 30000 });
  await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'التوريد والمخزون')?.click());
  await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'المشتريات والموردين')?.click());
  await page.waitForFunction(() => document.body.innerText.includes('Matrix tomatoes') &&
    document.body.innerText.includes('Matrix supplier'), { timeout: 20000 });
  assert.ok([purchase.id, product.id, supplier.id].every(id => pulls.some(event => event.id === id)), 'Electron pull lacks purchase group IDs');
  const durable = await page.evaluate(async ids => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('braka_durable_aggregates_v1');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const rows = await new Promise((resolve, reject) => { const tx = db.transaction('aggregates', 'readonly');
      const request = tx.objectStore('aggregates').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const row = rows.find(item => item?.identity?.tenantId === 'matrix-tenant');
    const item = row?.state?.khodar_pos_products_v3?.find(entry => entry.name === 'Matrix tomatoes');
    const vendor = row?.state?.khodar_pos_suppliers_v3?.find(entry => entry.name === 'Matrix supplier');
    return { applied: ids.every(id => Boolean(row?.applied?.[id])), stock: item?.currentStockKg,
      cost: item?.costPerKg, supplierDebt: vendor?.balance };
  }, [purchase.id, product.id, supplier.id]);
  assert.deepEqual(durable, { applied: true, stock: 10, cost: 4, supplierDebt: 40 });
  await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'تقرير A4')?.click());
  await page.waitForFunction(() => document.body.innerText.includes('Matrix tomatoes') &&
    document.body.innerText.includes('Matrix supplier') && document.body.innerText.includes('40.00'), { timeout: 15000 });
  console.log(JSON.stringify({ result: 'web-purchase-to-desktop-pass', ids: [product.id, supplier.id, purchase.id],
    stock: 10, weightedCost: 4, supplierDebt: 40, purchaseReport: 40 }));
} finally {
  desktop?.disconnect();
  processHandle.kill();
  await new Promise(resolve => processHandle.once('exit', resolve));
  await rm(profile, { recursive: true, force: true });
}
