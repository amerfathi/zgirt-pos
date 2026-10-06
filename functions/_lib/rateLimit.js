import { json } from './http.js';
export async function rateLimit(request, env, scope, max = 15) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${scope}:${ip}`));
  const key = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  const bucket = Math.floor(Date.now() / 60000);
  const row = await env.DB.prepare(`INSERT INTO request_limits (key, bucket, count) VALUES (?, ?, 1)
    ON CONFLICT(key) DO UPDATE SET bucket = excluded.bucket,
    count = CASE WHEN request_limits.bucket = excluded.bucket THEN request_limits.count + 1 ELSE 1 END RETURNING count`)
    .bind(key, bucket).first();
  return row.count > max ? json({ success: false, error: 'Too many attempts' }, 429, { 'Retry-After': '60' }) : null;
}
