import { authenticateRequest } from '../../_lib/auth.js';
import { json } from '../../_lib/http.js';
export async function onRequestPost({ request, env }) {
  const auth = await authenticateRequest(request, env);
  if (auth.error) return auth.error;
  await env.DB.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE id = ?").bind(auth.session.id).run();
  return json({ success: true });
}
