import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const origin = 'http://127.0.0.1:8788';
const browser = await puppeteer.launch({ executablePath: process.env.BRAKA_CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
try {
  const page = await browser.newPage();
  const pushes = [];
  const pushStatuses = [];
  page.on('request', request => {
    if (request.url().endsWith('/api/sync/push')) {
      try { pushes.push(...(JSON.parse(request.postData() || '{}').events || [])); } catch { /* asserted below */ }
    }
  });
  page.on('response', response => {
    if (response.url().endsWith('/api/sync/push')) pushStatuses.push(response.status());
  });
  await page.goto(`${origin}/?login=true`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[placeholder="أدخل اسم المستخدم أو البريد المسجل"]', { timeout: 20000 });
  await page.locator('button[title="تغيير كود المتجر"]').click();
  await page.locator('input[placeholder="مثال: BRK-101"]').fill('MATRIX');
  await page.locator('input[placeholder="أدخل اسم المستخدم أو البريد المسجل"]').fill('owner');
  await page.locator('input[type="password"]').fill('MatrixOnly!2026');
  await page.locator('form button[type="submit"]').click();
  await page.waitForFunction(() => document.body.innerText.includes('التوريد والمخزون'), { timeout: 30000 });
  await page.evaluate(() => [...document.querySelectorAll('button')]
    .find(button => button.textContent?.trim() === 'التوريد والمخزون')?.click());
  await page.evaluate(() => [...document.querySelectorAll('button')]
    .find(button => button.textContent?.trim() === 'المشتريات والموردين')?.click());
  await page.waitForFunction(() => document.body.innerText.includes('توريد جديد'), { timeout: 10000 });
  await page.evaluate(() => [...document.querySelectorAll('button')]
    .find(button => button.textContent?.trim() === 'توريد جديد')?.click());
  await page.evaluate(() => [...document.querySelectorAll('button')]
    .find(button => button.textContent?.trim() === 'صنف جديد تم شراؤه لأول مرة')?.click());
  await page.locator('input[placeholder="مثال: كوسة بلدية، فلفل رومي..."]').fill('Matrix tomatoes');
  await page.locator('input[placeholder="مثال: شركة التوريد، المورد أبو أحمد..."]').fill('Matrix supplier');
  await page.locator('input[placeholder="0.0"]').fill('10');
  const numberInputs = await page.$$('input[placeholder="0.00"]');
  assert.ok(numberInputs.length >= 3, 'Purchase cost inputs are missing');
  await page.evaluate(element => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, '4');
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, numberInputs.at(-2));
  await page.evaluate(() => [...document.querySelectorAll('button')]
    .find(button => button.textContent?.trim() === 'آجل (على الحساب)')?.click());
  await page.evaluate(() => [...document.querySelectorAll('button')]
    .find(button => button.textContent?.trim() === 'حفظ فاتورة التوريد')?.click());
  await page.waitForFunction(() => document.body.innerText.includes('Matrix tomatoes') &&
    document.body.innerText.includes('Matrix supplier'), { timeout: 20000 });
  await new Promise(resolve => setTimeout(resolve, 5000));
  const purchase = pushes.find(event => event.entityType === 'purchase' && event.payload?.productName === 'Matrix tomatoes');
  const product = pushes.find(event => event.entityType === 'product' && event.payload?.name === 'Matrix tomatoes');
  const supplier = pushes.find(event => event.entityType === 'supplier' && event.payload?.name === 'Matrix supplier');
  assert.ok(purchase?.id && product?.id && supplier?.id, `Incomplete purchase commit: ${JSON.stringify(pushes)}`);
  assert.equal(Number(purchase.payload.quantityKg), 10);
  assert.equal(Number(purchase.payload.costPerKg), 4);
  assert.equal(Number(purchase.payload.totalCost), 40);
  assert.equal(purchase.payload.paymentMethod, 'credit');
  assert.ok(pushStatuses.length && pushStatuses.every(status => status === 200), JSON.stringify(pushStatuses));
  console.log(JSON.stringify({ result: 'web-credit-purchase-pass', purchaseId: purchase.id, productId: product.id,
    supplierId: supplier.id, quantityKg: 10, weightedCost: 4, supplierDebt: 40, cashImpact: 0 }));
} finally { await browser.close(); }
