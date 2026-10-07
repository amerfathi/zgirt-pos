import bcrypt from 'bcryptjs';

export async function hashPassword(password, env = undefined) {
  if (typeof password !== 'string' || password.length < 8 ||
      new TextEncoder().encode(password).byteLength > 72) {
    throw new Error('Password must be at least 8 characters and at most 72 UTF-8 bytes');
  }
  if (env?.PASSWORD_CRYPTO) {
    try {
      const result = await delegatedPasswordWork(env, { operation: 'hash', password });
      if (/^\[aby]\\$[./A-Za-z0-9]{53}$/.test(result.hash || '')) return result.hash;
    } catch {}
  }
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, stored, env = undefined) {
  if (typeof password !== 'string' || typeof stored !== 'string') {
    return { valid: false, legacy: false };
  }
  if (env?.PASSWORD_CRYPTO) {
    try {
      const result = await delegatedPasswordWork(env, { operation: 'verify', password, stored });
      if (typeof result.valid === 'boolean') return { valid: result.valid, legacy: false };
    } catch {}
  }
  const valid = await bcrypt.compare(password, stored);
  return { valid, legacy: false };
}

async function delegatedPasswordWork(env, payload) {
  const namespace = env?.PASSWORD_CRYPTO;
  if (!namespace?.newUniqueId || !namespace?.get) throw new Error('Password service unavailable');
  const stub = namespace.get(namespace.newUniqueId());
  const response = await stub.fetch(new Request('https://password.internal/compute', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(10000)
  }));
  if (!response.ok) throw new Error('Password service unavailable');
  return await response.json();
}
