// Disposable, local-only API for manual cross-platform branch verification.
// Never connect this fixture to a deployed Pages project or production D1.
import { readFile, readdir } from 'node:fs/promises';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { hashPassword } from '../functions/_lib/passwords.js';

const port = 8787;
const password = `${crypto.randomUUID()}Aa!`;
const bundle = await build({ entryPoints: ['tests/runtime-worker.js'], bundle: true,
  write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const server = new Miniflare(convertV4MiniflareOptions({
  host: '127.0.0.1', port, cf: false,
  workers: [{ name: 'braka-local-fixture', modules: true, script: bundle.outputFiles[0].text,
    compatibilityDate: '2024-09-01', d1Databases: ['DB'],
    bindings: { AUTH_SECRET: crypto.randomUUID() + crypto.randomUUID() } }]
}));
try {
  const db = await server.getD1Database('DB');
  for (const name of (await readdir('d1/migrations')).filter(name => name.endsWith('.sql')).sort()) {
    const sql = (await readFile(`d1/migrations/${name}`, 'utf8')).replace(/--[^\n]*/g, '');
    for (const statement of sql.match(/\s*CREATE TRIGGER[\s\S]*?END;|[^;]+;/gi) || [])
      if (statement.trim()) await db.prepare(statement).run();
  }
  const passwordHash = await hashPassword(password);
  await db.prepare('INSERT INTO tenants (id,store_code,company_name,username,password_hash,status,role,allowed_branches) VALUES (?,?,?,?,?,?,?,?)')
    .bind('LOCALTEST','LOCALTEST','Local branch fixture','local-owner',passwordHash,'active','company_owner',5).run();
  for (const [id,name,isMain] of [['local-one','Local One',1],['local-two','Local Two',0]])
    await db.prepare('INSERT INTO branches (id,tenant_id,name,code,is_main,status) VALUES (?,?,?,?,?,?)')
      .bind(id,'LOCALTEST',name,id,isMain,'active').run();
  await server.ready;
  process.stdout.write(`LOCAL_TEST_API=http://127.0.0.1:${port}\nSTORE_CODE=LOCALTEST\nUSERNAME=local-owner\nPASSWORD=${password}\n`);
  process.stdout.write('Local-only volatile D1 fixture; stop this process to discard all test data.\n');
  const stop = async () => { await server.dispose(); process.exit(0); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
} catch (error) {
  await server.dispose();
  throw error;
}
