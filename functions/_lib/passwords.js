// Cost 12 and the existing stored format are preserved. Pages handlers must pass
// env to delegate CPU work; calls without env are for the DO or offline tooling.
export async function hashPassword(password, env = undefined) {
  if (typeof password !== 'string' || password.length < 12 ||
      new TextEncoder().encode(password).byteLength > 72) {
    throw new Error('Password must be at least 12 characters and at most 72 UTF-8 bytes');
  }
  if (env !== undefined) {
    const result = await delegatedPasswordWork(env, { operation: 'hash', password });
    if (!/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(result.hash || '')) throw new Error('Password service unavailable');
    return result.hash;
  }
  const { default: bcrypt } = await import('bcryptjs');
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, stored, env = undefined) {
  if (typeof password !== 'string' || typeof stored !== 'string' ||
      new TextEncoder().encode(password).byteLength > 72 ||
      !/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(stored)) {
    return { valid: false, legacy: false };
  }
  if (env !== undefined) {
    const result = await delegatedPasswordWork(env, { operation: 'verify', password, stored });
    if (typeof result.valid !== 'boolean') throw new Error('Password service unavailable');
    return { valid: result.valid, legacy: false };
  }
  const { default: bcrypt } = await import('bcryptjs');
  return { valid: await bcrypt.compare(password, stored), legacy: false };
}

// Pages only dispatches; expensive bcrypt remains inside a private Durable Object.
// No shared global queue, persisted passwords, public URL, or authentication cache.
async function delegatedPasswordWork(env, payload) {
  const namespace = env?.PASSWORD_CRYPTO;
  if (!namespace?.newUniqueId || !namespace?.get) throw new Error('Password service unavailable');
  try {
    const stub = namespace.get(namespace.newUniqueId());
    const response = await stub.fetch(new Request('https://password.internal/compute', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000)
    }));
    if (!response.ok) throw new Error('Password service unavailable');
    return await response.json();
  } catch { throw new Error('Password service unavailable'); }
}
