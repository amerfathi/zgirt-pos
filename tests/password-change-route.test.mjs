import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

const storage = () => ({ values: new Map(),
  getItem(key) { return this.values.get(key) ?? null; },
  setItem(key, value) { this.values.set(key, String(value)); },
  removeItem(key) { this.values.delete(key); },
  clear() { this.values.clear(); },
  key(index) { return [...this.values.keys()][index] ?? null; },
  get length() { return this.values.size; }
});

test('password change uses the owner route for platform owner and account route for staff', async () => {
  const bundle = await build({ stdin: { contents:
    "export {useAppStore} from './src/store/useAppStore.js';export {setSessionToken,setSessionUser} from './src/services/authSession.js';",
    resolveDir: process.cwd() }, bundle: true, write: false, define: { 'import.meta.env': '{}' },
    format: 'cjs', platform: 'node', packages: 'external' });
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const { useAppStore, setSessionToken, setSessionUser } = loaded.exports;
  const originalFetch = globalThis.fetch;
  const originalNavigator = globalThis.navigator;
  let root;
  try {
    for (const [role, expectedPath, expectedMethod] of [
      ['super_admin', '/api/auth/platform-owner', 'PATCH'],
      ['cashier', '/api/auth/password', 'POST']
    ]) {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage() });
      Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage() });
      let reloads = 0;
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
      Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {}, removeEventListener() {},
        location: { origin: 'https://test.invalid', reload() { reloads++; } } } });
      Object.defineProperty(globalThis, 'document', { configurable: true, value: {
        addEventListener() {}, removeEventListener() {}, visibilityState: 'hidden' } });
      const user = { id: role, tenantId: 'A', role, branchId: 'all',
        sessionExpiresAt: new Date(Date.now() + 60_000).toISOString() };
      setSessionToken('test-session');
      setSessionUser(user);
      const requests = [];
      globalThis.fetch = async (url, init = {}) => {
        requests.push({ path: new URL(url).pathname, method: init.method || 'GET', body: init.body });
        return Response.json({ success: true });
      };
      let app;
      function Harness() { app = useAppStore(); return null; }
      await act(async () => { root = TestRenderer.create(React.createElement(Harness)); });
      await act(async () => { assert.equal(await app.changePassword('NewPassword!2026', 'CurrentPassword!2026'), true); });
      const change = requests.filter(request => request.path !== '/api/auth/logout');
      assert.equal(change.length, 1);
      assert.equal(change[0].path, expectedPath);
      assert.equal(change[0].method, expectedMethod);
      assert.equal(JSON.parse(change[0].body).newPassword, 'NewPassword!2026');
      assert.equal(reloads, 1);
      await act(async () => { root.unmount(); });
      root = null;
    }
  } finally {
    if (root) await act(async () => { root.unmount(); });
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
    delete globalThis.window;
    delete globalThis.document;
  }
});
