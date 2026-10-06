import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-first-run'],
});
try {
  const dir = resolve('..', '..', 'ui-redesign', 'artifacts');
  await mkdir(dir, { recursive: true });
  /** @type {Array<[string, number, number]>} */
  const viewports = [['desktop', 1440, 900], ['mobile', 390, 844]];
  for (const [name, width, height] of viewports) {
    const page = await browser.newPage();
    /** @type {string[]} */
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle2' });
    await page.waitForSelector('header button:last-child', { timeout: 10000 });
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    const result = await page.evaluate(() => ({
      title: document.querySelector('h1')?.innerText,
      text: document.body.innerText,
      whatsapp: [...document.querySelectorAll('a[href^="https://wa.me/"]')].map(a => a.getAttribute('href')),
      overflow: document.documentElement.scrollWidth > innerWidth,
      primaryColor: getComputedStyle(/** @type {Element} */ (document.querySelector('header button:last-child'))).backgroundColor,
    }));
    assert.match(result.title || '', /إدارة البيع والمخزون والحسابات/);
    assert.ok(!result.text.includes('كروت تعريفية'));
    assert.ok(!result.text.includes('معتمد للموازين'));
    assert.ok(result.whatsapp.every(link => link.includes('966564982852')));
    assert.equal(result.overflow, false, `${name} horizontal overflow`);
    assert.equal(result.primaryColor, 'rgb(67, 79, 204)');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: resolve(dir, `landing-${name}-2026-10-01.png`), fullPage: true });
    await page.close();
    console.log(`${name}: heading, contact, palette, overflow, runtime OK`);
  }
} finally {
  await browser.close();
}
