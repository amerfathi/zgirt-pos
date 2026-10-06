import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const chrome = process.env.BRAKA_CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let url;
const profile = await mkdtemp(join(tmpdir(), 'braka-atomic-browser-'));
const server = spawn(process.execPath, [fileURLToPath(new URL('./browser-atomic-server.mjs', import.meta.url))], { stdio: ['ignore', 'pipe', 'pipe'] });
let serverOutput = '';
server.stdout.on('data', chunk => {
  serverOutput += chunk.toString();
  const match = serverOutput.match(/Atomic harness: (http:\/\/127\.0\.0\.1:\d+)/);
  if (match) url = `${match[1]}/`;
});
server.stderr.on('data', chunk => { serverOutput += chunk.toString(); });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (server.exitCode !== null) throw new Error(`Atomic harness exited: ${server.exitCode}; ${serverOutput}`);
    try { if (url) { const response = await fetch(url); if (response.ok) { ready = true; break; } } } catch { /* server starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, 'local atomic harness must start');
  const launch = () => puppeteer.launch({ executablePath: chrome, headless: true, userDataDir: profile, args: ['--no-first-run', '--no-default-browser-check'] });
  browser = await launch();
  const first = await browser.newPage();
  const pageErrors = [];
  first.on('pageerror', error => pageErrors.push(error.message));
  await first.goto(url, { waitUntil: 'networkidle0' });
  try { await first.waitForFunction(() => window.ready !== undefined); }
  catch (error) { throw new Error(`Atomic page did not initialize: ${pageErrors.join('; ') || error.message}`, {cause:error}); }
  assert.match(await first.$eval('body', node => node.innerText), /Isolated atomic storage verification/);
  assert.equal(await first.$('.vite-error-overlay'), null);
  assert.deepEqual(pageErrors, [], 'browser page must render without runtime errors');
  assert.equal(await first.evaluate(() => window.ready), true);
  await first.click('#fail');
  let state = await first.evaluate(() => window.store.value);
  assert.equal(state.state.stock, 20);
  assert.equal(state.outbox.length, 0);
  await first.click('#commit');
  state = await first.evaluate(() => window.store.value);
  assert.deepEqual({invoices:state.state.invoices,stock:state.state.stock,debt:state.state.debt}, { invoices: [{ id: 'sale' }], stock: 17, debt: 15 });
  assert.equal(state.state.khodar_pos_sync_heads_v1['domain:inventory'],'browser-event');
  assert.equal(state.outbox.length, 1);
  const storedBeforeCrash = await first.evaluate(() => JSON.parse(localStorage.getItem(window.store.key)));
  assert.deepEqual(storedBeforeCrash.state, state.state, 'browser Storage API must expose committed state before process stop');
  const idbProbe = process.argv.includes('--idb-probe');
  const engineProbe = process.argv.includes('--idb-engine');
  const migrateProbe = process.argv.includes('--idb-migrate');
  const reviewedProbe = process.argv.includes('--review-checkpoint');
  const migratedSnapshot = migrateProbe ? await first.evaluate(async () => {
    const { DurableAggregate } = await import('/durableAggregate.js');
    const repository = new DurableAggregate(indexedDB, 'braka-migration-probe');
    const source = await window.store.adoptExistingAggregate(repository);
    try { await repository.adoptIfEmpty(window.store.key, source); throw Error('duplicate adoption unexpectedly accepted'); }
    catch (error) { if (!error.message.includes('سجل دائم موجود')) throw error; }
    const conflictKey = `${window.store.key}:archive-conflict-fixture`;
    const db = await repository.open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('aggregates', 'readwrite', { durability: 'strict' });
      tx.objectStore('aggregates').put(source, `${conflictKey}:pre-durable-v1`);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    let archiveConflictRejected = false;
    try { await repository.adoptIfEmpty(conflictKey, source); }
    catch { archiveConflictRejected = true; }
    if (!archiveConflictRejected || await repository.read(conflictKey) !== null)
      throw Error('archive conflict did not roll back the live migration record');
    await window.store.transactDurable(() => window.store.set('debt', 14));
    const archived = await repository.readMigrationSource(window.store.key);
    if (JSON.stringify(archived) !== JSON.stringify(source)) throw Error('migration source changed after durable business update');
    let archiveWriteRejected = false;
    try { await repository.commit(`${window.store.key}:pre-durable-v1`, { ...source, revision: source.revision + 1 }, source.revision); }
    catch { archiveWriteRejected = true; }
    if (!archiveWriteRejected) throw Error('migration archive accepted a later commit');
    return { source, live: structuredClone(window.store.value) };
  }) : null;
  const strictSnapshot = idbProbe ? await first.evaluate(async snapshot => {
    const { DurableAggregate } = await import('/durableAggregate.js');
    const durable = new DurableAggregate(indexedDB, 'braka-strict-probe');
    const candidate = { ...snapshot, revision: 0 };
    await durable.commit('current', candidate, null);
    try { await durable.commit('current', candidate, null); throw Error('stale commit unexpectedly accepted'); }
    catch (error) { if (!error.message.includes('تغير السجل الدائم')) throw error; }
    const first = { ...candidate, revision: 1, state: { ...candidate.state, stock: 16 } };
    const second = { ...candidate, revision: 1, state: { ...candidate.state, stock: 18 } };
    const races = await Promise.allSettled([durable.commit('current', first, 0), durable.commit('current', second, 0)]);
    if (races.filter(result => result.status === 'fulfilled').length !== 1 ||
        races.filter(result => result.status === 'rejected').length !== 1) throw Error('concurrent compare-and-commit was not exclusive');
    const final = await durable.read('current');
    if (typeof durable.commitBatch !== 'function') throw Error('Durable multi-record commit is unavailable');
    const left = { revision: 0, state: { invoice: 'sale-1' } };
    const right = { revision: 0, state: { drawerSequence: 1 } };
    await durable.commitBatch([
      { key: 'cashier-ledger', snapshot: left, expectedRevision: null },
      { key: 'drawer-journal', snapshot: right, expectedRevision: null }
    ]);
    try {
      await durable.commitBatch([
        { key: 'cashier-ledger', snapshot: { revision: 1, state: { invoice: 'sale-2' } }, expectedRevision: 0 },
        { key: 'drawer-journal', snapshot: { revision: 100, state: { drawerSequence: 2 } }, expectedRevision: 99 }
      ]);
      throw Error('stale drawer journal unexpectedly accepted');
    } catch (error) { if (!error.message.includes('تغير السجل الدائم')) throw error; }
    if ((await durable.read('cashier-ledger')).revision !== 0 || (await durable.read('drawer-journal')).revision !== 0)
      throw Error('a failed paired commit partially changed durable state');
    await durable.commitBatch([
      { key: 'cashier-ledger', snapshot: { revision: 1, state: { invoice: 'sale-2' } }, expectedRevision: 0 },
      { key: 'drawer-journal', snapshot: { revision: 1, state: { drawerSequence: 2 } }, expectedRevision: 0 }
    ]);
    const pair = [await durable.read('cashier-ledger'), await durable.read('drawer-journal')];
    const {replayDrawerJournal}=await import('/cashDrawerJournal.js');
    const scope={tenantId:'isolated-test',branchId:'main',drawerId:'drawer',deviceId:'isolated-device'};
    const journalKey='braka:isolated-test:main:drawer:isolated-device:cash_drawer_journal_v1';
    const sources=[{source:{id:'previous-cashier-source',tenantId:scope.tenantId,branchId:scope.branchId},grant:{},signature:'isolated-contract-fixture'}];
    await durable.commit(journalKey,{revision:0,...scope,shifts:[],sources},null);
    if(!await replayDrawerJournal(durable,navigator.locks,scope,async()=>({success:true,acceptedIds:['previous-cashier-source']})))
      throw Error('Journal-only replay was not acknowledged');
    const journal=await durable.read(journalKey);
    if(journal.revision!==1||JSON.stringify(journal.acceptedIds)!==JSON.stringify(['previous-cashier-source']))
      throw Error('Journal-only acknowledgement did not commit to real IndexedDB');
    durable.close();
    return { final, pair, journal };
  }, state) : null;
  const engineSnapshot = engineProbe ? await first.evaluate(async () => {
    const { AtomicStore } = await import('/atomicStore.js');
    const { DurableAggregate } = await import('/durableAggregate.js');
    const identity = { id: 'durable-fixture', tenantId: 'isolated-test' };
    const repository = new DurableAggregate(indexedDB, 'braka-engine-probe');
    const store = new AtomicStore(identity, { invoices: [], stock: 20, debt: 0 });
    if (!await store.acquire(undefined, repository)) throw Error('durable writer lock unavailable');
    await store.transactDurable(() => {
      store.set('invoices', [{ id: 'durable-sale' }]);
      store.set('stock', 17);
      store.set('debt', 15);
      store.enqueue({ id: 'durable-event', tenantId: identity.tenantId, entityType: 'invoice', entityId: 'durable-sale', action: 'create', payload: { id: 'durable-sale' } });
    });
    const committed = structuredClone(store.value);
    try {
      await store.transactDurable(() => store.set('stock', -999), { commit: async () => { throw Error('Injected database abort'); } });
      throw Error('failed durable write reported success');
    } catch (error) { if (!error.message.includes('Injected database abort')) throw error; }
    if (JSON.stringify(store.value) !== JSON.stringify(committed)) throw Error('failed durable write changed visible state');
    await store.acknowledgeDurable(new Set(['durable-event']));
    const inbound = { id: 'inbound-receipt', tenantId: identity.tenantId };
    await store.receiveDurable([inbound], 5, () => store.set('debt', 13));
    await store.receiveDurable([inbound], 5, () => { throw Error('inbound replay applied twice'); });
    await store.transactDurable(() => {
      store.enqueue({ id: 'pending-event', tenantId: identity.tenantId, entityType: 'invoice', entityId: 'next-sale', action: 'create', payload: { id: 'next-sale' } });
    });
    if (store.value.cursor !== 5 || store.value.state.debt !== 13 || store.value.outbox.map(event => event.id).join() !== 'pending-event')
      throw Error('durable sync aggregate not coherent before process stop');
    return structuredClone(store.value);
  }) : null;
  const reviewedSnapshot=reviewedProbe?await first.evaluate(async()=>{
    const {AtomicStore}=await import('/atomicStore.js');
    const {DurableAggregate}=await import('/durableAggregate.js');
    const {replayReviewedLedger}=await import('/reviewLedgerReplay.js');
    const identity={id:'reviewed-browser',tenantId:'reviewed-browser-tenant',branchIds:['main']};
    const branch={id:'main',tenantId:identity.tenantId,name:'Main'};
    const repository=new DurableAggregate(indexedDB,'braka-reviewed-probe');
    const store=new AtomicStore(identity,{khodar_pos_branches_v1:[branch],khodar_pos_active_branch_id_v1:'main'});
    if(!await store.acquire(undefined,repository))throw Error('Reviewed writer unavailable');
    await store.transactDurable(()=>store.enqueue({id:'reviewed-pending',tenantId:identity.tenantId,branchId:'main',entityType:'expense',entityId:'pending',action:'create',payload:{id:'pending',branchId:'main',amount:8}}));
    const queue=structuredClone(store.current.outbox);
    const accepted={id:'reviewed-accepted',tenantId:identity.tenantId,branchId:'main',entityType:'expense',entityId:'accepted',action:'create',sequence:10,payload:{id:'accepted',branchId:'main',amount:3,paymentMethod:'cash'}};
    await store.installReviewedResolution({protocol:'owner-reviewed-checkpoint-v2',tenantId:identity.tenantId,completeHistory:false,validatedThroughCursor:2201,nextCursor:2201,
      history:[],checkpoint:replayReviewedLedger([accepted],identity.tenantId,{branches:[branch]}),queue,branches:[branch],conflictHeads:{},
      receipts:[{reviewId:'reviewed-browser-decision',tenantId:identity.tenantId,choice:'server',events:queue,acceptedEventIds:[]}]});
    return structuredClone(store.value);
  }):null;
  const second = await browser.newPage();
  await second.goto(url, { waitUntil: 'networkidle0' });
  await second.waitForFunction(() => window.ready !== undefined);
  assert.equal(await second.evaluate(() => window.ready), false, 'concurrent tab cannot own writer lock');
  assert.match(await second.evaluate(() => { try { window.store.transact(() => window.store.set('stock', 0)); return 'wrote'; } catch (error) { return error.message; } }), /الحفظ غير متاح/);
  assert.equal(await first.evaluate(() => window.store.value.outbox.length), 1);
  let deviceIdentity=null;
  if(idbProbe) {
    const results=await Promise.all([first,second].map(page=>page.evaluate(async()=>{
      const {OfflineGrantStore,indexedDbBackend}=await import('/offlineGrantStore.js');
      const {ensureOfflineDeviceIdentity}=await import('/offlineDeviceIdentity.js');
      return Promise.all(Array.from({length:8},()=>ensureOfflineDeviceIdentity(
        new OfflineGrantStore(indexedDbBackend(indexedDB,'braka-device-identity-probe')))));
    })));
    const identities=results.flat();
    assert.equal(new Set(identities.map(row=>row.deviceId)).size,1,'two tabs must enroll exactly one physical device');
    assert.equal(new Set(identities.map(row=>row.deviceProof)).size,1,'all enrollments must retain the same possession proof');
    deviceIdentity=identities[0];
  }
  const abrupt = process.argv.includes('--crash') || idbProbe || engineProbe || migrateProbe || reviewedProbe;
  if (abrupt) {
    const chromeProcess = browser.process();
    const crashDelay = Number(process.env.BRAKA_CRASH_DELAY_MS || 0);
    if (crashDelay > 0) await new Promise(resolve => setTimeout(resolve, crashDelay));
    const stopped = new Promise(resolve => chromeProcess.once('exit', resolve));
    chromeProcess.kill('SIGKILL');
    await stopped;
  } else await browser.close();
  browser = null;
  browser = await launch();
  const reopened = await browser.newPage();
  await reopened.goto(url, { waitUntil: 'networkidle0' });
  await reopened.waitForFunction(() => window.ready !== undefined);
  assert.equal(await reopened.evaluate(() => window.ready), true);
  if(reviewedProbe){
    const result=await reopened.evaluate(async()=>{
      const {AtomicStore}=await import('/atomicStore.js');
      const {DurableAggregate}=await import('/durableAggregate.js');
      const identity={id:'reviewed-browser',tenantId:'reviewed-browser-tenant',branchIds:['main']};
      const repository=new DurableAggregate(indexedDB,'braka-reviewed-probe');
      const store=new AtomicStore(identity,{},localStorage,{durableFirst:true});
      if(!await store.acquire(undefined,repository))throw Error('Reviewed writer unavailable after restart');
      const before=structuredClone(store.value);
      const old={id:'reviewed-accepted',tenantId:identity.tenantId,sequence:10};
      const fresh={id:'reviewed-new',tenantId:identity.tenantId,sequence:2202};
      let applies=0;
      await store.receiveDurable([old,fresh],2202,events=>{applies+=events.length;},{},true);
      await store.receiveDurable([old,fresh],2202,()=>{throw Error('Reviewed source duplicated');},{},true);
      const after=structuredClone(store.value);await store.close();repository.close();
      return {before,after,applies};
    });
    assert.deepEqual(result.before,reviewedSnapshot);
    assert.equal(result.applies,1);assert.equal(result.after.state.braka_reviewed_cursor_fence_v1,2201);
    assert.equal(result.after.state.braka_review_recovery_archive_v1[0].original.outbox[0].id,'reviewed-pending');
    console.log('Chrome reviewed checkpoint, original archive and cursor fence survived process termination; covered sources did not replay and the new source applied once.');
  }
  if(idbProbe) {
    const identityAfterRestart=await reopened.evaluate(async()=>{
      const {OfflineGrantStore,indexedDbBackend}=await import('/offlineGrantStore.js');
      const {ensureOfflineDeviceIdentity}=await import('/offlineDeviceIdentity.js');
      return ensureOfflineDeviceIdentity(new OfflineGrantStore(indexedDbBackend(indexedDB,'braka-device-identity-probe')));
    });
    assert.deepEqual(identityAfterRestart,deviceIdentity,'process termination cannot rotate the enrolled device identity');
  }
  const recovered = await reopened.evaluate(() => window.store.value);
  if (migrateProbe) {
    const recoveredMigration = await reopened.evaluate(async () => {
      await window.store.close();
      const { AtomicStore } = await import('/atomicStore.js');
      const { DurableAggregate } = await import('/durableAggregate.js');
      const identity = { id: 'browser-fixture', tenantId: 'isolated-test' };
      const repository = new DurableAggregate(indexedDB, 'braka-migration-probe');
      const store = new AtomicStore(identity, { invoices: [], stock: 20, debt: 0 });
      if (!await store.acquire(undefined, repository)) throw Error('migrated writer lock unavailable');
      const result = { source: await repository.readMigrationSource(store.key), live: structuredClone(store.value) };
      await store.close(); repository.close();
      return result;
    });
    assert.deepEqual(recoveredMigration, migratedSnapshot);
    assert.equal(recoveredMigration.source.state.debt, 15);
    assert.equal(recoveredMigration.live.state.debt, 14);
    console.log('Chrome existing aggregate adoption preserved an immutable pre-migration source and the updated live record after immediate process termination.');
  } else if (engineProbe) {
    const recoveredEngine = await reopened.evaluate(async () => {
      const { AtomicStore } = await import('/atomicStore.js');
      const { DurableAggregate } = await import('/durableAggregate.js');
      const { scopedStorageKey } = await import('/tenantStorage.js');
      const identity = { id: 'durable-fixture', tenantId: 'isolated-test' };
      const repository = new DurableAggregate(indexedDB, 'braka-engine-probe');
      localStorage.setItem(scopedStorageKey('atomic_v1', identity), '{corrupt-cache');
      const store = new AtomicStore(identity, { invoices: [], stock: 20, debt: 0 }, localStorage, { durableFirst: true });
      if (!await store.acquire(undefined, repository)) throw Error('durable writer lock unavailable after restart');
      const result = structuredClone(store.value);
      await store.close(); repository.close();
      return result;
    });
    assert.deepEqual(recoveredEngine, engineSnapshot);
    console.log('Chrome durable aggregate engine survived immediate process termination with business state, pending outbox, acknowledgement, replay marker and cursor; failed write and corrupt local cache did not displace authority.');
  } else if (idbProbe) {
    const durable = await reopened.evaluate(async () => {
      const { DurableAggregate } = await import('/durableAggregate.js');
      const repository = new DurableAggregate(indexedDB, 'braka-strict-probe');
      const snapshot = { final: await repository.read('current'), pair: [
        await repository.read('cashier-ledger'), await repository.read('drawer-journal')],
        journal:await repository.read('braka:isolated-test:main:drawer:isolated-device:cash_drawer_journal_v1') };
      repository.close();
      return snapshot;
    });
    assert.deepEqual(durable, strictSnapshot, 'strict transaction and concurrent winner must survive process termination');
    assert.deepEqual(durable.final.outbox.map(event => event.id), ['browser-event']);
    assert.deepEqual(durable.pair.map(row => row.revision), [1,1]);
    console.log('Chrome strict IndexedDB single and paired commits survived process termination.');
  } else {
    assert.deepEqual({invoices:recovered.state.invoices,stock:recovered.state.stock,debt:recovered.state.debt}, { invoices: [{ id: 'sale' }], stock: 17, debt: 15 });
    assert.equal(recovered.state.khodar_pos_sync_heads_v1['domain:inventory'],'browser-event');
    assert.deepEqual(recovered.outbox.map(event => event.id), ['browser-event']);
    assert.equal(recovered.cursor, 0);
    console.log(abrupt ? 'Chrome abrupt-stop verification passed.' : 'Chrome graceful restart/concurrent-window verification passed.');
  }
} finally {
  await browser?.close();
  server.kill();
  const actualProfile = await realpath(profile);
  const actualTemp = await realpath(tmpdir());
  if (actualProfile.startsWith(actualTemp + sep) && actualProfile !== actualTemp) await rm(actualProfile, { recursive: true, force: true });
}
