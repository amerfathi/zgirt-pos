// Manual local-only UI verification. Requires the isolated MATRIX fixture on 127.0.0.1:8788.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer-core';

const origin = 'http://127.0.0.1:8788';
const artifacts = resolve('..', '..', 'ui-redesign', 'artifacts');
await mkdir(artifacts, { recursive: true });

async function login(page, desktop) {
  if (!desktop) await page.goto(`${origin}/?login=true`, { waitUntil: 'networkidle2' });
  await page.waitForSelector(`input[placeholder="${desktop ? 'أدخل اسم المستخدم أو البريد' : 'أدخل اسم المستخدم أو البريد المسجل'}"]`, { timeout: 25000 });
  await page.locator('button[title="تغيير كود المتجر"]').click();
  await page.locator('input[placeholder="مثال: BRK-101"]').fill('MATRIX');
  await page.locator(`input[placeholder="${desktop ? 'أدخل اسم المستخدم أو البريد' : 'أدخل اسم المستخدم أو البريد المسجل'}"]`).fill('owner');
  await page.locator('input[type="password"]').fill('MatrixOnly!2026');
  await page.locator('form button[type="submit"]').click();
  await page.waitForFunction(() => document.body.innerText.includes('المصروفات والتشغيل'), { timeout: 30000 });
}

async function clickText(page, pattern) {
  const found = await page.evaluate(source => {
    const re = new RegExp(source);
    const button = [...document.querySelectorAll('button')].find(item => re.test(item.innerText.trim()));
    if (button) button.click();
    return button?.innerText.trim() || null;
  }, pattern);
  assert.ok(found, `Button not found: ${pattern}; available: ${JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(Boolean).slice(0, 100)))}`);
}

async function clickExactButton(page, label) {
  return page.evaluate(value => {
    const normalize = text => text.replace(/\s+/g, ' ').trim();
    const button = [...document.querySelectorAll('button')].find(item =>
      item.getClientRects().length && normalize(item.innerText) === value);
    button?.click();
    return Boolean(button);
  }, label);
}

async function smokeScreens(page) {
  const groups = [
    ['المبيعات والعملاء', ['نقطة البيع والميزان', 'سجل الفواتير', 'العملاء والديون']],
    ['التوريد والمخزون', ['المشتريات والموردين', 'الأصناف والأسعار', 'التوالف والهالك']],
    ['المصروفات والتشغيل', ['المصروفات اليومية', 'الموظفون والرواتب']],
    ['المالية والجرد والأرباح', ['الجرد ومطابقة الدرج', 'الشركاء والمسحوبات', 'التقارير']],
    ['الضبط والتخصيص', ['إعدادات وضبط النظام']],
  ];
  const screens = [];
  assert.ok(await clickExactButton(page, 'الرئيسية'));
  screens.push('الرئيسية');
  for (const [group, leaves] of groups) {
    for (const label of leaves) {
      if (!await clickExactButton(page, label)) {
        assert.ok(await clickExactButton(page, group), `Missing group ${group}`);
        assert.ok(await clickExactButton(page, label), `Missing screen ${label}`);
      }
      await new Promise(resolve => setTimeout(resolve, 50));
      const failed = await page.evaluate(() => document.body.innerText.includes('تعذر عرض الصفحة'));
      assert.ok(!failed, `${label} rendered an error boundary`);
      screens.push(label);
    }
  }
  const settingsTabs = ['المنشأة والضرائب', 'المظهر وحجم الخط', 'الفواتير والطباعة',
    'الميزان وسياسات البيع', 'المخزون والخزينة', 'المستخدمون والصلاحيات',
    'السحابة والنسخ الاحتياطي', 'الحساب والأمان', 'التحديثات وإصدار النظام'];
  for (const label of settingsTabs) {
    await clickText(page, label);
    await new Promise(resolve => setTimeout(resolve, 30));
    screens.push(`إعدادات: ${label}`);
  }
  assert.ok(await clickExactButton(page, 'التقارير'));
  const reportNames = ['التقرير التنفيذي اليومي للمالك', 'قائمة الدخل والأرباح والخسائر',
    'جرد الخزينة ومطابقة السيولة', 'الشركاء والمسحوبات والأرباح', 'المبيعات والإيرادات اليومية',
    'أرباح وهوامش الأصناف', 'أعمار ديون العملاء', 'كشف حساب تفصيلي لعميل', 'حركة وأوزان الأصناف',
    'المشتريات وتوريد البضاعة', 'كشف حساب الموردين', 'مردودات البيع والشراء',
    'التوالف وإعدامات البضاعة', 'معدل الهدر وعجز الميزان', 'إغلاق الوردية والدرج',
    'المصروفات والتشغيل', 'رواتب وسلفيات العمال'];
  for (const label of reportNames) {
    const found = await page.evaluate(value => {
      const heading = [...document.querySelectorAll('button h3')].find(item => item.textContent?.trim() === value);
      heading?.closest('button')?.click();
      return Boolean(heading);
    }, label);
    assert.ok(found, `Missing report ${label}`);
    await page.waitForSelector('#printable-a4-document', { timeout: 5000 });
    screens.push(`تقرير: ${label}`);
  }
  return screens;
}

async function inspect(page, platform) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page, platform === 'windows');
  await clickText(page, 'ضبط النظام');
  await page.waitForFunction(() => document.body.innerText.includes('السحابة والنسخ الاحتياطي'));
  await clickText(page, 'السحابة والنسخ الاحتياطي');
  await page.waitForFunction(() => document.body.innerText.includes('تغييرات بانتظار المزامنة'));
  await new Promise(resolve => setTimeout(resolve, 600));
  const cloud = await page.evaluate(() => document.body.innerText);
  assert.ok(cloud.includes('مزامنة البيانات الآن'));
  for (const forbidden of ['Cloudflare D1 (SQL)', 'bf2fbfa3', 'https://khodar-pos.pages.dev', 'استعادة البيانات التجريبية الأولية'])
    assert.ok(!cloud.includes(forbidden), `${platform} cloud screen exposes ${forbidden}`);
  const cloudShot = join(artifacts, `${platform}-cloud-verified.png`);
  await page.screenshot({ path: cloudShot, fullPage: true });
  await clickText(page, 'المالية والجرد والأرباح');
  await clickText(page, 'التقارير');
  await page.waitForSelector('#printable-a4-document img[alt="شعار براكه"]', { timeout: 15000 });
  await new Promise(resolve => setTimeout(resolve, 600));
  const report = await page.$eval('#printable-a4-document', node => ({ text: node.innerText, logoLoaded: node.querySelector('img[alt="شعار براكه"]')?.naturalWidth > 0 }));
  assert.ok(report.logoLoaded, `${platform} report logo did not load`);
  assert.ok(!report.text.includes('السوق المركزي للخضار والفواكه'), `${platform} report has legacy placeholder address`);
  const reportShot = join(artifacts, `${platform}-report-verified.png`);
  await page.screenshot({ path: reportShot, fullPage: true });
  const screens = await smokeScreens(page);
  assert.deepEqual(errors, [], `${platform} page errors`);
  return { platform, cloudShot, reportShot, reportLogoLoaded: report.logoLoaded, screensChecked: screens.length };
}

const chrome = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
let profile, electron, desktop;
try {
  const webPage = await chrome.newPage();
  await webPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  console.log(JSON.stringify(await inspect(webPage, 'web')));

  profile = await mkdtemp(join(tmpdir(), 'braka-ui-desktop-'));
  electron = spawn(join(process.cwd(), 'node_modules', 'electron', 'dist', 'electron.exe'),
    ['--remote-debugging-port=9341', `--user-data-dir=${profile}`, '.'],
    { cwd: process.cwd(), stdio: 'ignore', windowsHide: true });
  for (let attempt = 0; attempt < 100; attempt++) {
    try { desktop = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9341' }); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  assert.ok(desktop, 'Electron DevTools endpoint unavailable');
  const page = (await desktop.pages()).find(candidate => candidate.url().startsWith('file:'));
  assert.ok(page, 'Electron renderer not found');
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  console.log(JSON.stringify(await inspect(page, 'windows')));
} finally {
  if (desktop) await desktop.disconnect();
  if (electron) electron.kill();
  await chrome.close();
  if (profile && resolve(profile).startsWith(resolve(tmpdir()) + sep) &&
      basename(profile).startsWith('braka-ui-desktop-'))
    await rm(profile, { recursive: true, force: true });
}
