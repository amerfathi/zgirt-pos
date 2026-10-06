import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleBackup } from '../src/services/backupScheduler.js';

test('failed acknowledgement retries the complete snapshot and only then reports saved', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const statuses = [], payloads = [];
  const snapshot = { version: 4, tenantId: 'A', purchases: [{ id: 'p' }] };
  const stop = scheduleBackup({ snapshot: () => snapshot, upload: async data => {
    payloads.push(data); return payloads.length > 1;
  }, onStatus: s => statuses.push(s), delay: 5, retryDelay: 30 });
  t.mock.timers.tick(5); await Promise.resolve();
  assert.equal(statuses.at(-1).status, 'retrying');
  t.mock.timers.tick(30); await Promise.resolve();
  assert.equal(statuses.at(-1).status, 'saved');
  assert.deepEqual(payloads, [snapshot, snapshot]);
  stop();
});

test('cleanup suppresses stale upload completion and retry after account change', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let rejectUpload; const statuses = [];
  const stop = scheduleBackup({ snapshot: () => ({}), upload: () => new Promise((_, reject) => { rejectUpload = reject; }), onStatus: s => statuses.push(s), delay: 5 });
  t.mock.timers.tick(5); stop(); rejectUpload(new Error('offline'));
  await Promise.resolve(); t.mock.timers.tick(60000);
  assert.deepEqual(statuses.map(s => s.status), ['pending','uploading']);
});

test('scheduler exposes pending, uploading and saved states in order', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const statuses=[];
  scheduleBackup({snapshot:()=>({}),upload:async()=>true,onStatus:s=>statuses.push(s),delay:5});
  assert.equal(statuses.at(-1).status,'pending');
  t.mock.timers.tick(5); await Promise.resolve();
  assert.deepEqual(statuses.map(s=>s.status),['pending','uploading','saved']);
});
