import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const profile = await mkdtemp(join(tmpdir(), 'braka-cache-recovery-'));
const server = spawn(process.execPath, [fileURLToPath(new URL('./browser-atomic-server.mjs', import.meta.url))],
  { stdio: ['ignore', 'pipe', 'pipe'] });
let url, output = '', browser;
server.stdout.on('data', chunk => {
  output += chunk.toString();
  const match = output.match(/Atomic harness: (http:\/\/127\.0\.0\.1:\d+)/);
  if (match) url = `${match[1]}/`;
});
server.stderr.on('data', chunk => { output += chunk.toString(); });
try {
  for (let attempt = 0; attempt < 60 && !url; attempt++) await new Promise(resolve => setTimeout(resolve, 100));
  assert.ok(url, output);
  browser = await puppeteer.launch({
    executablePath: process.env.BRAKA_CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true, userDataDir: profile, args: ['--no-first-run', '--no-default-browser-check']
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0' });
  const result = await page.evaluate(async () => {
    const { AtomicStore } = await import('/atomicStore.js');
    const { DurableAggregate } = await import('/durableAggregate.js');
    const { scopedStorageKey } = await import('/tenantStorage.js');
    const identity = { id: 'recovery-owner', tenantId: 'isolated-test' };
    const key = scopedStorageKey('atomic_v1', identity);
    const saved = { schema: 1, identity: { ...identity, syncScopeVersion: 0 }, revision: 0,
      state: { stock: 17 }, outbox: [], cursor: 2, applied: { a: true, b: true } };
    const cache = { ...structuredClone(saved), revision: 3, cursor: 1,
      state: { stock: 20 }, applied: { a: true } };
    const durable = new DurableAggregate(indexedDB, 'braka-cache-recovery-browser-test');
    await durable.commit(key, saved, null);
    const raw = JSON.stringify(cache);
    localStorage.setItem(key, raw);
    const store = new AtomicStore(identity, { stock: 0 }, localStorage, { durableFirst: true });
    let blocked = false;
    try { await store.acquire(navigator.locks, durable); }
    catch (error) { blocked = error.message.includes('نسخة محلية أحدث'); }
    const archiveKey = await store.archiveConflictingCache(durable);
    const archive = await durable.read(archiveKey);
    const cacheGone = localStorage.getItem(key) === null;
    await store.close();
    const reopened = new AtomicStore(identity, { stock: 0 }, localStorage, { durableFirst: true });
    const ready = await reopened.acquire(navigator.locks, durable);
    const stock = reopened.read('stock');
    await reopened.close();
    return { blocked, cacheGone, ready, stock, archivedExactly: archive?.raw === raw,
      durableUnchanged: (await durable.read(key))?.revision === 0 };
  });
  assert.deepEqual(result, { blocked: true, cacheGone: true, ready: true, stock: 17,
    archivedExactly: true, durableUnchanged: true });
} finally {
  await browser?.close();
  server.kill();
  await rm(profile, { recursive: true, force: true });
}
