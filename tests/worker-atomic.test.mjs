import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { seedAggregate } from './aggregate-fixture.mjs';

const locks = globalThis.navigator.locks;
const storage = () => ({ values: new Map(), getItem(key) { return this.values.get(key) ?? null; },
  setItem(key, value) { this.values.set(key, String(value)); }, removeItem(key) { this.values.delete(key); },
  clear() { this.values.clear(); }, key(index) { return [...this.values.keys()][index] ?? null; }, get length() { return this.values.size; } });

test('absence and salary worker updates share one aggregate/outbox commit and roll back together', async () => {
  const sender = storage(), receiver = storage();
  globalThis.localStorage = sender; globalThis.sessionStorage = storage();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false, locks } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {}, removeEventListener() {}, location: { origin: 'https://test.invalid' } } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { addEventListener() {}, removeEventListener() {}, visibilityState: 'hidden' } });
  const seedWorker = target => seedAggregate(target, { id: 'u', tenantId: 'A' }, {
    workers_v3: [{ id: 'w', branchId: 'branch-main', name: 'Worker', medicalAbsenceDays: 0, unexcusedAbsenceDays: 0, currentAdvance: 0 }]
  });
  seedWorker(sender); seedWorker(receiver);
  const bundle = await build({ stdin: { contents: "export {useAppStore} from './src/store/useAppStore.js';export {cloudflareSync} from './src/services/cloudflareSync.js';export {setSessionToken,setSessionUser} from './src/services/authSession.js';", resolveDir: process.cwd() }, bundle: true, write: false, define: { 'import.meta.env': '{}' }, format: 'cjs', platform: 'node', packages: 'external' });
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const { useAppStore, cloudflareSync, setSessionToken, setSessionUser } = loaded.exports;
  let app, root;
  function Harness() { app = useAppStore(); return null; }
  try {
    setSessionToken('test-session');
    setSessionUser({ id: 'u', tenantId: 'A', role: 'cashier', branchId: 'branch-main', branchIds: ['branch-main'], isStaff: true, sessionExpiresAt: new Date(Date.now() + 60_000).toISOString() });
    await act(async () => { root = TestRenderer.create(React.createElement(Harness)); });
    const repo = cloudflareSync.repository;
    const before = JSON.stringify(repo.value), originalEnqueue = repo.enqueue;
    repo.enqueue = function (event) {
      if (event.entityType === 'worker_transaction') throw Error('Injected worker event failure');
      return originalEnqueue.call(this, event);
    };
    await act(async () => {
      assert.throws(() => app.recordWorkerTransactionWithUpdate('w', { medicalAbsenceDays: 2 },
        { workerId: 'w', type: 'absence_record', amount: 0, daysCount: 2 }, true), /Injected worker event failure/);
    });
    assert.equal(JSON.stringify(repo.value), before);
    repo.enqueue = originalEnqueue;
    let firstAbsence;
    await act(async () => {
      firstAbsence = app.recordWorkerTransactionWithUpdate('w', { medicalAbsenceDays: 2 },
        { workerId: 'w', type: 'absence_record', absenceType: 'medical', amount: 0, daysCount: 2 }, true);
    });
    assert.equal(app.workers.find(worker => worker.id === 'w').medicalAbsenceDays, 2);
    const absenceEvents = repo.value.outbox.filter(event => event.entityType === 'worker' || event.entityType === 'worker_transaction');
    assert.equal(absenceEvents.length, 2);
    assert.equal(new Set(absenceEvents.map(event => event.groupId)).size, 1);

    const beforeDelete = repo.value.outbox.length;
    await act(async () => { app.deleteWorkerTransaction(firstAbsence.id); });
    assert.equal(app.workers.find(worker => worker.id === 'w').medicalAbsenceDays, 0);
    const absenceReversal = structuredClone(repo.value.outbox.slice(beforeDelete));
    assert.deepEqual(new Set(absenceReversal.map(event => `${event.entityType}:${event.action}`)), new Set(['worker:update', 'worker_transaction:delete']));
    assert.equal(new Set(absenceReversal.map(event => event.groupId)).size, 1);
    const beforeSecondAbsence = repo.value.outbox.length;
    let secondAbsence;
    await act(async () => {
      secondAbsence = app.recordWorkerTransactionWithUpdate('w', { medicalAbsenceDays: 2 },
        { workerId: 'w', type: 'absence_record', absenceType: 'medical', amount: 0, daysCount: 2 }, true);
    });
    assert.notEqual(secondAbsence.id,firstAbsence.id,'rapid worker actions need distinct IDs');
    const secondAbsenceEvents = structuredClone(repo.value.outbox.slice(beforeSecondAbsence));

    const previousCount = repo.value.outbox.length;
    await act(async () => {
      app.recordWorkerTransactionWithUpdate('w', { medicalAbsenceDays: 0, unexcusedAbsenceDays: 0 },
        { workerId: 'w', type: 'salary_payment', amount: 100, workerName: 'Worker' });
    });
    const salaryEvents = repo.value.outbox.slice(previousCount);
    assert.deepEqual(new Set(salaryEvents.map(event => event.entityType)), new Set(['expense', 'worker_transaction', 'worker']));
    assert.equal(new Set(salaryEvents.map(event => event.groupId)).size, 1);
    assert.equal(app.workers.find(worker => worker.id === 'w').medicalAbsenceDays, 0);
    assert.equal(app.expenses.some(expense => expense.workerTransactionId === salaryEvents.find(event => event.entityType === 'worker_transaction').entityId), true);
    const afterSalary = JSON.stringify(repo.value);
    await act(async () => {
      assert.throws(() => app.deleteWorkerTransaction(secondAbsence.id), /لا يمكن حذف غياب تمت تسويته/);
    });
    assert.equal(JSON.stringify(repo.value), afterSalary);
    const inbound = structuredClone([...absenceEvents, ...absenceReversal, ...secondAbsenceEvents, ...salaryEvents]);
    await act(async () => { root.unmount(); });
    globalThis.localStorage = receiver;
    await act(async () => { root = TestRenderer.create(React.createElement(Harness)); });
    await act(async () => { cloudflareSync.updateHandler(inbound, inbound.length); });
    assert.equal(app.workerTransactions.length, 2);
    assert.equal(app.workers.find(worker => worker.id === 'w').medicalAbsenceDays, 0);
    assert.equal(app.expenses.some(expense => expense.workerTransactionId === salaryEvents.find(event => event.entityType === 'worker_transaction').entityId), true);
    const received = JSON.stringify(cloudflareSync.repository.value);
    await act(async () => { cloudflareSync.updateHandler(inbound, inbound.length); });
    assert.equal(JSON.stringify(cloudflareSync.repository.value), received,'replay cannot duplicate payroll effects');
  } finally {
    await act(async () => { root?.unmount(); });
    cloudflareSync.stopAutoSync();
    delete globalThis.window; delete globalThis.document;
  }
});
