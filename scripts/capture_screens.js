import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUTPUT_DIR = path.join(__dirname, '..', 'guide-assets');

const screens = [
  { id: '01_home', tab: 'home', desc: 'الشاشة الرئيسية ولوحة المتابعة السريعة' },
  { id: '02_sale', tab: 'sale', desc: 'شاشة نقطة البيع والميزان والكاشير' },
  { id: '03_invoices', tab: 'invoices', desc: 'سجل الفواتير والمبيعات اليومية' },
  { id: '04_purchases', tab: 'purchases', desc: 'المشتريات وتوريد البضاعة ومردودات الموردين' },
  { id: '05_products', tab: 'products', desc: 'إدارة الأصناف والأسعار وتكاليف الكيلو' },
  { id: '06_customers', tab: 'customers', desc: 'حسابات العملاء والديون وسندات القبض' },
  { id: '07_damaged', tab: 'damaged', desc: 'سجل التوالف والهالك وإعدام البضاعة' },
  { id: '08_expenses', tab: 'expenses', desc: 'المصروفات اليومية والتشغيلية' },
  { id: '09_workers', tab: 'workers', desc: 'إدارة الموظفين والرواتب وسجل السلفيات' },
  { id: '10_audit', tab: 'audit', desc: 'الجرد والسيولة ومطابقة نقدية الدرج' },
  { id: '11_partners', tab: 'partners', desc: 'كشف حسابات الشركاء والمسحوبات وتوزيع الأرباح' },
  { id: '12_reports', tab: 'reports', desc: 'مركز التقارير المحاسبية الشاملة A4' },
];

async function captureAll() {
  console.log('Starting Puppeteer with Chrome at:', CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Mobile Viewport (iPhone / Modern Android phone)
  await page.setViewport({
    width: 412,
    height: 915,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2
  });

  for (const s of screens) {
    const url = `http://localhost:5173/?tab=${s.tab}`;
    console.log(`Navigating to ${s.id} (${url})...`);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1200));

    const outPath = path.join(OUTPUT_DIR, `${s.id}.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`Saved screenshot: ${s.id}.png`);
  }

  // Also capture Sales Return Tab in Invoices
  console.log('Capturing returns tab in invoices...');
  await page.goto('http://localhost:5173/?tab=invoices', { waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1000));
  // Click returns tab if found
  const returnsTabBtn = await page.$('button ::-p-text(سجل مردودات المبيعات)');
  if (returnsTabBtn) {
    await returnsTabBtn.click();
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: path.join(OUTPUT_DIR, '03_b_sales_returns.png') });
    console.log('Saved 03_b_sales_returns.png');
  }

  // Also capture Purchase Returns Tab in Purchases
  console.log('Capturing purchase returns tab in purchases...');
  await page.goto('http://localhost:5173/?tab=purchases', { waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1000));
  const purReturnsBtn = await page.$('button ::-p-text(سجل مردودات الموردين)');
  if (purReturnsBtn) {
    await purReturnsBtn.click();
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: path.join(OUTPUT_DIR, '04_b_purchase_returns.png') });
    console.log('Saved 04_b_purchase_returns.png');
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
}

captureAll().catch(err => {
  console.error('Error capturing screens:', err);
  process.exit(1);
});
