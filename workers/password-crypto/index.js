import { hashPassword, verifyPassword } from '../../functions/_lib/passwords.js';

// Reachable only through an account-local namespace binding. No database access,
// storage writes, logs, timers, or retained request fields.
export class PasswordCrypto {
  async fetch(request) {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/compute')
      return new Response(null, { status: 404 });
    try {
      const text = await request.text();
      if (new TextEncoder().encode(text).byteLength > 4096) return new Response(null, { status: 413 });
      const body = JSON.parse(text);
      if (body.operation === 'hash') return Response.json({ hash: await hashPassword(body.password) });
      if (body.operation === 'verify') return Response.json(await verifyPassword(body.password, body.stored));
      return new Response(null, { status: 400 });
    } catch { return new Response(null, { status: 400 }); }
  }
}

export default { fetch() { return new Response(null, { status: 404 }); } };
