export const CORS_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Vary': 'Origin'
  ,'Cache-Control': 'no-store'
};

export const json = (body, status = 200, headers = {}) => new Response(
  JSON.stringify(body), { status, headers: { ...CORS_HEADERS, ...headers } }
);

export const options = () => new Response(null, { headers: CORS_HEADERS });

export function badRequest(error) { return json({ success: false, error }, 400); }
export function unauthorized(error = 'Authentication required') { return json({ success: false, error }, 401); }
export function forbidden(error = 'Permission denied') { return json({ success: false, error }, 403); }

export function boundedString(value, name, { min = 0, max = 255, required = false } = {}) {
  const text = typeof value === 'string' ? value.trim() : '';
  if ((required && !text) || text.length < min || text.length > max) {
    throw new Error(`${name} is invalid`);
  }
  return text;
}

export async function readJson(request, maxBytes = 1024 * 1024) {
  if (!request.headers.get('Content-Type')?.includes('application/json')) throw new Error('JSON required');
  if (!request.body) throw new Error('Request body required');
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error('Request body too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const value = JSON.parse(new TextDecoder().decode(bytes));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON object required');
  return value;
}
