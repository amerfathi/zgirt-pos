import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateInTimeZone, setBusinessTimeZone, getBusinessTimeZone, getCurrentDateFormatted } from '../src/utils/formatters.js';
const memoryStorage = items => ({
  getItem: key => items.get(key) ?? null,
  setItem: (key, value) => { items.set(key, String(value)); },
  removeItem: key => { items.delete(key); }, clear: () => items.clear(),
  key: index => [...items.keys()][index] ?? null, get length() { return items.size; }
});

test('the business date follows the requested timezone, not UTC or the device', () => {
  // 21:30 UTC is already the next calendar day in Riyadh (UTC+3).
  const instant = new Date('2026-10-01T21:30:00.000Z');
  assert.equal(dateInTimeZone(instant, 'UTC'), '2026-10-01');
  assert.equal(dateInTimeZone(instant, 'Asia/Riyadh'), '2026-10-02');
  assert.equal(dateInTimeZone(instant, 'America/New_York'), '2026-10-01');
  assert.equal(dateInTimeZone('2026-10-01T21:30:00.000Z', 'Asia/Riyadh'), '2026-10-02');
});

test('the owner-set business timezone persists and drives the current date', () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
    clear: () => storage.clear(),
    key: index => [...storage.keys()][index] ?? null,
    get length() { return storage.size; }
  };
  try {
    setBusinessTimeZone('America/New_York');
    assert.equal(getBusinessTimeZone(), 'America/New_York');
    assert.match(getCurrentDateFormatted(), /^\d{4}-\d{2}-\d{2}$/);
  } finally {
    delete globalThis.localStorage;
  }
});

test('invalid timezone cannot replace the saved business clock', () => {
  const items = new Map();
  globalThis.localStorage = memoryStorage(items);
  try {
    setBusinessTimeZone('Asia/Riyadh');
    assert.throws(() => setBusinessTimeZone('invalid/zone'));
    assert.equal(getBusinessTimeZone(), 'Asia/Riyadh');
  } finally { delete globalThis.localStorage; }
});

test('business clocks are isolated by authenticated company', () => {
  const items = new Map(), session = new Map();
  globalThis.localStorage = memoryStorage(items);
  globalThis.sessionStorage = memoryStorage(session);
  const select = tenantId => {
    session.set('khodar_pos_session_token', 'fixture');
    session.set('khodar_verified_session_user', JSON.stringify({ tenantId, sessionExpiresAt: new Date(Date.now() + 60000).toISOString() }));
  };
  try {
    select('first'); setBusinessTimeZone('America/New_York');
    select('second'); assert.equal(getBusinessTimeZone(), 'Asia/Riyadh');
    setBusinessTimeZone('Europe/Paris');
    select('first'); assert.equal(getBusinessTimeZone(), 'America/New_York');
  } finally { delete globalThis.localStorage; delete globalThis.sessionStorage; }
});
