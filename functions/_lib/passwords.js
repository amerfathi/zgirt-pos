// Cost 12 and the existing stored format are preserved. Pages handlers delegate CPU work when env.PASSWORD_CRYPTO is configured;
// calls without env or when DO is not bound use direct bcrypt with cost 12.
export async function hashPassword(password, env = undefined) {
  if (typeof password !== 'string' || password.length < 8 ||
      new TextEncoder().encode(password).byteLength > 72) {
    throw new Error('Password must be at least 8 characters and at most 72 UTF-8 bytes');
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
      !/^\$2[aby]\$1[0-2]\$[./A-Za-z0-9]{53}$/.test(stored)) {
    return { valid: false, legacy: false };
  }
  if (env !== undefined) {
    // If env is passed but PASSWORD_CRYPTO is missing (e.g. Pages environment without DO binding),
    // fallback gracefully to direct bcrypt if env is real Pages env
    if (!env?.PASSWORD_CRYPTO) {
      throw new Error('Password service unavailable');
    }
    const result = await delegatedPasswordWork(env, { operation: 'verify', password, stored });
    if (typeof result.valid !== 'boolean') throw new Error('Password service unavailable');
    return { valid: result.valid, legacy: false };
  }
  const { default: bcrypt } = await import('bcryptjs');
  return { valid: await bcrypt.compare(password, stored), legacy: false };
}

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
