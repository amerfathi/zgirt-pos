// Scoped live diagnostic: only isolated QA credentials; never output bodies/headers.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { attachConflictPreconditions } from '../src/services/syncConflictPolicy.js';
const directory = 'scratch/artifacts/live-large-review';
const config = JSON.parse(await readFile(directory + '/private-fixture.json', 'utf8'));
const company = config.companies.CA;
assert.match(company, /^LIVEQA-[A-F0-9]{8}-CA$/);
const tag = 'review-resource-' + crypto.randomUUID();
const child = spawn('cmd.exe', ['/d', '/s', '/c',
  `npx wrangler@4.147.0 pages deployment tail 08667048-c607-4822-b7ec-569010e4f691 --environment preview --project-name khodar-pos --format json --method POST --header x-braka-qa:${tag}`],
{ windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let buffer = '', ready = false;
const records = [];
child.stderr.on('data', chunk => {
  const text = chunk.toString();
  if (/Connected|Successfully created tail/i.test(text)) ready = true;
  const code = text.match(/\[code:\s*(\d+)\]/)?.[1];
  if (code) console.log(JSON.stringify({ tailErrorCode: code }));
});
child.stdout.on('data', chunk => {
  buffer += chunk.toString();
  if (/Connected|Successfully created tail/i.test(buffer)) ready = true;
  let start = buffer.indexOf('{');
  while (start >= 0) {
    let depth = 0, quoted = false, escaped = false, end = -1;
    for (let i = start; i < buffer.length; i++) {
      const character = buffer[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') quoted = false;
      } else if (character === '"') quoted = true;
      else if (character === '{') depth++;
      else if (character === '}' && --depth === 0) { end = i + 1; break; }
    }
    if (end < 0) break;
    try {
      const event = JSON.parse(buffer.slice(start, end));
      const record = { outcome: event.outcome, cpuTime: event.cpuTime, wallTime: event.wallTime,
        status: event.event?.response?.status, path: event.event?.request?.url?.split('?')[0] };
      records.push(record); console.log(JSON.stringify({ tail: record }));
    } catch { /* Preserve only complete filtered metadata. */ }
    buffer = buffer.slice(end); start = buffer.indexOf('{');
  }
});
try {
  for (let i = 0; i < 30 && !ready && child.exitCode === null; i++) await new Promise(resolve => setTimeout(resolve, 1000));
  console.log(JSON.stringify({ tailReady: ready, tailExitCode: child.exitCode }));
  for (let attempt = 0; attempt < (process.argv.includes('--push-comparison') ? 1 : 3); attempt++) {
    const response = await fetch('https://qa-2614.khodar-pos.pages.dev/api/tenants/lookup', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-braka-qa': tag },
      body: JSON.stringify({ storeCode: company, username: 'owner-' + company, password: config.password })
    });
    const body = await response.text();
    const record = { attempt: attempt + 1, status: response.status, cloudflare1102: /\b1102\b/.test(body) };
    records.push(record); console.log(JSON.stringify({ probe: record }));
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  if (process.argv.includes('--push-comparison')) {
    const tenantId = config.companies.CB;
    assert.match(tenantId, /^LIVEQA-[A-F0-9]{8}-CB$/);
    const headers = { 'Content-Type': 'application/json', 'x-braka-qa': tag };
    const login = await fetch('https://qa-2614.khodar-pos.pages.dev/api/tenants/lookup', {
      method: 'POST', headers, body: JSON.stringify({ storeCode: tenantId, username: 'owner-' + tenantId, password: config.password })
    });
    assert.equal(login.status, 200);
    headers.Authorization = 'Bearer ' + (await login.json()).session.token;
    const pull = await fetch('https://qa-2614.khodar-pos.pages.dev/api/sync/pull?tenantId=' + tenantId + '&limit=1000', { headers });
    assert.equal(pull.status, 200);
    const snapshot = await pull.json(); assert.equal(snapshot.hasMore, false);
    const heads = snapshot.conflictHeads;
    for (const size of [10, 100]) {
      const events = Array.from({ length: size }, () => attachConflictPreconditions({
        id: 'resource-qa-' + crypto.randomUUID(), tenantId, branchId: null, entityType: 'settings', entityId: 'settings', action: 'update',
        timestamp: Date.now(), payload: { tenantId }
      }, heads));
      const response = await fetch('https://qa-2614.khodar-pos.pages.dev/api/sync/push', {
        method: 'POST', headers, body: JSON.stringify({ tenantId, events })
      });
      const body = await response.text();
      const record = { batchSize: size, status: response.status, cloudflare1102: /\b1102\b/.test(body) };
      records.push(record); console.log(JSON.stringify({ pushProbe: record }));
      if (response.status !== 200) break; // Never retry an ambiguous commit with fresh IDs.
      assert.equal(JSON.parse(body).acceptedIds.length, size);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  await new Promise(resolve => setTimeout(resolve, 5000));
  const suffix = process.argv.includes('--push-comparison') ? 'push-comparison' : 'auth-resource';
  await writeFile(directory + '/' + suffix + '-metadata.json', JSON.stringify(records, null, 2));
} finally {
  if (child.exitCode === null) execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
}
