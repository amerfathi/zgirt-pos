import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../functions/_lib/passwords.js';
import entrypoint, { PasswordCrypto } from '../workers/password-crypto/index.js';

test('server password work uses the internal binding and fails closed if unavailable', async () => {
  const password = crypto.randomUUID() + 'Aa!';
  const stored = await hashPassword(password);
  let calls = 0;
  const env = { PASSWORD_CRYPTO: { newUniqueId: () => 'isolated', get: () => ({ fetch: async request => {
    calls++;
    const body = await request.json();
    assert.equal(body.password, password);
    return Response.json(body.operation === 'hash' ? { hash: stored } : { valid: true });
  } }) } };
  assert.deepEqual(await verifyPassword(password, stored, env), { valid: true, legacy: false });
  assert.equal(await hashPassword(password, env), stored);
  assert.equal(calls, 2);
  await assert.rejects(verifyPassword(password, stored, {}), /unavailable/);
  await assert.rejects(hashPassword(password, {}), /unavailable/);
  for (const response of [Response.json({ valid: 'true' }), new Response(null, { status: 503 })]) {
    const failed = { PASSWORD_CRYPTO: { newUniqueId: () => 'isolated', get: () => ({ fetch: async () => response }) } };
    await assert.rejects(verifyPassword(password, stored, failed), /unavailable/);
  }
  const denied = { PASSWORD_CRYPTO: { newUniqueId: () => 'isolated', get: () => ({ fetch: async () => Response.json({ valid: false }) }) } };
  assert.deepEqual(await verifyPassword(password, stored, denied), { valid: false, legacy: false });
});

test('private compute preserves bcrypt12 and exposes no public authentication endpoint', async () => {
  assert.equal(entrypoint.fetch().status, 404);
  const worker = new PasswordCrypto();
  const invoke = body => worker.fetch(new Request('https://password.internal/compute', {
    method: 'POST', body: JSON.stringify(body)
  }));
  const password = crypto.randomUUID() + 'Aa!';
  const hashed = await (await invoke({ operation: 'hash', password })).json();
  assert.match(hashed.hash, /^\$2b\$12\$/);
  assert.equal((await (await invoke({ operation: 'verify', password, stored: hashed.hash })).json()).valid, true);
  assert.equal((await (await invoke({ operation: 'verify', password: 'incorrect', stored: hashed.hash })).json()).valid, false);
  assert.equal((await invoke({ operation: 'hash', password: 'short' })).status, 400);
  assert.equal((await invoke({ operation: 'hash', password: 'x'.repeat(5000) })).status, 413);
  assert.equal((await invoke({ operation: 'unknown' })).status, 400);
});
