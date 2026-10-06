// Read-only forensic summary from a disposable COPY of a Chromium profile.
// Never pass the live user-data directory: Chrome may upgrade its schema.
const puppeteer = require('puppeteer-core');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');

async function main() {
  const [profile, html] = process.argv.slice(2);
  if (!profile || !html) throw new Error('Usage: node inspect-durable-profile.cjs <profile-copy> <local-html>');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    userDataDir: resolve(profile), headless: true,
    args: ['--no-first-run', '--no-default-browser-check', '--disable-background-networking']
  });
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.url().startsWith('file:')) request.continue();
      else request.abort();
    });
    await page.goto(pathToFileURL(resolve(html)).href, { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async () => {
      const keys = Object.keys(localStorage).filter(key => key.endsWith('atomic_v1'));
      const summarize = value => value && ({
        revision: value.revision, cursor: value.cursor, outbox: value.outbox?.length,
        applied: Object.values(value.applied ?? {}).filter(Boolean).length,
        stateKeys: Object.keys(value.state ?? {}).length,
        stateLengths: Object.fromEntries(Object.entries(value.state ?? {}).filter(([, item]) => Array.isArray(item))
          .map(([key, item]) => [key, item.length]))
      });
      const databases = (await indexedDB.databases()).map(item => item.name);
      const results = [];
      for (const key of keys) {
        const cache = JSON.parse(localStorage.getItem(key));
        let durable = null;
        let migrationSource = null;
        if (databases.includes('braka_durable_aggregates_v1')) {
          const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('braka_durable_aggregates_v1');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          durable = await new Promise((resolve, reject) => {
            const transaction = db.transaction('aggregates', 'readonly');
            const request = transaction.objectStore('aggregates').get(key);
            request.onsuccess = () => resolve(request.result ?? null);
            request.onerror = () => reject(request.error);
          });
          migrationSource = await new Promise((resolve, reject) => {
            const transaction = db.transaction('aggregates', 'readonly');
            const request = transaction.objectStore('aggregates').get(`${key}:pre-durable-v1`);
            request.onsuccess = () => resolve(request.result ?? null);
            request.onerror = () => reject(request.error);
          });
          db.close();
        }
        const queue = JSON.parse(localStorage.getItem('khodar_offline_sync_queue') || '[]');
        const directKeys = ['khodar_pos_invoices_v3','khodar_pos_expenses_v3','khodar_pos_damaged_v3',
          'khodar_pos_worker_transactions_v3','khodar_pos_customer_payments_v3','khodar_pos_purchases_v3',
          'khodar_pos_supplier_payments_v3','khodar_pos_sales_returns_v3','khodar_pos_purchase_returns_v3',
          'khodar_pos_partner_drawings_v3','khodar_pos_profit_distributions_v3','khodar_pos_stock_transfers_v1'];
        const cacheOnlyDirectRecords = durable ? directKeys.reduce((count, name) => {
          const ids = new Set((durable.state?.[name] ?? []).map(row => row?.id));
          return count + (cache.state?.[name] ?? []).filter(row => !ids.has(row?.id)).length;
        }, 0) : null;
        results.push({ cache: summarize(cache), durable: summarize(durable), migrationSource: summarize(migrationSource),
          cacheOnlyDirectRecords,
          legacyQueueCount: queue.filter(event => event?.tenantId === cache.identity?.tenantId).length,
          legacyUnappliedQueueCount: queue.filter(event => event?.tenantId === cache.identity?.tenantId &&
            event?.userId === cache.identity?.id && cache.applied?.[event.id] !== true).length,
          sameState: durable ? JSON.stringify(cache.state) === JSON.stringify(durable.state) : null,
          sameOutbox: durable ? JSON.stringify(cache.outbox) === JSON.stringify(durable.outbox) : null,
          sameApplied: durable ? JSON.stringify(cache.applied) === JSON.stringify(durable.applied) : null,
          cacheAppliedSubset: durable ? Object.keys(cache.applied ?? {}).every(id =>
            cache.applied[id] !== true || durable.applied?.[id] === true) : null,
          changedStateKeys: durable ? Object.keys(cache.state ?? {}).filter(item =>
            JSON.stringify(cache.state[item]) !== JSON.stringify(durable.state?.[item])) : null });
      }
      return { databases, records: results };
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally { await browser.close(); }
}
main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
