// Local-only financial platform harness. Never point clients at a production tenant.
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { hashPassword } from '../functions/_lib/passwords.js';
import { attachConflictPreconditions } from '../src/services/syncConflictPolicy.js';

const port = Number(process.env.BRAKA_MATRIX_PORT || 8788);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw Error('Invalid matrix port');
const staticRoot = resolve('dist-matrix');
const script = (await build({ entryPoints: ['tests/runtime-worker.js'], bundle: true,
  write: false, format: 'esm', platform: 'browser', target: 'es2022' })).outputFiles[0].text;
const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: 'matrix', modules: true,
  script, compatibilityDate: '2024-09-01', d1Databases: ['DB'],
  durableObjects: { PASSWORD_CRYPTO: { className: 'PasswordCrypto', useSQLite: true } },
  bindings: { AUTH_SECRET: crypto.randomUUID() + crypto.randomUUID() } }] }));
const db = await mf.getD1Database('DB');
for (const name of (await readdir('d1/migrations')).filter(name => name.endsWith('.sql')).sort()) {
  const sql = (await readFile(`d1/migrations/${name}`, 'utf8')).replace(/--[^\n]*/g, '');
  for (const statement of sql.match(/\s*CREATE TRIGGER[\s\S]*?END;|[^;]+;/gi) || []) {
    if (statement.trim()) await db.prepare(statement).run();
  }
}
const tenantId = 'matrix-tenant';
const branchId = 'matrix-main';
const passwordHash = await hashPassword('MatrixOnly!2026');
await db.prepare('INSERT INTO tenants (id,store_code,company_name,username,password_hash,status,role,allowed_branches) VALUES (?,?,?,?,?,?,?,?)')
  .bind(tenantId, 'MATRIX', 'Isolated matrix fixture', 'owner', passwordHash, 'active', 'company_owner', 4).run();
await db.prepare('INSERT INTO branches (id,tenant_id,name,code,is_main,status) VALUES (?,?,?,?,?,?)')
  .bind(branchId, tenantId, 'Main', 'MAIN', 1, 'active').run();

// Explicitly opt-in local fixtures for actual multi-company UI testing.
// This harness binds only loopback and never accesses the production database.
if (process.env.BRAKA_MULTI_COMPANY === 'true') {
  for (const company of ['CA', 'CB']) {
    await db.prepare('INSERT INTO tenants(id,store_code,company_name,username,password_hash,status,role,allowed_branches) VALUES(?,?,?,?,?,?,?,?)')
      .bind(company, company, `Fixture ${company}`, `owner-${company}`, passwordHash, 'active', 'company_owner', 3).run();
    for (const index of [1, 2]) {
      const branch = `${company}-branch-${index}`;
      await db.prepare('INSERT INTO branches(id,tenant_id,name,code,is_main,status) VALUES(?,?,?,?,?,?)')
        .bind(branch, company, `${company} branch ${index}`, `${company}${index}`, index === 1 ? 1 : 0, 'active').run();
      const event = attachConflictPreconditions({ id: `seed-${branch}`, tenantId: company, branchId: branch,
        entityType: 'product', entityId: `${branch}-product`, action: 'create', timestamp: Date.now(), payload: {
          id: `${branch}-product`, tenantId: company, branchId: branch, name: `${company} Tomatoes ${index}`,
          defaultPricePerKg: 10, costPerKg: 4, currentStockKg: 100, defaultUnit: 'كيلو', defaultTareKg: 0,
          branchStock: { [branch]: 100 }
        } }, index === 1 ? {} : { 'domain:inventory': `seed-${company}-branch-1` });
      await db.prepare(`INSERT INTO sync_events_v2(id,tenant_id,branch_id,entity_type,entity_id,action,payload_json,
        client_timestamp,server_timestamp,conflict_policy_version,preconditions_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(event.id, company, branch, event.entityType, event.entityId, event.action, JSON.stringify(event.payload),
          event.timestamp, event.timestamp, 1, JSON.stringify(event.preconditions)).run();
      await db.prepare(`INSERT INTO users(id,tenant_id,name,username,password_hash,role,status,branch_id,branch_ids_json,permissions_json)
        VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(`${company}-cashier-${index}`, company, `${company} Cashier ${index}`,
          `cashier-${index}`, passwordHash, 'cashier', 'active', `${company}-branch-1`, JSON.stringify([`${company}-branch-1`]), '{}').run();
    }
    await db.prepare(`INSERT INTO users(id,tenant_id,name,username,password_hash,role,status,branch_id,branch_ids_json,permissions_json)
      VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(`${company}-branch2-cashier`, company, `${company} branch2 cashier`, 'branch2-cashier',
        passwordHash, 'cashier', 'active', `${company}-branch-2`, JSON.stringify([`${company}-branch-2`]), '{}').run();
  }
}

const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8' };
let dropPushAcknowledgements = false;
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url || '/', `http://127.0.0.1:${port}`).pathname;
    if (pathname === '/__matrix/drop-next-push' && request.method === 'POST') {
      dropPushAcknowledgements = true;
      response.writeHead(204); response.end(); return;
    }
    if (pathname === '/__matrix/restore-push-acks' && request.method === 'POST') {
      dropPushAcknowledgements = false;
      response.writeHead(204); response.end(); return;
    }
    if (pathname.startsWith('/api/')) {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const headers = Object.fromEntries(Object.entries(request.headers)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value]));
      const workerdResponse = await mf.dispatchFetch(`https://test.invalid${pathname}${new URL(request.url || '/', `http://127.0.0.1:${port}`).search}`,
        { method: request.method, headers, ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) });
      const responseBody = Buffer.from(await workerdResponse.arrayBuffer());
      if (pathname === '/api/sync/push' && request.method === 'POST' && dropPushAcknowledgements && workerdResponse.ok) {
        response.destroy();
        return;
      }
      response.writeHead(workerdResponse.status, Object.fromEntries(workerdResponse.headers));
      response.end(responseBody);
      return;
    }
    const target = resolve(staticRoot, `.${decodeURIComponent(pathname === '/' ? '/index.html' : pathname)}`);
    if (relative(staticRoot, target).startsWith('..')) { response.writeHead(403); response.end(); return; }
    const content = await readFile(target);
    response.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-store' });
    response.end(content);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(`Matrix harness error: ${error instanceof Error ? error.message : String(error)}`);
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Matrix fixture listening on http://127.0.0.1:${port}`));
const close = async () => { server.close(); await mf.dispose(); };
process.once('SIGINT', close);
process.once('SIGTERM', close);
