import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openShift, postCashEvent, closeShift, accountingDate } from '../src/services/cashShiftEngine.js';

const base = { tenantId:'tenant-a', branchId:'branch-a', drawerId:'drawer-1' };
const opened = () => openShift([], { ...base, id:'shift-1', actorId:'cashier-1', offlineDeviceId:'pc-1', openingCash:100, at:'2026-10-01T18:00:00.000Z', timeZone:'Asia/Riyadh' });

test('one open shift per drawer, while another drawer may open', () => {
  const first = opened();
  assert.throws(() => openShift(first, { ...base, id:'shift-2', actorId:'cashier-2', offlineDeviceId:'pc-2', openingCash:0, at:'2026-10-01T19:00:00.000Z', timeZone:'Asia/Riyadh' }), /درج.*مفتوحة/);
  assert.equal(openShift(first, { ...base, drawerId:'drawer-2', id:'shift-2', actorId:'cashier-2', offlineDeviceId:'pc-2', openingCash:0, at:'2026-10-01T19:00:00.000Z', timeZone:'Asia/Riyadh' }).length, 2);
});

test('two online devices may post to one shift, but offline cash belongs to its designated device', () => {
  const first = opened();
  const one = postCashEvent(first, { shiftId:'shift-1', id:'event-1', actorId:'cashier-1', deviceId:'pc-1', amount:20, at:'2026-10-01T18:05:00.000Z', online:false });
  const two = postCashEvent(one, { shiftId:'shift-1', id:'event-2', actorId:'cashier-1', deviceId:'pc-2', amount:-5, at:'2026-10-01T18:06:00.000Z', online:true });
  assert.equal(two[0].events.length, 2);
  assert.throws(() => postCashEvent(two, { shiftId:'shift-1', id:'event-3', actorId:'cashier-1', deviceId:'pc-2', amount:2, at:'2026-10-01T18:07:00.000Z', online:false }), /جهاز.*دون اتصال/);
  assert.throws(() => postCashEvent(two, { shiftId:'shift-1', id:'event-2', actorId:'cashier-1', deviceId:'pc-2', amount:2, at:'2026-10-01T18:07:00.000Z', online:true }), /مكرر/);
});

test('late close keeps event accounting date and records actual close date and variance', () => {
  const first = opened();
  const withCash = postCashEvent(first, { shiftId:'shift-1', id:'event-1', actorId:'cashier-1', deviceId:'pc-1', amount:20, at:'2026-10-01T20:50:00.000Z', online:true });
  assert.equal(withCash[0].events[0].accountingDate, '2026-10-01');
  const closed = closeShift(withCash, { shiftId:'shift-1', actorId:'cashier-1', countedCash:118, at:'2026-10-02T05:00:00.000Z', pendingEventCount:0 });
  assert.equal(closed[0].accountingDate, '2026-10-01');
  assert.equal(closed[0].closedAt, '2026-10-02T05:00:00.000Z');
  assert.equal(closed[0].expectedCash, 120);
  assert.equal(closed[0].variance, -2);
  assert.equal(accountingDate('2026-10-01T21:30:00.000Z', 'Asia/Riyadh'), '2026-10-02');
});

test('pending operations and double close prevent handover', () => {
  const first = opened();
  assert.throws(() => closeShift(first, { shiftId:'shift-1', actorId:'cashier-1', countedCash:100, at:'2026-10-01T20:00:00.000Z', pendingEventCount:1 }), /معلقة/);
  const closed = closeShift(first, { shiftId:'shift-1', actorId:'cashier-1', countedCash:100, at:'2026-10-01T20:00:00.000Z', pendingEventCount:0 });
  assert.throws(() => closeShift(closed, { shiftId:'shift-1', actorId:'cashier-1', countedCash:100, at:'2026-10-01T20:00:00.000Z', pendingEventCount:0 }), /مقفلة/);
  assert.equal(openShift(closed, { ...base, id:'shift-2', actorId:'cashier-2', offlineDeviceId:'pc-2', openingCash:100, at:'2026-10-01T20:01:00.000Z', timeZone:'Asia/Riyadh' }).length, 2);
});

test('offline close permits the next shift on the designated device while retaining pending reconciliation', () => {
  const withCash = postCashEvent(opened(), { shiftId:'shift-1', id:'offline-sale', actorId:'cashier-1', deviceId:'pc-1', amount:27, at:'2026-10-01T18:10:00.000Z', online:false });
  const closed = closeShift(withCash, { shiftId:'shift-1', actorId:'cashier-1', deviceId:'pc-1', countedCash:127, at:'2026-10-01T20:00:00.000Z', pendingEventCount:1, mode:'local' });
  assert.equal(closed[0].status, 'closed_local');
  assert.equal(closed[0].pendingEventCountAtClose, 1);
  assert.equal(closed[0].expectedCash, 127);
  assert.throws(() => closeShift(withCash, { shiftId:'shift-1', actorId:'cashier-1', deviceId:'pc-2', countedCash:127, at:'2026-10-01T20:00:00.000Z', pendingEventCount:1, mode:'local' }), /جهاز/);
  const next = openShift(closed, { ...base, id:'shift-2', actorId:'cashier-2', offlineDeviceId:'pc-1', openingCash:127, at:'2026-10-01T20:01:00.000Z', timeZone:'Asia/Riyadh' });
  assert.equal(next.length, 2);
  assert.equal(next[0].events[0].id, 'offline-sale');
  assert.equal(next[1].status, 'open');
});

test('overdue drawer cannot take next-day cash, while another drawer can', () => {
  const first = opened();
  assert.throws(() => postCashEvent(first, { shiftId:'shift-1', id:'next-day', actorId:'cashier-1', deviceId:'pc-1', amount:10, at:'2026-10-01T21:01:00.000Z', online:true }), /انتهى اليوم المحاسبي/);
  assert.throws(() => postCashEvent(first, { shiftId:'shift-1', id:'before-open', actorId:'cashier-1', deviceId:'pc-1', amount:10, at:'2026-10-01T17:00:00.000Z', online:true }), /قبل فتح الوردية/);
  const second = openShift(first, { ...base, drawerId:'drawer-2', id:'shift-2', actorId:'cashier-2', offlineDeviceId:'pc-2', openingCash:50, at:'2026-10-01T21:01:00.000Z', timeZone:'Asia/Riyadh' });
  assert.equal(postCashEvent(second, { shiftId:'shift-2', id:'other-drawer', actorId:'cashier-2', deviceId:'pc-2', amount:10, at:'2026-10-01T21:02:00.000Z', online:true })[1].events.length, 1);
});

test('another cashier cannot post or close the first cashier shift before handover', () => {
  const first=opened();
  assert.throws(()=>postCashEvent(first,{shiftId:'shift-1',id:'foreign-post',actorId:'cashier-2',deviceId:'pc-1',
    amount:10,at:'2026-10-01T18:10:00.000Z',online:true}),/المحاسب|تخص/);
  assert.throws(()=>closeShift(first,{shiftId:'shift-1',actorId:'cashier-2',deviceId:'pc-1',
    countedCash:100,at:'2026-10-01T19:00:00.000Z',pendingEventCount:0,mode:'local'}),/المحاسب|تخص/);
  assert.equal(first[0].status,'open');
  assert.equal(first[0].events.length,0);
});
