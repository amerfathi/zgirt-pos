// One-page isolated A4 print probe. Run only by explicit request with BRAKA_ALLOW_PHYSICAL_PRINT=TEST_ONE_PAGE.
const { app, BrowserWindow } = require('electron');
const { buildSync } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

const printerName = 'HP557AB4 (HP LaserJet Pro M428f-M429f)';
if (process.env.BRAKA_ALLOW_PHYSICAL_PRINT !== 'TEST_ONE_PAGE') process.exit(2);

app.whenReady().then(async () => {
  let window;
  try {
    const bundle = buildSync({ entryPoints: ['src/components/A4InvoiceModal.jsx'], bundle: true,
      write: false, format: 'cjs', platform: 'node', define: { 'import.meta.env': '{}' },
      loader: { '.png': 'dataurl' }, external: ['react', 'react-dom'] });
    const bundled = { exports: {} };
    new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(require, bundled, bundled.exports);
    const invoice = { id: 'PRINT-TEST-ONLY', invoiceNumber: 'PRINT-TEST-ONLY', date: '2026-10-01', time: '12:00',
      customerName: 'اختبار طباعة فقط — لا يُقيد ماليًا', saleType: 'cash', paymentMethod: 'cash',
      weightMode: 'net_after_tare', items: [{ name: 'صنف تجريبي', unit: 'كجم', packageCount: 1,
        grossWeight: 1, totalTareWeight: 0, netWeight: 1, pricePerKg: 1, total: 1 }],
      totalPackages: 1, totalGrossWeight: 1, totalTareWeight: 0, totalNetWeight: 1,
      subtotal: 1, discountAmount: 0, finalTotal: 1, paidAmount: 1, changeAmount: 0, remainingDebt: 0,
      notes: 'اختبار للطابعة فقط — هذه ليست فاتورة بيع حقيقية.' };
    const settings = { shopName: 'براكه — طباعة تجريبية', subTitle: 'اختبار محلي',
      address: 'السوق المركزي للخضار والفواكه', phone: '', currency: 'ريال' };
    const markup = renderToStaticMarkup(React.createElement(bundled.exports.default,
      { isOpen: true, onClose() {}, invoice, settings }));
    const cssName = readdirSync('dist/assets').find(name => name.endsWith('.css'));
    const css = readFileSync(join('dist/assets', cssName), 'utf8');
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${css}</style></head><body>${markup}</body></html>`;
    window = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, sandbox: true } });
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const check = await window.webContents.executeJavaScript(`({loaded:document.querySelector('#printable-a4-document img[alt="شعار براكه"]')?.complete,
      text:document.querySelector('#printable-a4-document')?.innerText})`);
    if (!check.loaded || check.text.includes('السوق المركزي للخضار والفواكه'))
      throw new Error('Invoice branding or legacy-address check failed before printing');
    const printers = await window.webContents.getPrintersAsync();
    const printer = printers.find(item => item.name === printerName);
    if (!printer) throw new Error(`Physical A4 printer unavailable; found ${printers.map(item => item.name).join(', ')}`);
    await new Promise((resolve, reject) => window.webContents.print({ silent: true, deviceName: printer.name,
      printBackground: true, pageSize: 'A4', margins: { marginType: 'default' }, copies: 1 },
      (success, reason) => success ? resolve(undefined) : reject(new Error(`Print submission failed: ${reason}`))));
    console.log(JSON.stringify({ submitted: true, printer: printer.name, invoice: invoice.invoiceNumber }));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    window?.destroy();
    app.quit();
  }
});
