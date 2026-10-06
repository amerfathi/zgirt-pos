import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({ executablePath: process.env.BRAKA_CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8788/?login=true', { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[placeholder="أدخل اسم المستخدم أو البريد المسجل"]', { timeout: 20000 });
  await page.locator('button[title="تغيير كود المتجر"]').click();
  await page.locator('input[placeholder="مثال: BRK-101"]').fill('MATRIX');
  await page.locator('input[placeholder="أدخل اسم المستخدم أو البريد المسجل"]').fill('owner');
  await page.locator('input[type="password"]').fill('MatrixOnly!2026');
  await page.locator('form button[type="submit"]').click();
  try { await page.waitForFunction(() => document.body.innerText.includes('التوريد والمخزون'), { timeout: 30000 }); }
  catch (error) {
    console.log(JSON.stringify({ failedState: (await page.evaluate(() => document.body.innerText)).slice(0, 900) }));
    throw error;
  }
  await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'التوريد والمخزون')?.click());
  await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'المشتريات والموردين')?.click());
  await page.waitForFunction(() => document.body.innerText.includes('Matrix tomatoes') &&
    document.body.innerText.includes('Matrix supplier'), { timeout: 20000 });
  await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'تقرير A4')?.click());
  await page.waitForFunction(() => document.body.innerText.includes('Matrix tomatoes') &&
    document.body.innerText.includes('Matrix supplier') && document.body.innerText.includes('40.00'), { timeout: 15000 });
  const text = await page.evaluate(() => document.body.innerText);
  assert.ok(text.includes('10.00') || text.includes('10 كجم'), 'Web purchase report quantity is absent');
  console.log(JSON.stringify({ result: 'web-purchase-report-pass', quantityKg: 10, purchaseValue: 40,
    supplier: 'Matrix supplier', product: 'Matrix tomatoes' }));
} finally { await browser.close(); }
