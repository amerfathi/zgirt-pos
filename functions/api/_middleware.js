import { authenticateRequest } from '../_lib/auth.js';
import { json, options } from '../_lib/http.js';

// New routes fail closed unless explicitly declared public here.
const PUBLIC = new Set(['POST /api/tenants/lookup', 'POST /api/auth/reset', 'POST /api/trial-requests',
  'GET /api/releases/latest', 'GET /api/health']);
export async function onRequest(context) {
  try {
    const key = `${context.request.method} ${new URL(context.request.url).pathname.replace(/\/$/, '')}`;
    if (context.request.method === 'OPTIONS') return options();
    if (!PUBLIC.has(key)) {
      const auth = await authenticateRequest(context.request, context.env);
      if (auth.error) return auth.error;
      context.data.auth = auth;
    }
    if (new URL(context.request.url).pathname.startsWith('/api/cash/') && context.env.CASH_SHIFTS_ENABLED !== 'true')
      return json({ success: false, error: 'Cash shifts are not enabled' }, 503);
    const response = await context.next();
    const secured = new Response(response.body, response);
    secured.headers.set('Cache-Control', 'no-store');
    secured.headers.set('X-Content-Type-Options', 'nosniff');
    return secured;
  } catch {
    return json({ success: false, error: 'Service unavailable' }, 503);
  }
}
