/**
 * GET & POST /api/releases
 * Cloudflare Pages Function
 */
import { authenticateRequest, requireSuperAdmin } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const auth = await authenticateRequest(request, env);
  const denied = requireSuperAdmin(auth);
  if (denied) return denied;

  if (!env || !env.DB) {
    return new Response(JSON.stringify({ success: true, releases: [] }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM app_releases ORDER BY platform ASC, published_at DESC"
    ).all();

    const formatted = (results || []).map(r => {
      let notes = [];
      try { notes = JSON.parse(r.release_notes); } catch (e) { notes = [r.release_notes]; }
      return {
        ...r,
        release_notes: notes
      };
    });

    return new Response(JSON.stringify({ success: true, releases: formatted }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await authenticateRequest(request, env);
  const authError = requireSuperAdmin(auth);
  if (authError) return authError;
  if (!env || !env.DB) {
    return new Response(JSON.stringify({ success: false, error: 'Database not configured' }), { status: 500 });
  }

  try {
    const body = await request.json();
    const {
      id = 'rel-' + Date.now(),
      platform,
      version,
      minimum_version,
      update_type = 'recommended',
      release_notes = [],
      download_url = '',
      file_size_bytes = 0,
      signed_manifest = null
    } = body;

    if (!['web', 'windows', 'android', 'ios'].includes(platform) || !/^\d+\.\d+\.\d+$/.test(version || '') || !/^https:\/\//.test(download_url)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid release manifest' }), { status: 400 });
    }
    if (platform === 'windows' && (!signed_manifest || signed_manifest.version !== version ||
        signed_manifest.url !== download_url || signed_manifest.size !== file_size_bytes ||
        !/^[a-f0-9]{64}$/.test(signed_manifest.sha256) || !signed_manifest.signature)) {
      return new Response(JSON.stringify({ success: false, error: 'Signed update manifest required' }), { status: 400 });
    }
    const notesJson = JSON.stringify(Array.isArray(release_notes) ? release_notes : [release_notes]);

    await env.DB.prepare(
      `INSERT INTO app_releases (id, platform, version, minimum_version, status, update_type, release_notes, download_url, file_size_bytes, signed_manifest, published_at)
       VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         version = excluded.version,
         minimum_version = excluded.minimum_version,
         update_type = excluded.update_type,
         release_notes = excluded.release_notes,
         download_url = excluded.download_url,
         file_size_bytes = excluded.file_size_bytes,
         signed_manifest = excluded.signed_manifest,
         published_at = datetime('now')`
    ).bind(id, platform, version, minimum_version, update_type, notesJson, download_url, file_size_bytes, signed_manifest ? JSON.stringify(signed_manifest) : null).run();

    return new Response(JSON.stringify({ success: true, message: 'Release published successfully' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
