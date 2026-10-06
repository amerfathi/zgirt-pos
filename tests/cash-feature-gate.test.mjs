import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/_middleware.js';

test('unfinished cashier API does not expose a public enrollment endpoint', async () => {
  let reached = false;
  const response = await onRequest({ request: new Request('https://fixture.invalid/api/cash/devices', { method: 'POST' }),
    env: {}, data: {}, next: async () => { reached = true; return new Response('unexpected'); } });
  assert.equal(response.status, 401);
  assert.equal(reached, false);
});

test('cashier API remains disabled for authenticated owners unless explicitly enabled', async () => {
  const env = { AUTH_SECRET: 'a'.repeat(32), DB: { prepare: sql => ({ bind: () => ({ first: async () =>
    sql.includes('FROM sessions') ? { principal_type: 'tenant', principal_id: 'A', tenant_id: 'A', credential_version: 0 }
      : { id: 'A', status: 'active', role: 'company_owner', auth_version: 0 }
  }) }) } };
  let reached = false;
  const context = { request: new Request('https://fixture.invalid/api/cash/devices', { method: 'POST',
    headers: { Authorization: `Bearer ${'b'.repeat(64)}` } }), env, data: {},
    next: async () => { reached = true; return new Response('enabled'); } };
  assert.equal((await onRequest(context)).status, 503);
  assert.equal(reached, false);
  assert.equal((await onRequest({ ...context, env: { ...env, CASH_SHIFTS_ENABLED: 'true' } })).status, 200);
  assert.equal(reached, true);
});
