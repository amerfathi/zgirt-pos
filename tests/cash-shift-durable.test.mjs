import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AtomicStore } from '../src/services/atomicStore.js';
import * as ledger from '../src/services/cashShiftLedger.js';

const user = { id:'cashier-1', tenantId:'tenant-cash' };
const storage = () => ({ rows:new Map(), getItem(key) { return this.rows.get(key) ?? null; },
  setItem(key,value) { this.rows.set(key,String(value)); }, removeItem(key) { this.rows.delete(key); } });
const locks = { async request(_key,_options,fn) { return fn({}); }, async query() { return { held:[], pending:[] }; } };
const memory = () => ({ rows:new Map(), fail:false,
  async read(key) { return structuredClone(this.rows.get(key) ?? null); },
  async commit(key,value,expectedRevision) {
    if (this.fail) throw new Error('Injected durable commit failure');
    const old=this.rows.get(key);
    if ((old?.revision ?? null) !== expectedRevision) throw new Error('Revision conflict');
    this.rows.set(key,structuredClone(value));return structuredClone(value);
  } });
const openInput = (id,at,actorId='cashier-1') => ({ id,tenantId:user.tenantId,branchId:'branch-1',drawerId:'drawer-1',actorId,
  offlineDeviceId:'pc-1',openingCash:100,at,timeZone:'Asia/Riyadh' });
const start = async (disk,cache) => { const store=new AtomicStore(user,{},cache,{durableFirst:true});
  assert.equal(await store.acquire(locks,disk),true);return store; };

test('offline close and the next shift survive reopen in one durable aggregate and ordered outbox', async () => {
  assert.equal(typeof ledger.commitCashShiftDurable,'function');
  const disk=memory(),cache=storage();let store=await start(disk,cache);
  await ledger.commitCashShiftDurable(store,'open',openInput('shift-1','2026-10-01T18:00:00Z'));
  await ledger.commitCashShiftDurable(store,'cash',{shiftId:'shift-1',id:'sale-1',actorId:'cashier-1',deviceId:'pc-1',amount:27,at:'2026-10-01T18:05:00Z',online:false});
  await ledger.commitCashShiftDurable(store,'close',{shiftId:'shift-1',actorId:'cashier-1',deviceId:'pc-1',countedCash:127,at:'2026-10-01T20:00:00Z'});
  await ledger.commitCashShiftDurable(store,'open',openInput('shift-2','2026-10-01T20:01:00Z'));
  const before=structuredClone(store.value);await store.close();
  store=await start(disk,cache);
  assert.deepEqual(store.value,before);
  assert.equal(store.value.state.khodar_pos_cash_shifts_v1[0].status,'closed_local');
  assert.equal(store.value.state.khodar_pos_cash_shifts_v1[1].status,'open');
  assert.deepEqual(store.value.outbox.map(event=>event.action),['create','update','update','create']);
  await store.close();
});

test('another cashier cannot create a shift inside the first cashier scoped ledger', async () => {
  const disk=memory(),cache=storage(),store=await start(disk,cache);
  await ledger.commitCashShiftDurable(store,'open',openInput('shift-1','2026-10-01T18:00:00Z'));
  await ledger.commitCashShiftDurable(store,'close',{shiftId:'shift-1',actorId:'cashier-1',deviceId:'pc-1',countedCash:100,at:'2026-10-01T18:30:00Z'});
  const before=structuredClone(store.value);
  await assert.rejects(ledger.commitCashShiftDurable(store,'open',openInput('shift-2','2026-10-01T19:00:00Z','cashier-2')),/هوية المحاسب/);
  assert.deepEqual(store.value,before);
  await store.close();
});

test('failed durable close leaves shift open and pending events unchanged', async () => {
  assert.equal(typeof ledger.commitCashShiftDurable,'function');
  const disk=memory(),cache=storage(),store=await start(disk,cache);
  await ledger.commitCashShiftDurable(store,'open',openInput('shift-1','2026-10-01T18:00:00Z'));
  const before=structuredClone(store.value);disk.fail=true;
  await assert.rejects(ledger.commitCashShiftDurable(store,'close',{shiftId:'shift-1',actorId:'cashier-1',deviceId:'pc-1',countedCash:100,at:'2026-10-01T20:00:00Z'}),/Injected durable commit failure/);
  assert.deepEqual(store.value,before);
  assert.deepEqual(disk.rows.get(store.key),before);
  await store.close();
});
