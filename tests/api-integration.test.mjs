import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import {dirname} from 'node:path';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { AtomicStore } from '../src/services/atomicStore.js';
import { scopedStorageKey } from '../src/services/tenantStorage.js';
import { verifyCloudCheckpoint } from '../src/services/legacyMigrationAudit.js';
import { INITIAL_BRANCHES } from '../src/data/initialData.js';
import { hashPassword } from '../functions/_lib/passwords.js';
import legacyReset from '../scripts/prepare-legacy-reset.cjs';
import { attachConflictPreconditions, conflictKeysForEvent, SYNC_HEADS_STATE_KEY } from '../src/services/syncConflictPolicy.js';
import { verifySignedOfflineGrant, assertVerifiedOfflineGrant } from '../src/services/verifiedOfflineGrant.js';
import { accountingDate } from '../src/services/cashShiftEngine.js';
import {createRequire} from 'node:module';
import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import {seedAggregate} from './aggregate-fixture.mjs';

const memoryStorage = () => ({ items: new Map(),
  getItem(key) { return this.items.get(key) ?? null; },
  setItem(key,value) { this.items.set(key,String(value)); },
  removeItem(key) { this.items.delete(key); }, clear() { this.items.clear(); },
  key(index) { return [...this.items.keys()][index] ?? null; },
  get length() { return this.items.size; }
});

let mf, db, a, b, staff, platform, grantPublicJwk;
const pass = crypto.randomUUID() + 'Aa!'; // ephemeral fixture, never production credentials
const deviceProof = () => crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
async function call(path, method = 'GET', body, token, ip = 'local', scopeEvents = true, replayInput = null, production = false) {
  if (path === '/api/sync/push' && method === 'POST' && Array.isArray(body?.events) && db) {
    const heads=new Map();
    for (const event of body.events) {
      if (scopeEvents && !['branch','stock_transfer','restore_snapshot','settings'].includes(event.entityType) &&
          event.branchId == null) {
        const main=await db.prepare('SELECT id FROM branches WHERE tenant_id = ? AND is_main = 1 ORDER BY id LIMIT 1')
          .bind(body.tenantId).first();
        if (main) {
          event.branchId=main.id;
        }
      }
      if (scopeEvents && event.action==='create' && event.branchId && event.payload && !event.payload.branchId)
        event.payload.branchId=event.branchId;
      if (event.conflictPolicyVersion === 1) continue;
      const keys=conflictKeysForEvent(event);
      const preconditions={};
      for (const key of keys) {
        if (!heads.has(key)) heads.set(key,(await db.prepare(
          'SELECT last_event_id FROM sync_conflict_heads WHERE tenant_id = ? AND conflict_key = ?'
        ).bind(body.tenantId,key).first())?.last_event_id ?? null);
        preconditions[key]=heads.get(key); heads.set(key,event.id);
      }
      event.conflictPolicyVersion=1; event.preconditions=preconditions;
    }
  }
  if(replayInput) {
    const proofs=[];
    for(const event of body.events) {
      event.tenantId??=body.tenantId;
      const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},replayInput.keys.privateKey,
        new TextEncoder().encode(JSON.stringify(event)));
      proofs.push({source:structuredClone(event),grant:replayInput.grant,signature:Buffer.from(signature).toString('base64url')});
    }
    path='/api/cash/replay';body={tenantId:body.tenantId,deviceId:replayInput.deviceId,deviceProof:replayInput.proof,proofs};
  }
  const send=production ? (await mf.getWorker('production')).fetch.bind(await mf.getWorker('production')) : mf.dispatchFetch.bind(mf);
  return send('https://test.invalid' + path, { method,
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
}
// Explicit signed fixture for real API/D1 scenarios; no authentication bypass.
async function signedCashFixture(tenantId,token,drawers,deviceId=`fixture-${tenantId}`) {
  const proof=deviceProof();
  assert.ok([200,201].includes((await call('/api/cash/devices','POST',{tenantId,deviceId,deviceProof:proof},token)).status));
  for(const drawer of drawers) {
    const result=await call('/api/cash/drawers','PATCH',{tenantId,deviceId,drawerId:drawer.id,branchId:drawer.branchId},token);
    assert.ok([200,201].includes(result.status),await result.text());
  }
  const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const result=await call('/api/cash/grants','POST',{tenantId,deviceId,deviceProof:proof,eventPublicJwk:await crypto.subtle.exportKey('jwk',keys.publicKey)},token);
  assert.equal(result.status,200,await result.clone().text());
  const grant=(await result.json()).grant;
  const signed={keys,grant,deviceId,proof};
  return {deviceId,grant,push:body=>call('/api/sync/push','POST',body,token,'local',true,signed),
    source:(id,type,payload,action='create')=>({id,entityType:type,entityId:payload.id,action,payload,
      tenantId,branchId:payload.branchId,timestamp:Math.max(Date.now(),Date.parse(grant.claims.onlineVerifiedAt))})};
}
// Independent fixture logins must not share one rate bucket: faster CI runs
// legitimately exhaust it. Explicit IPs still exercise shared-client limits.
async function login(code, username, password = pass, ip = `fixture-login-${crypto.randomUUID()}`) {
  const response = await call('/api/tenants/lookup', 'POST', { storeCode: code, username, password }, undefined, ip);
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.ok(body.session.token);
  assert.equal(JSON.stringify(body).includes(password), false);
  return body.session.token;
}

async function isolatedOwner(tenantId) {
  const branchId=`${tenantId}-main`,username=`owner-${tenantId.toLowerCase()}`;
  await db.prepare("INSERT INTO tenants(id,store_code,company_name,username,password_hash,status,role) VALUES(?,?,?,?,?,'active','company_owner')")
    .bind(tenantId,tenantId,'Isolated policy fixture',username,await hashPassword(pass)).run();
  await db.prepare("INSERT INTO branches(id,tenant_id,name,is_main,status) VALUES(?,?,?,1,'active')").bind(branchId,tenantId,'Main').run();
  return {tenantId,branchId,token:await login(tenantId,username)};
}

test('login rate protection remains enforced for one shared client',async()=>{
  // If the real minute bucket rolls over, start a new isolated client rather
  // than interpreting the deliberate reset as a missing rate limit.
  for(let attempt=0;attempt<2;attempt++) {
    const ip=`rate-check-${crypto.randomUUID()}`,statuses=[],bucket=Math.floor(Date.now()/60000);
    let retryAfter;
    for(let index=0;index<16;index++) {
      const response=await call('/api/tenants/lookup','POST',{storeCode:'A',username:'unknown-rate-fixture',password:'invalid-fixture'},undefined,ip);
      statuses.push(response.status);retryAfter=response.headers.get('Retry-After');
    }
    if(Math.floor(Date.now()/60000)!==bucket)continue;
    assert.equal(statuses.slice(0,15).includes(429),false);
    assert.equal(statuses[15],429);assert.equal(retryAfter,'60');return;
  }
  assert.fail('Could not observe a stable rate-limit minute bucket');
});
before(async () => {
  const bundle = await build({ entryPoints: ['tests/runtime-worker.js'], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
  const productionBundle=await build({entryPoints:['tests/runtime-worker.js'],bundle:true,write:false,
    format:'esm',platform:'browser',target:'es2022',plugins:[{name:'real-production-overrides',setup(builder){
      builder.onLoad({filter:/functions[\\/](?:api[\\/]sync[\\/]push|_lib[\\/]syncPolicy)\.js$/},async args=>{
        const relative=args.path.replaceAll('\\','/').split('/functions/').at(-1);
        return {contents:await readFile('deployment/production/overrides/functions/'+relative,'utf8'),loader:'js',resolveDir:dirname(args.path)};
      });
    }}]});
  const grantKeys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const grantPrivateJwk = await crypto.subtle.exportKey('jwk', grantKeys.privateKey);
  grantPublicJwk = await crypto.subtle.exportKey('jwk', grantKeys.publicKey);
  const bindings={ AUTH_SECRET: crypto.randomUUID() + crypto.randomUUID(), CASH_SHIFTS_ENABLED:'true',OFFLINE_GRANT_PRIVATE_JWK:JSON.stringify(grantPrivateJwk) };
  mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: 'test', modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2024-09-01',
    durableObjects: { PASSWORD_CRYPTO: { className: 'PasswordCrypto', useSQLite: true } },
    d1Databases: {DB:'fixture-db',BOOTSTRAP:'fixture-bootstrap',LEGACY:'fixture-legacy'},bindings },
    {name:'production',modules:true,script:productionBundle.outputFiles[0].text,compatibilityDate:'2024-09-01',
      durableObjects:{ PASSWORD_CRYPTO:{className:'PasswordCrypto',useSQLite:true}},
      d1Databases:{DB:'fixture-db',BOOTSTRAP:'fixture-bootstrap',LEGACY:'fixture-legacy'},bindings}] }));
  db = await mf.getD1Database('DB');
  for (const name of (await readdir('d1/migrations')).filter(n => n.endsWith('.sql')).sort()) {
    const sql = (await readFile('d1/migrations/' + name, 'utf8')).replace(/--[^\n]*/g, '');
    // Preserve trigger BEGIN...END bodies as single statements.
    const statements = sql.match(/\s*CREATE TRIGGER[\s\S]*?END;|[^;]+;/gi) || [];
    for (const statement of statements) {
      if (statement.trim()) {
        try { await db.prepare(statement).run(); } catch (err) { throw new Error(name + ': ' + statement.slice(0,100), { cause: err }); }
      }
    }
  }
  const hashed = await hashPassword(pass);
  for (const id of ['A','B']) await db.prepare('INSERT INTO tenants (id,store_code,company_name,username,password_hash,status,role) VALUES (?,?,?,?,?,?,?)')
    .bind(id, id, 'Fixture ' + id, 'owner' + id, hashed, 'active', 'company_owner').run();
  await db.prepare("UPDATE tenants SET allowed_branches = 10 WHERE id = 'A'").run();
  await db.prepare("INSERT INTO branches (id,tenant_id,name,code,is_main,status) VALUES ('fixture-a-main','A','Fixture main','MAIN',1,'active')").run();
  await db.prepare("INSERT INTO branches (id,tenant_id,name,code,is_main,status) VALUES ('fixture-b-main','B','Fixture B main','MAIN',1,'active')").run();
  await db.prepare('INSERT INTO tenants (id,store_code,company_name,username,password_hash,status,role) VALUES (?,?,?,?,?,?,?)')
    .bind('PLATFORM','PLATFORM','Platform fixture','platform',hashed,'active','super_admin').run();
  await db.prepare("INSERT INTO users (id,tenant_id,name,username,password_hash,role,status,permissions_json) VALUES ('staff','A','Cashier','cashier',?,'cashier','active','{}')").bind(hashed).run();
  a = await login('A','ownerA'); b = await login('B','ownerB'); staff = await login('A','cashier'); platform = await login('PLATFORM','platform');
});
after(async () => { await mf?.dispose(); });

test('conflict inbox preserves both sources, deduplicates retries and is readable only by its tenant owner', async()=>{
  await db.prepare("INSERT INTO tenants(id,store_code,company_name,username,password_hash,status,role) VALUES('REVIEW','REVIEW','Review fixture','review-owner',?,'active','company_owner')").bind(await hashPassword(pass)).run();
  await db.prepare("INSERT INTO branches(id,tenant_id,name,code,is_main,status) VALUES('review-main','REVIEW','Review main','MAIN',1,'active')").run();
  await db.prepare("INSERT INTO users(id,tenant_id,name,username,password_hash,role,status,branch_id,branch_ids_json,permissions_json) VALUES('review-staff','REVIEW','Review cashier','review-cashier',?,'cashier','active','review-main','[\"review-main\"]','{}')").bind(await hashPassword(pass)).run();
  const a=await login('REVIEW','review-owner'),staff=await login('REVIEW','review-cashier');
  const event=attachConflictPreconditions({id:'review-local',tenantId:'REVIEW',branchId:'review-main',
    entityType:'product',entityId:'review-product',action:'create',payload:{id:'review-product',branchId:'review-main',name:'Local'}},{});
  const remote={...event,id:'review-remote',payload:{...event.payload,name:'Server'}};
  assert.equal((await call('/api/sync/push','POST',{tenantId:'REVIEW',events:[remote]},a)).status,200);
  const input={tenantId:'REVIEW',events:[event]};
  const first=await call('/api/sync/conflicts','POST',input,a);
  assert.equal(first.status,200,await first.clone().text());
  const saved=await first.json();
  const retry=await (await call('/api/sync/conflicts','POST',input,a)).json();
  assert.equal(retry.reviewId,saved.reviewId);
  const listing=await call('/api/sync/conflicts?tenantId=REVIEW','GET',undefined,a);
  assert.equal(listing.status,200);
  const row=(await listing.json()).reviews.find(item=>item.id===saved.reviewId);
  assert.deepEqual(row.proposedEvents,[event]);
  assert.equal(row.serverEvents.some(item=>item.id===remote.id&&item.payload.name==='Server'),true);
  assert.equal((await call('/api/sync/conflicts?tenantId=REVIEW','GET',undefined,staff)).status,403);
  assert.equal((await call('/api/sync/conflicts?tenantId=REVIEW','GET',undefined,b)).status,403);
  assert.equal((await call('/api/sync/conflicts','POST',input,b)).status,403);
  assert.equal((await call('/api/sync/conflicts?tenantId=A')).status,401);
  const changed=await call('/api/sync/conflicts','POST',{...input,events:[{...event,payload:{...event.payload,name:'Changed'}}]},a);
  assert.equal(changed.status,409);
  const accepted=await db.prepare("SELECT COUNT(*) AS n FROM sync_events_v2 WHERE id='review-local'").first();
  assert.equal(accepted.n,0);
  const decision={tenantId:'REVIEW',reviewId:saved.reviewId,choice:'server'};
  assert.equal((await call('/api/sync/conflicts','PATCH',decision,staff)).status,403);
  assert.equal((await call('/api/sync/conflicts','PATCH',decision,b)).status,403);
  const chosen=await call('/api/sync/conflicts','PATCH',decision,a);
  assert.equal(chosen.status,200,await chosen.clone().text());
  assert.equal((await chosen.json()).posted,false);
  assert.equal((await call('/api/sync/conflicts','PATCH',decision,a)).status,200);
  assert.equal((await call('/api/sync/conflicts','PATCH',{...decision,choice:'local'},a)).status,409);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM sync_events_v2 WHERE id='review-local'").first()).n,0);
  const nextInput={tenantId:'REVIEW',events:[{...event,id:'review-another'}]};
  const nextSaved=await (await call('/api/sync/conflicts','POST',nextInput,a)).json();
  assert.ok(nextSaved.reviewId);
  const advanced={...remote,id:'review-advanced',action:'update',conflictPolicyVersion:undefined,preconditions:undefined,payload:{id:remote.entityId,name:'Latest'}};
  assert.equal((await call('/api/sync/push','POST',{tenantId:'REVIEW',events:[advanced]},a)).status,200);
  assert.equal((await call('/api/sync/conflicts','PATCH',{...decision,reviewId:nextSaved.reviewId},a)).status,409);
  assert.equal(await db.prepare('SELECT review_id FROM sync_review_decisions WHERE review_id=?').bind(nextSaved.reviewId).first(),null);
});

test('large-company conflict inbox reads only current competing sources, without replaying its entire history',async()=>{
  await db.prepare("INSERT INTO tenants(id,store_code,company_name,username,password_hash,status,role) VALUES('LARGE','LARGE','Large review fixture','large-owner',?,'active','company_owner')").bind(await hashPassword(pass)).run();
  await db.prepare("INSERT INTO branches(id,tenant_id,name,code,is_main,status) VALUES('large-main','LARGE','Large main','MAIN',1,'active')").run();
  const token=await login('LARGE','large-owner');
  const original=attachConflictPreconditions({id:'large-local',tenantId:'LARGE',branchId:'large-main',entityType:'product',entityId:'large-product',action:'create',payload:{id:'large-product',branchId:'large-main',name:'Local'}},{});
  const remote={...original,id:'large-remote',payload:{...original.payload,name:'Server'}};
  assert.equal((await call('/api/sync/push','POST',{tenantId:'LARGE',events:[remote]},token)).status,200);
  // Independent accepted-history fixture. Inbox listing is evidence lookup,
  // not permission to replay/install any of these older financial records.
  await db.prepare(`WITH RECURSIVE n(value) AS(SELECT 1 UNION ALL SELECT value+1 FROM n WHERE value<2200)
    INSERT INTO sync_events_v2(id,tenant_id,entity_type,entity_id,action,payload_json,client_timestamp,server_timestamp)
    SELECT 'large-history-'||value,'LARGE','settings','settings','update','{}',0,0 FROM n`).run();
  const saved=await (await call('/api/sync/conflicts','POST',{tenantId:'LARGE',events:[original]},token)).json();
  const response=await call('/api/sync/conflicts?tenantId=LARGE','GET',undefined,token);
  assert.equal(response.status,200,await response.clone().text());
  const rows=(await response.json()).reviews;
  assert.equal(rows.length,1);assert.equal(rows[0].id,saved.reviewId);
  assert.deepEqual(rows[0].proposedEvents,[original]);
  assert.deepEqual(rows[0].serverEvents.map(row=>row.id),[remote.id]);
  assert.equal(rows[0].serverEvents[0].payload.name,'Server');
  assert.equal((await call('/api/sync/conflicts?tenantId=LARGE','GET',undefined,b)).status,403);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM sync_events_v2 WHERE tenant_id='LARGE'").first()).n,2201);
});

test('owner executes a reviewed update atomically; fresh heads, authenticated receipts and lost-response retries are enforced',async()=>{
  const token=await login('REVIEW','review-owner',pass,'review-resolution-owner');
  const snapshot=await (await call('/api/sync/pull?tenantId=REVIEW','GET',undefined,token)).json();
  const event=attachConflictPreconditions({id:'resolution-local',tenantId:'REVIEW',branchId:'review-main',entityType:'product',entityId:'review-product',action:'update',payload:{id:'review-product',name:'Owner choice'}},{...snapshot.conflictHeads});
  const remote=attachConflictPreconditions({...event,id:'resolution-remote',payload:{id:'review-product',name:'Concurrent'}},{...snapshot.conflictHeads});
  assert.equal((await call('/api/sync/push','POST',{tenantId:'REVIEW',events:[remote]},token)).status,200);
  const review=await (await call('/api/sync/conflicts','POST',{tenantId:'REVIEW',events:[event]},token)).json();
  const rows=await (await call('/api/sync/conflicts?tenantId=REVIEW','GET',undefined,token)).json();
  const item=rows.reviews.find(row=>row.id===review.reviewId);
  const input={tenantId:'REVIEW',reviewId:review.reviewId,choice:'local',execute:true,expectedHeads:item.heads};
  const response=await call('/api/sync/conflicts','PATCH',input,token);
  assert.equal(response.status,200,await response.clone().text());
  const resolved=await response.json();assert.equal(resolved.posted,true);assert.equal(resolved.status,'resolved');
  assert.equal(resolved.receipt.acceptedEventIds.length,1);
  const retry=await (await call('/api/sync/conflicts','PATCH',input,token)).json();
  assert.deepEqual(retry.receipt,resolved.receipt);
  assert.equal((await call('/api/sync/conflicts','PATCH',{...input,choice:'server'},token)).status,409);
  const recovery=await call('/api/sync/resolutions','POST',{tenantId:'REVIEW',events:[event]},token);
  assert.equal(recovery.status,200,await recovery.clone().text());
  const data=await recovery.json();assert.equal(data.ready,true);assert.equal(data.protocol,'owner-reviewed-ledger-v1');
  assert.equal(data.receipts[0].events[0].id,event.id);
  assert.equal(data.checkpoint.products.find(row=>row.id==='review-product').name,'Owner choice');
  assert.equal((await call('/api/sync/resolutions','POST',{tenantId:'REVIEW',events:[event]},b)).status,403);
  assert.equal((await call('/api/sync/push','POST',{tenantId:'REVIEW',events:[event]},token)).status,409);
  const staffToken=await login('REVIEW','review-cashier',pass,'review-resolution-cashier');
  const state=await (await call('/api/sync/pull?tenantId=REVIEW','GET',undefined,token)).json();
  const expense=attachConflictPreconditions({id:'review-expense',tenantId:'REVIEW',branchId:'review-main',entityType:'expense',entityId:'review-expense',action:'create',payload:{id:'review-expense',branchId:'review-main',amount:12,paymentMethod:'cash'}},{...state.conflictHeads});
  const next=attachConflictPreconditions({...expense,id:'server-expense',entityId:'server-expense',payload:{...expense.payload,id:'server-expense',amount:9}},{...state.conflictHeads});
  assert.equal((await call('/api/sync/push','POST',{tenantId:'REVIEW',events:[next]},token)).status,200);
  const captured=await (await call('/api/sync/conflicts','POST',{tenantId:'REVIEW',events:[expense]},token)).json();
  const beforeListing=await (await call('/api/sync/conflicts?tenantId=REVIEW','GET',undefined,token)).json();
  const stale={tenantId:'REVIEW',reviewId:captured.reviewId,choice:'server',execute:true,expectedHeads:beforeListing.reviews.find(row=>row.id===captured.reviewId).heads};
  const extra={...next,id:'newer-expense',entityId:'newer-expense',payload:{...next.payload,id:'newer-expense'},conflictPolicyVersion:undefined,preconditions:undefined};
  assert.equal((await call('/api/sync/push','POST',{tenantId:'REVIEW',events:[extra]},token)).status,200);
  assert.equal((await call('/api/sync/conflicts','PATCH',stale,token)).status,409);
  const fresh=await (await call('/api/sync/conflicts?tenantId=REVIEW','GET',undefined,token)).json();
  assert.equal((await call('/api/sync/conflicts','PATCH',{...stale,expectedHeads:fresh.reviews.find(row=>row.id===captured.reviewId).heads},token)).status,200);
  assert.equal((await call('/api/sync/resolutions','POST',{tenantId:'REVIEW',events:[expense]},staffToken)).status,403);
  const stored=await db.prepare('SELECT receipt_json FROM sync_review_resolutions WHERE review_id=?').bind(captured.reviewId).first();
  assert.equal(JSON.parse(stored.receipt_json).choice,'server');
  await assert.rejects(db.prepare(`INSERT INTO sync_review_resolutions(review_id,tenant_id,decided_by,choice,expected_heads_json,receipt_json) VALUES(?,'REVIEW','REVIEW','server','{}','{}')`)
    .bind('missing-review').run(),/SYNC_REVIEW_STALE/);
});

test('large-company owner decisions and recovery resume bounded replay without accepting a partial checkpoint',async()=>{
  const token=await login('LARGE','large-owner',pass,'large-decision-fixture');
  const listing=await (await call('/api/sync/conflicts?tenantId=LARGE','GET',undefined,token)).json();
  const item=listing.reviews.find(row=>row.proposedEvents[0].id==='large-local');
  const input={tenantId:'LARGE',reviewId:item.id,choice:'server',execute:true,expectedHeads:item.heads,checkpointProtocol:2};
  assert.equal((await call('/api/sync/conflicts','PATCH',{...input,checkpointProtocol:undefined},token)).status,409);
  let response=await call('/api/sync/conflicts','PATCH',input,token);
  assert.equal(response.status,202,await response.clone().text());
  let progress=await response.json();assert.equal(progress.posted,false);assert.equal(progress.status,'validating');
  assert.ok(progress.processedCount>0&&progress.processedCount<=200);
  assert.equal(await db.prepare('SELECT review_id FROM sync_review_resolutions WHERE review_id=?').bind(item.id).first(),null);
  for(let step=0;step<30&&response.status===202;step++)response=await call('/api/sync/conflicts','PATCH',input,token);
  assert.equal(response.status,200,await response.clone().text());
  const result=await response.json();assert.equal(result.posted,true);
  assert.deepEqual((await (await call('/api/sync/conflicts','PATCH',input,token)).json()).receipt,result.receipt);
  const queue=item.proposedEvents;
  response=await call('/api/sync/resolutions','POST',{tenantId:'LARGE',events:queue,checkpointProtocol:2},token);
  assert.equal(response.status,202,await response.clone().text());
  progress=await response.json();assert.equal(progress.ready,false);assert.equal(progress.status,'validating');
  assert.equal(progress.checkpoint,undefined);
  assert.equal((await call('/api/sync/resolutions','POST',{tenantId:'LARGE',events:queue},b)).status,403);
  for(let step=0;step<30&&response.status===202;step++)response=await call('/api/sync/resolutions','POST',{tenantId:'LARGE',events:queue,checkpointProtocol:2},token);
  assert.equal(response.status,200,await response.clone().text());
  const recovered=await response.json();assert.equal(recovered.ready,true);
  assert.equal(recovered.protocol,'owner-reviewed-checkpoint-v2');
  assert.equal(recovered.completeHistory,false);
  assert.equal(recovered.validatedThroughCursor,recovered.nextCursor);
  assert.equal(recovered.checkpoint.products.find(row=>row.id==='large-product').name,'Server');
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM sync_events_v2 WHERE tenant_id='LARGE'").first()).n,2201);
  assert.equal(recovered.history.length,0);
});

test('large-company reviewed financial checkpoint rejects stale decisions and keeps exact stock, debt and replacement proof',async()=>{
  const {tenantId,branchId,token}=await isolatedOwner('LARGEFIN');
  const source=(id,type,payload,action='create')=>({id,tenantId,branchId,entityType:type,entityId:payload.id,action,payload:{tenantId,branchId,...payload}});
  const product=source('lf-product','product',{id:'lf-p',name:'Carrot',currentStockKg:20,branchStock:{[branchId]:20},costPerKg:2,defaultPricePerKg:5});
  const customer=source('lf-customer','customer',{id:'lf-c',name:'Customer',balance:0});
  const invoice=source('lf-sale','invoice',{id:'lf-i',customerId:'lf-c',status:'active',finalTotal:15,paidAmount:0,remainingDebt:15,
    items:[{productId:'lf-p',netWeight:3,pricePerKg:5}]});
  const receipt=source('lf-payment','customer_payment',{id:'lf-r',customerId:'lf-c',amount:5,paymentMethod:'cash'});
  assert.equal((await call('/api/sync/push','POST',{tenantId,events:[product,customer,invoice,receipt]},token)).status,200);
  let state=await (await call('/api/sync/pull?tenantId='+tenantId,'GET',undefined,token)).json();
  await db.prepare(`WITH RECURSIVE n(value) AS(SELECT 1 UNION ALL SELECT value+1 FROM n WHERE value<2050)
    INSERT INTO sync_events_v2(id,tenant_id,entity_type,entity_id,action,payload_json,client_timestamp,server_timestamp)
    SELECT 'lf-history-'||value,?,'settings','settings','update','{}',0,0 FROM n`).bind(tenantId).run();
  const proposed=attachConflictPreconditions(source('lf-local','product',{id:'lf-p',defaultPricePerKg:9},'update'),{...state.conflictHeads});
  const remote=attachConflictPreconditions({...proposed,id:'lf-remote',payload:{...proposed.payload,defaultPricePerKg:8}},{...state.conflictHeads});
  assert.equal((await call('/api/sync/push','POST',{tenantId,events:[remote]},token)).status,200);
  const review=await (await call('/api/sync/conflicts','POST',{tenantId,events:[proposed]},token)).json();
  const load=async()=>(await (await call('/api/sync/conflicts?tenantId='+tenantId,'GET',undefined,token)).json()).reviews.find(row=>row.id===review.reviewId);
  let item=await load(),input={tenantId,reviewId:review.reviewId,choice:'local',execute:true,checkpointProtocol:2,expectedHeads:item.heads};
  assert.equal((await call('/api/sync/conflicts','PATCH',input,token)).status,202);
  state={conflictHeads:item.heads};
  const newer=attachConflictPreconditions({...remote,id:'lf-newer',payload:{...remote.payload,defaultPricePerKg:7}},{...state.conflictHeads});
  assert.equal((await call('/api/sync/push','POST',{tenantId,events:[newer]},token)).status,200);
  assert.equal((await call('/api/sync/conflicts','PATCH',input,token)).status,409);
  assert.equal(await db.prepare('SELECT review_id FROM sync_review_resolutions WHERE review_id=?').bind(review.reviewId).first(),null);
  item=await load();input={...input,expectedHeads:item.heads};
  const concurrent=await Promise.all([call('/api/sync/conflicts','PATCH',input,token),call('/api/sync/conflicts','PATCH',input,token)]);
  assert.deepEqual(concurrent.map(row=>row.status),[202,202]);
  let response;
  for(let step=0;step<30;step++){response=await call('/api/sync/conflicts','PATCH',input,token);if(response.status!==202)break;}
  assert.equal(response.status,200,await response.clone().text());
  const resolved=await response.json();assert.equal(resolved.receipt.acceptedEventIds.length,1);
  const recoveryInput={tenantId,events:[proposed],checkpointProtocol:2};
  for(let step=0;step<30;step++){response=await call('/api/sync/resolutions','POST',recoveryInput,token);if(response.status!==202)break;}
  assert.equal(response.status,200,await response.clone().text());
  const recovered=await response.json();
  assert.equal(recovered.checkpoint.products[0].currentStockKg,17);
  assert.equal(recovered.checkpoint.products[0].branchStock[branchId],17);
  assert.equal(recovered.checkpoint.products[0].defaultPricePerKg,9);
  assert.equal(recovered.checkpoint.customers[0].balance,10);
  assert.deepEqual(recovered.history.map(row=>row.id),resolved.receipt.acceptedEventIds);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM sync_events_v2 WHERE tenant_id=? AND id=?').bind(tenantId,proposed.id).first()).n,0);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM sync_review_resolutions WHERE tenant_id=?').bind(tenantId).first()).n,1);
});

test('large-company legacy product proof examines its complete references without a whole-history cutoff',async()=>{
  const {tenantId,branchId,token}=await isolatedOwner('LARGELEGACY');
  const payload={id:'large-old-p',name:'Legacy carrot',currentStockKg:20,costPerKg:2};
  const sale={id:'large-old-i',tenantId,branchId,customerId:'walk_in',status:'active',finalTotal:15,paidAmount:15,remainingDebt:0,
    items:[{productId:payload.id,netWeight:3,pricePerKg:5}]};
  for(const {id,type,branch,row} of [{id:'large-old-source',type:'product',branch:null,row:payload},{id:'large-old-parent',type:'invoice',branch:branchId,row:sale}])
    await db.prepare("INSERT INTO sync_events_v2(id,tenant_id,branch_id,entity_type,entity_id,action,payload_json,client_timestamp,server_timestamp) VALUES(?,?,?,?,?,'create',?,1,1)")
      .bind(id,tenantId,branch,type,row.id,JSON.stringify(row)).run();
  await db.prepare(`WITH RECURSIVE n(value) AS(SELECT 1 UNION ALL SELECT value+1 FROM n WHERE value<2100)
    INSERT INTO sync_events_v2(id,tenant_id,entity_type,entity_id,action,payload_json,client_timestamp,server_timestamp)
    SELECT 'large-old-history-'||value,?,'settings','settings','update','{}',0,0 FROM n`).bind(tenantId).run();
  const input={tenantId,references:[{parentId:'large-old-parent',productId:payload.id}]};
  const response=await call('/api/sync/dependencies','POST',input,token);
  assert.equal(response.status,200,await response.clone().text());
  const proof=(await response.json()).proofs[0];assert.equal(proof.branchId,branchId);assert.equal(proof.source.branchId,null);
  assert.equal((await call('/api/sync/dependencies','POST',input,b)).status,403);
  const update={id:'large-old-new-price',tenantId,branchId,entityType:'product',entityId:payload.id,action:'update',payload:{id:payload.id,defaultPricePerKg:6}};
  const pushed=await call('/api/sync/push','POST',{tenantId,events:[update]},token);
  assert.equal(pushed.status,200,await pushed.clone().text());
  assert.equal((await db.prepare('SELECT branch_id FROM sync_events_v2 WHERE tenant_id=? AND id=?').bind(tenantId,'large-old-source').first()).branch_id,null);
  const proposed=attachConflictPreconditions({...update,id:'large-old-proposed',payload:{...update.payload,defaultPricePerKg:7}},{});
  const saved=await (await call('/api/sync/conflicts','POST',{tenantId,events:[proposed]},token)).json();
  const item=(await (await call('/api/sync/conflicts?tenantId='+tenantId,'GET',undefined,token)).json()).reviews.find(row=>row.id===saved.reviewId);
  const decision={tenantId,reviewId:item.id,choice:'server',execute:true,expectedHeads:item.heads,checkpointProtocol:2};
  let settled;
  for(let step=0;step<30;step++){settled=await call('/api/sync/conflicts','PATCH',decision,token);if(settled.status!==202)break;}
  assert.equal(settled.status,200,await settled.clone().text());
  const audited=await db.prepare("SELECT ledger_json FROM sync_review_checkpoint_jobs WHERE tenant_id=? AND status='ready'").bind(tenantId).first();
  const auditedProduct=JSON.parse(audited.ledger_json).products.find(row=>row.id===payload.id);
  assert.equal(auditedProduct.branchId,branchId);assert.equal(auditedProduct.currentStockKg,17);assert.equal(auditedProduct.defaultPricePerKg,6);
  // A foreign-branch reference after the former 2000-source cutoff invalidates
  // proof: indexed lookup must not silently ignore the rest of the prefix.
  const second='large-old-second';
  await db.prepare("INSERT INTO branches(id,tenant_id,name,status) VALUES(?,?,?,'active')").bind(second,tenantId,'Other').run();
  await db.prepare("INSERT INTO sync_events_v2(id,tenant_id,branch_id,entity_type,entity_id,action,payload_json,client_timestamp,server_timestamp) VALUES(?,?,?,'invoice',?,'create',?,1,1)")
    .bind('large-old-ambiguous',tenantId,second,'large-old-ambiguous',JSON.stringify({...sale,id:'large-old-ambiguous',branchId:second})).run();
  const ambiguous=await call('/api/sync/dependencies','POST',input,token);
  assert.equal(ambiguous.status,200);assert.deepEqual((await ambiguous.json()).proofs,[]);
  const rejected=await call('/api/sync/push','POST',{tenantId,events:[{...update,id:'large-old-invalid-after-proof',conflictPolicyVersion:undefined,preconditions:undefined}]},token);
  assert.equal(rejected.status,403);assert.equal((await rejected.json()).error,'Entity belongs to another branch');
  assert.equal(await db.prepare('SELECT id FROM sync_events_v2 WHERE tenant_id=? AND id=?').bind(tenantId,'large-old-invalid-after-proof').first(),null);
});

test('checkpoint page boundary keeps a three-source stock transfer together and claims reject newly arrived legacy sources',async()=>{
  const {tenantId,branchId,token}=await isolatedOwner('LARGEGROUP');
  const second='largegroup-second';
  await db.prepare("INSERT INTO branches(id,tenant_id,name,status) VALUES(?,?,?,'active')").bind(second,tenantId,'Second').run();
  const product={id:'lg-product',tenantId,branchId,entityType:'product',entityId:'lg-p',action:'create',
    payload:{id:'lg-p',tenantId,branchId,name:'Carrot',currentStockKg:20,costPerKg:2,branchStock:{[branchId]:20}}};
  assert.equal((await call('/api/sync/push','POST',{tenantId,events:[product]},token)).status,200);
  const fill=async(prefix,n)=>db.prepare(`WITH RECURSIVE n(value) AS(SELECT 1 UNION ALL SELECT value+1 FROM n WHERE value<?)
    INSERT INTO sync_events_v2(id,tenant_id,entity_type,entity_id,action,payload_json,client_timestamp,server_timestamp)
    SELECT ?||value,?,'settings','settings','update','{}',0,0 FROM n`).bind(n,prefix,tenantId).run();
  await fill('lg-before-',198);
  const transfer=[
    {...product,id:'lg-from',action:'update',payload:{...product.payload,currentStockKg:17,branchStock:{[branchId]:17}}},
    {...product,id:'lg-to',branchId:second,entityId:'lg-q',payload:{...product.payload,id:'lg-q',branchId:second,currentStockKg:3,branchStock:{[second]:3}}},
    {id:'lg-transfer',branchId:null,entityType:'stock_transfer',entityId:'lg-transfer',action:'create',payload:{id:'lg-transfer',tenantId,
      scopedProducts:true,sourceProductId:'lg-p',destinationProductId:'lg-q',productId:'lg-p',fromBranchId:branchId,toBranchId:second,quantityKg:3}}
  ];
  for(const event of transfer)await db.prepare(`INSERT INTO sync_events_v2
    (id,tenant_id,branch_id,entity_type,entity_id,action,payload_json,client_timestamp,server_timestamp,group_id) VALUES(?,?,?,?,?,?,?,1,1,'lg-atomic')`)
    .bind(event.id,tenantId,event.branchId,event.entityType,event.entityId,event.action,JSON.stringify(event.payload)).run();
  await fill('lg-after-',1900);
  const proposed=attachConflictPreconditions({...product,id:'lg-local',payload:{...product.payload,name:'Local'}},{});
  const review=await (await call('/api/sync/conflicts','POST',{tenantId,events:[proposed]},token)).json();
  const item=(await (await call('/api/sync/conflicts?tenantId='+tenantId,'GET',undefined,token)).json()).reviews.find(row=>row.id===review.reviewId);
  const input={tenantId,reviewId:item.id,choice:'server',execute:true,expectedHeads:item.heads,checkpointProtocol:2};
  let response=await call('/api/sync/conflicts','PATCH',input,token);
  assert.equal(response.status,202,await response.clone().text());assert.equal((await response.json()).processedCount,199);
  let job=await db.prepare('SELECT * FROM sync_review_checkpoint_jobs WHERE tenant_id=?').bind(tenantId).first();
  assert.equal(JSON.parse(job.ledger_json).products[0].currentStockKg,20);
  response=await call('/api/sync/conflicts','PATCH',input,token);assert.equal(response.status,202);
  job=await db.prepare('SELECT * FROM sync_review_checkpoint_jobs WHERE tenant_id=?').bind(tenantId).first();
  const ledger=JSON.parse(job.ledger_json);
  assert.equal(ledger.products.find(row=>row.id==='lg-p').currentStockKg,17);
  assert.equal(ledger.products.find(row=>row.id==='lg-q').currentStockKg,3);assert.equal(ledger.stockTransfers.length,1);
  for(let step=0;step<30&&response.status===202;step++)response=await call('/api/sync/conflicts','PATCH',input,token);
  assert.equal(response.status,200,await response.clone().text());
  job=await db.prepare("SELECT * FROM sync_review_checkpoint_jobs WHERE tenant_id=? AND status='ready'").bind(tenantId).first();
  // Reuse the fully audited job only in a new pending review. A legacy source
  // changes MAX(sequence) without touching policy heads: the SQL claim itself
  // must reject it, not rely on a race-prone application read of those heads.
  const next={...proposed,id:'lg-next'};
  const nextReview=await (await call('/api/sync/conflicts','POST',{tenantId,events:[next]},token)).json();
  await fill('lg-race-',1);
  await assert.rejects(db.prepare(`INSERT INTO sync_review_resolutions
    (review_id,tenant_id,decided_by,choice,expected_heads_json,receipt_json) VALUES(?,?,?,'server',?,?)`)
    .bind(nextReview.reviewId,tenantId,tenantId,JSON.stringify(item.heads),JSON.stringify({checkpointJobId:job.id})).run(),/SYNC_REVIEW_STALE/);
  assert.equal(await db.prepare('SELECT * FROM sync_review_resolutions WHERE review_id=?').bind(nextReview.reviewId).first(),null);
});

test('legacy invoice dependency proof is branch-scoped and permits future sales without rewriting its old source',async()=>{
  const token=await login('REVIEW','review-owner',pass,'review-legacy-owner'),cashier=await login('REVIEW','review-cashier',pass,'review-legacy-cashier');
  const tenantId='REVIEW',branchId='review-main',payload={id:'legacy-proof-product',name:'Legacy carrot',currentStockKg:12,costPerKg:3};
  const oldInvoice={id:'legacy-proof-invoice',branchId,customerId:'walk_in',status:'active',finalTotal:27,paidAmount:27,remainingDebt:0,items:[{productId:payload.id,netWeight:3,pricePerKg:9}]};
  const sources=[{id:'legacy-proof-source',branch:null,type:'product',row:payload},{id:'legacy-proof-parent',branch:branchId,type:'invoice',row:oldInvoice}];
  for(const {id,branch,type,row} of sources)
    await db.prepare('INSERT INTO sync_events_v2(id,tenant_id,branch_id,entity_type,entity_id,action,payload_json,client_timestamp,server_timestamp) VALUES(?,?,?,?,?,\'create\',?,1,1)').bind(id,tenantId,branch,type,row.id,JSON.stringify(row)).run();
  const sourceBefore=await db.prepare('SELECT * FROM sync_events_v2 WHERE tenant_id=? AND id=?').bind(tenantId,'legacy-proof-source').first();
  const input={tenantId,references:[{parentId:'legacy-proof-parent',productId:payload.id}]};
  const response=await call('/api/sync/dependencies','POST',input,cashier);assert.equal(response.status,200);
  const proof=(await response.json()).proofs[0];assert.equal(proof.branchId,branchId);assert.equal(proof.source.payload.currentStockKg,12);
  assert.equal((await call('/api/sync/dependencies','POST',input,b)).status,403);
  const fresh=await (await call('/api/sync/pull?tenantId=REVIEW','GET',undefined,token)).json();
  const sale=attachConflictPreconditions({id:'proof-future-sale',tenantId,branchId,entityType:'invoice',entityId:'proof-future-sale',action:'create',payload:{...oldInvoice,id:'proof-future-sale',items:[{productId:payload.id,netWeight:1,pricePerKg:9}],finalTotal:9,paidAmount:9}},{...fresh.conflictHeads});
  const accepted=await call('/api/sync/push','POST',{tenantId,events:[sale]},cashier);assert.equal(accepted.status,200,await accepted.clone().text());
  assert.deepEqual(await db.prepare('SELECT * FROM sync_events_v2 WHERE tenant_id=? AND id=?').bind(tenantId,'legacy-proof-source').first(),sourceBefore);
});

test('independent offline sales obtain an audited rebase; stale edits and foreign tenants do not', async () => {
  const tenantId = 'REBASE', branchId = 'fixture-rebase-main';
  await db.prepare("INSERT INTO tenants(id,store_code,company_name,username,password_hash,status,role) VALUES('REBASE','REBASE','Rebase fixture','rebase-owner',?,'active','company_owner')")
    .bind(await hashPassword(pass)).run();
  await db.prepare("INSERT INTO branches(id,tenant_id,name,code,is_main,status) VALUES(?,'REBASE','Rebase branch','MAIN',1,'active')").bind(branchId).run();
  const b = await login('REBASE', 'rebase-owner', pass, 'rebase-fixture');
  const snapshot = await (await call('/api/sync/pull?tenantId=REBASE', 'GET', undefined, b)).json();
  const sale = id => attachConflictPreconditions({ id: `rebase-${id}`, tenantId, branchId,
    entityType: 'invoice', entityId: `rebase-invoice-${id}`, action: 'create', timestamp: Date.now(),
    payload: { id: `rebase-invoice-${id}`, branchId, status: 'active', customerId: 'walk_in',
      saleType: 'cash', finalTotal: 10, paidAmount: 10, items: [] }
  }, { ...snapshot.conflictHeads });
  const first = sale('first'), second = sale('second');
  assert.equal((await call('/api/sync/push', 'POST', { tenantId, events: [first] }, b)).status, 200);
  assert.equal((await call('/api/sync/push', 'POST', { tenantId, events: [second] }, b)).status, 409);
  const input = { tenantId, cursor: snapshot.nextCursor, events: [second] };
  const proposal = await call('/api/sync/rebase', 'POST', input, b);
  assert.equal(proposal.status, 200, await proposal.clone().text());
  const data = await proposal.json();
  assert.equal(data.protocol, 'independent-sales-v1');
  assert.deepEqual(data.events.map(event => event.id), [first.id]);
  assert.deepEqual(data.acceptedIds, []);
  assert.equal((await call('/api/sync/rebase', 'POST', input, a)).status, 403);
  assert.equal((await call('/api/sync/rebase', 'POST', { ...input, cursor: data.nextCursor + 1000 }, b)).status, 409);
  const forged = structuredClone(second);
  forged.preconditions['domain:inventory'] = 'invented-predecessor';
  assert.equal((await call('/api/sync/rebase', 'POST', { ...input, events: [forged] }, b)).status, 409);
  assert.equal((await call('/api/sync/rebase', 'POST', { ...input, events: [{ ...second, action: 'void' }] }, b)).status, 400);
  const collision = { ...second, id: first.id };
  assert.equal((await call('/api/sync/rebase', 'POST', { ...input, events: [collision] }, b)).status, 409);
  const rebased = attachConflictPreconditions(second, { ...data.conflictHeads });
  assert.deepEqual(rebased.payload, second.payload);
  assert.equal((await call('/api/sync/push', 'POST', { tenantId, events: [rebased] }, b)).status, 200);
  const retry = await call('/api/sync/rebase', 'POST', { ...input, events: [rebased] }, b);
  assert.equal(retry.status, 200);
  assert.deepEqual((await retry.json()).acceptedIds, [second.id]);
  await db.prepare("INSERT INTO branches(id,tenant_id,name,code,is_main,status) VALUES('rebase-hidden','REBASE','Hidden branch','HIDDEN',0,'active')").run();
  await db.prepare("INSERT INTO users(id,tenant_id,name,username,password_hash,role,status,branch_ids_json,permissions_json) VALUES('rebase-staff','REBASE','Cashier','rebase-staff',?,'cashier','active',?,'{}')")
    .bind(await hashPassword(pass), JSON.stringify([branchId])).run();
  const restricted = await login('REBASE', 'rebase-staff', pass, 'rebase-restricted');
  const fresh = await (await call('/api/sync/pull?tenantId=REBASE', 'GET', undefined, b)).json();
  const hidden = attachConflictPreconditions({ ...sale('hidden'), branchId: 'rebase-hidden',
    payload: { ...sale('hidden').payload, branchId: 'rebase-hidden', notes: 'private-hidden-branch' }
  }, { ...fresh.conflictHeads });
  assert.equal((await call('/api/sync/push', 'POST', { tenantId, events: [hidden] }, b)).status, 200);
  const scoped = await call('/api/sync/rebase', 'POST', { ...input, events: [sale('scoped')] }, restricted);
  assert.equal(scoped.status, 200, await scoped.clone().text());
  const scopedData = await scoped.json();
  assert.equal(JSON.stringify(scopedData.events).includes('private-hidden-branch'), false);
  assert.ok(scopedData.events.every(event => event.branchId === branchId));
  assert.equal((await call('/api/sync/rebase', 'POST', { ...input, events: [hidden] }, restricted)).status, 403);
  const edit = { id: 'rebase-product-edit', entityType: 'product', entityId: 'rebase-product', action: 'update',
    branchId, payload: { id: 'rebase-product', branchId, stock: 50 } };
  assert.equal((await call('/api/sync/push', 'POST', { tenantId, events: [edit] }, b)).status, 200);
  assert.equal((await call('/api/sync/rebase', 'POST', { ...input, events: [sale('third')] }, b)).status, 409);
});

test('schema bootstrap and numbered migrations produce identical database structures', async () => {
  const bootstrap=await mf.getD1Database('BOOTSTRAP');
  const sql=(await readFile('d1/schema.sql','utf8')).replace(/--[^\n]*/g,'');
  for(const statement of sql.match(/\s*CREATE TRIGGER[\s\S]*?END;|[^;]+;/gi) || []) {
    if(statement.trim()) await bootstrap.prepare(statement).run();
  }
  const schema="SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type,name";
  const normalize=result=>result.results.map(row=>({...row,sql:row.sql?.replace(/\s+/g,' ').trim()}));
  assert.deepEqual(normalize(await bootstrap.prepare(schema).all()),normalize(await db.prepare(schema).all()));
});
test('unsigned legacy drawer writes cannot bypass signed replay', async () => {
  const payload={id:'unsigned-shift',tenantId:'A',branchId:'fixture-a-main',drawerId:'unsigned-drawer',actorId:'A',
    offlineDeviceId:'unsigned-device',openingCash:100,timeZone:'Asia/Riyadh',
    openedAt:new Date().toISOString(),accountingDate:accountingDate(new Date().toISOString(),'Asia/Riyadh'),status:'open'};
  await db.prepare("INSERT INTO cash_drawers(id,tenant_id,branch_id,name) VALUES('unsigned-drawer','A','fixture-a-main','Unsigned fixture')").run();
  for (const path of ['/api/cash/shifts','/api/cash/shifts/close']) {
    const result=await call(path,'POST',{...payload,deviceProof:deviceProof(),shiftId:payload.id,deviceId:payload.offlineDeviceId,
      pendingEventCount:0,confirmedMovementCount:0,countedCash:100},a);
    assert.equal(result.status,403,await result.text());
  }
  const event={id:'unsigned-source',entityType:'cash_shift',entityId:payload.id,action:'create',payload,
    branchId:payload.branchId,timestamp:Date.now()};
  const result=await call('/api/sync/push','POST',{tenantId:'A',events:[event]},a);
  assert.equal(result.status,403,await result.text());
  assert.equal(await db.prepare("SELECT id FROM cash_shifts WHERE id='unsigned-shift'").first(),null);
});

for(const production of [false,true])test(`${production?'production compatibility':'staged'} sync rejects malformed invoice voids without committing sources or advancing heads`,async()=>{
  const {tenantId,branchId,token}=await isolatedOwner(`VOIDPOLICY-${production?'PROD':'STAGED'}`),id=`void-policy-invoice-${production}`;
  const created={id:`void-policy-create-${production}`,entityType:'invoice',entityId:id,action:'create',branchId,
    payload:{id,tenantId,branchId,status:'active',saleType:'bank',paidAmount:20,finalTotal:20,items:[]},timestamp:Date.now()};
  assert.equal((await call('/api/sync/push','POST',{tenantId,events:[created]},token,'local',true,null,production)).status,200);
  const heads=await db.prepare('SELECT conflict_key,last_event_id FROM sync_conflict_heads WHERE tenant_id=? ORDER BY conflict_key').bind(tenantId).all();
  let index=0;
  for(const payload of [{id},{id,status:'active'},{id,status:'voided',finalTotal:999},{id,status:'voided',items:[]}]) {
    const event={id:`void-policy-invalid-${production}-${index++}`,entityType:'invoice',entityId:id,action:'void',branchId,payload,timestamp:Date.now()};
    const result=await call('/api/sync/push','POST',{tenantId,events:[event]},token,'local',true,null,production);
    assert.equal(result.status,400,await result.text());
    assert.equal(await db.prepare('SELECT id FROM sync_events_v2 WHERE tenant_id=? AND id=?').bind(tenantId,event.id).first(),null);
    assert.deepEqual((await db.prepare('SELECT conflict_key,last_event_id FROM sync_conflict_heads WHERE tenant_id=? ORDER BY conflict_key').bind(tenantId).all()).results,heads.results);
  }
});

test('signed cash commit rechecks active drawer scope and rolls back an intervening scope change',async()=>{
  const tenantId='COMMITAUTH',branchId='commit-auth-main',drawerId='commit-auth-drawer';
  await db.prepare("INSERT INTO tenants(id,store_code,company_name,username,password_hash,status,role) VALUES(?,?,?,?,?,'active','company_owner')")
    .bind(tenantId,tenantId,'Commit auth fixture','commit-auth-owner',await hashPassword(pass)).run();
  for(const id of [branchId,'commit-auth-other'])await db.prepare("INSERT INTO branches(id,tenant_id,name,is_main,status) VALUES(?,?,?,?,'active')")
    .bind(id,tenantId,id,id===branchId?1:0).run();
  await db.prepare('INSERT INTO cash_drawers(id,tenant_id,branch_id,name) VALUES(?,?,?,?)').bind(drawerId,tenantId,branchId,'Commit auth drawer').run();
  const token=await login(tenantId,'commit-auth-owner'),fixture=await signedCashFixture(tenantId,token,[{id:drawerId,branchId}]);
  let index=0;
  for(const change of ["status='inactive'","branch_id='commit-auth-other'"]) {
    const at=new Date(Math.max(Date.now(),Date.parse(fixture.grant.claims.onlineVerifiedAt))).toISOString();
    const id=`commit-auth-shift-${index++}`,sourceId=`commit-auth-source-${index}`;
    // D1 trigger injects a change after API reads, inside the actual batch.
    // Only the production commit-time guard can reject and roll back all rows.
    await db.prepare(`CREATE TRIGGER fixture_drawer_scope_change BEFORE INSERT ON sync_events_v2
      WHEN NEW.tenant_id='COMMITAUTH' BEGIN UPDATE cash_drawers SET ${change} WHERE id='commit-auth-drawer'; END;`).run();
    try {
      const result=await fixture.push({tenantId,events:[fixture.source(sourceId,'cash_shift',{
        id,tenantId,branchId,drawerId,actorId:tenantId,offlineDeviceId:fixture.deviceId,openingCash:100,
        timeZone:'Asia/Riyadh',openedAt:at,accountingDate:accountingDate(at,'Asia/Riyadh'),status:'open'})]});
      assert.equal(result.status,403,await result.text());
      assert.equal(await db.prepare('SELECT id FROM cash_shifts WHERE id=?').bind(id).first(),null);
      assert.equal(await db.prepare('SELECT id FROM sync_events_v2 WHERE tenant_id=? AND id=?').bind(tenantId,sourceId).first(),null);
      assert.equal(await db.prepare('SELECT event_id FROM cash_source_proofs WHERE tenant_id=? AND event_id=?').bind(tenantId,sourceId).first(),null);
      assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM sync_conflict_heads WHERE tenant_id=?').bind(tenantId).first()).n,0);
      assert.deepEqual(await db.prepare('SELECT branch_id,status FROM cash_drawers WHERE id=?').bind(drawerId).first(),{branch_id:branchId,status:'active'});
    } finally {await db.prepare('DROP TRIGGER fixture_drawer_scope_change').run();}
  }
});

for(const production of [false,true])test(`${production?'production compatibility':'staged'} invoice update permits notes only, not financial rewrites`,async()=>{
  const {tenantId,branchId,token}=await isolatedOwner(`SALEPOLICY-${production?'PROD':'STAGED'}`),id=`immutable-sale-${production}`;
  const event=(eventId,payload,action='update')=>({id:eventId,entityType:'invoice',entityId:id,branchId,action,payload,timestamp:Date.now()});
  const send=events=>call('/api/sync/push','POST',{tenantId,events},token,'local',true,null,production);
  assert.equal((await send([event(`immutable-sale-create-${production}`,{id,tenantId,branchId,status:'active',saleType:'bank',paidAmount:20,finalTotal:20,remainingDebt:0,items:[]},'create')])).status,200);
  const readHeads=async()=>(await db.prepare('SELECT conflict_key,last_event_id FROM sync_conflict_heads WHERE tenant_id=? ORDER BY conflict_key').bind(tenantId).all()).results;
  const before=await readHeads();
  for(const [index,changes] of [{finalTotal:99},{paidAmount:999},{remainingDebt:99},{items:[]},{status:'voided'},{customerId:'another'}, {notes:42}].entries()) {
    const invalid=event(`immutable-sale-edit-${production}-${index}`,{id,...changes});
    const result=await send([invalid]);
    assert.equal(result.status,400,await result.text());
    assert.equal(await db.prepare('SELECT id FROM sync_events_v2 WHERE tenant_id=? AND id=?').bind(tenantId,invalid.id).first(),null);
    assert.deepEqual(await readHeads(),before);
  }
  const notes=event(`immutable-sale-notes-${production}`,{id,notes:'Approved note only'});
  assert.equal((await send([notes])).status,200);
  assert.equal((await send([notes])).status,200,'identical note retry remains idempotent');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM sync_events_v2 WHERE tenant_id=? AND id=?').bind(tenantId,notes.id).first()).n,1);
});

test('cash drawers isolate branches and reject competing open shifts', async () => {
  await db.prepare("INSERT INTO tenants(id,store_code,company_name,username,password_hash,status,role) VALUES('DRAWERS','DRAWERS','Drawer fixture','drawerowner',?,'active','company_owner')").bind(await hashPassword(pass)).run();
  await db.prepare("INSERT INTO branches(id,tenant_id,name,is_main,status) VALUES('drawers-main','DRAWERS','Main',1,'active')").run();
  const owner=await login('DRAWERS','drawerowner');
  const drawerResponse=await call('/api/cash/drawers','POST',{tenantId:'DRAWERS',branchId:'drawers-main',id:'drawer-a-1',name:'درج أول'},owner);
  assert.equal(drawerResponse.status,201,await drawerResponse.text());
  const otherResponse=await call('/api/cash/drawers','POST',{tenantId:'DRAWERS',branchId:'drawers-main',id:'drawer-a-2',name:'درج ثان'},owner);
  assert.equal(otherResponse.status,201,await otherResponse.text());
  const thirdDrawer=await call('/api/cash/drawers','POST',{tenantId:'DRAWERS',branchId:'drawers-main',id:'drawer-a-3',name:'درج ثالث'},owner);
  assert.equal(thirdDrawer.status,201,await thirdDrawer.text());
  const fixture=await signedCashFixture('DRAWERS',owner,[1,2,3].map(i=>({id:`drawer-a-${i}`,branchId:'drawers-main'})));
  const unlinked={id:'unlinked-cash-source',entityType:'expense',entityId:'unlinked-cash-row',action:'create',
    branchId:'drawers-main',payload:{id:'unlinked-cash-row',branchId:'drawers-main',amount:10,paymentMethod:'cash'}};
  const bypass=await call('/api/sync/push','POST',{tenantId:'DRAWERS',events:[unlinked]},owner);
  assert.equal(bypass.status,403,await bypass.text());
  assert.equal(await db.prepare("SELECT id FROM sync_events_v2 WHERE tenant_id='DRAWERS' AND id='unlinked-cash-source'").first(),null);
  const bank={...unlinked,id:'managed-bank-source',entityId:'managed-bank-row',conflictPolicyVersion:undefined,preconditions:undefined,
    payload:{...unlinked.payload,id:'managed-bank-row',paymentMethod:'bank'}};
  assert.equal((await call('/api/sync/push','POST',{tenantId:'DRAWERS',events:[bank]},owner)).status,200);
  const changed={...bank,id:'managed-cash-edit',action:'update',conflictPolicyVersion:undefined,preconditions:undefined,
    payload:{id:bank.entityId,branchId:'drawers-main',amount:15,paymentMethod:'cash'}};
  const unsafeUpdate=await call('/api/sync/push','POST',{tenantId:'DRAWERS',events:[changed]},owner);
  assert.equal(unsafeUpdate.status,403,await unsafeUpdate.text());
  assert.equal(await db.prepare("SELECT id FROM sync_events_v2 WHERE tenant_id='DRAWERS' AND id='managed-cash-edit'").first(),null);
  const at=new Date(Math.max(Date.now(),Date.parse(fixture.grant.claims.onlineVerifiedAt))).toISOString();
  const open={tenantId:'DRAWERS',branchId:'drawers-main',drawerId:'drawer-a-1',id:'cash-shift-a-1',actorId:'DRAWERS',
    offlineDeviceId:fixture.deviceId,openingCash:100,timeZone:'Asia/Riyadh',openedAt:at,accountingDate:accountingDate(at,'Asia/Riyadh'),status:'open'};
  const pushOpen=payload=>fixture.push({tenantId:'DRAWERS',events:[fixture.source(`source-${payload.id}`,'cash_shift',payload)]});
  const first=await pushOpen(open);
  assert.equal(first.status,200,await first.text());
  const duplicate=await pushOpen({...open,id:'cash-shift-a-2'});
  assert.equal(duplicate.status,409,await duplicate.text());
  const second=await pushOpen({...open,id:'cash-shift-a-3',drawerId:'drawer-a-2'});
  assert.equal(second.status,200,await second.text());
  const racing=await Promise.all([
    pushOpen({...open,id:'cash-shift-race-1',drawerId:'drawer-a-3'}),
    pushOpen({...open,id:'cash-shift-race-2',drawerId:'drawer-a-3'})
  ]);
  assert.deepEqual(racing.map(response=>response.status).sort(),[200,409]);
  const foreign=await fixture.push({tenantId:'B',events:[fixture.source('foreign-open-source','cash_shift',{
    ...open,tenantId:'B',branchId:'fixture-b-main',id:'cash-shift-b-1'})]});
  assert.equal(foreign.status,403,await foreign.text());
  const rows=await call('/api/cash/shifts?tenantId=DRAWERS&branchId=drawers-main','GET',undefined,owner);
  assert.equal(rows.status,200,await rows.clone().text());
  assert.equal((await rows.json()).shifts.length,3);
});
test('synced cash sale is attributed once to its open shift from the financial source', async () => {
  await db.prepare("INSERT INTO tenants(id,store_code,company_name,username,password_hash,status,role) VALUES('CASH','CASH','Cash fixture','cashowner',?,'active','company_owner')")
    .bind(await hashPassword(pass)).run();
  await db.prepare("INSERT INTO branches(id,tenant_id,name,code,is_main,status) VALUES('cash-branch','CASH','Cash branch','CASH',1,'active')").run();
  await db.prepare("INSERT INTO cash_drawers(id,tenant_id,branch_id,name) VALUES('cash-drawer','CASH','cash-branch','Cash drawer')").run();
  const cashOwner=await login('CASH','cashowner',pass,'cash-owner-fixture');
  const fixture=await signedCashFixture('CASH',cashOwner,[{id:'cash-drawer',branchId:'cash-branch'}]);
  const at=new Date(Math.max(Date.now(),Date.parse(fixture.grant.claims.onlineVerifiedAt))).toISOString();
  const openInput={tenantId:'CASH',branchId:'cash-branch',drawerId:'cash-drawer',id:'cash-shift',actorId:'CASH',
    offlineDeviceId:fixture.deviceId,openingCash:100,timeZone:'Asia/Riyadh',openedAt:at,accountingDate:accountingDate(at,'Asia/Riyadh'),status:'open'};
  const openBody={tenantId:'CASH',events:[fixture.source('cash-open-source','cash_shift',openInput)]};
  const opened=await fixture.push(openBody);
  assert.equal(opened.status,200,await opened.clone().text());
  const listed=await call('/api/cash/shifts?tenantId=CASH&branchId=cash-branch','GET',undefined,cashOwner);
  assert.equal(listed.status,200);
  assert.equal(JSON.stringify(await listed.json()).includes('device_proof_hash'),false);
  assert.equal((await fixture.push(openBody)).status,200);
  const event={id:'cash-sale-event-1',entityType:'invoice',entityId:'cash-sale-1',action:'create',branchId:'cash-branch',timestamp:Date.parse(at)+1,
    payload:{id:'cash-sale-1',tenantId:'CASH',branchId:'cash-branch',cashShiftId:'cash-shift',saleType:'cash',
      paidAmount:20,finalTotal:20,status:'active',customerId:'walk_in',items:[]}};
  const body={tenantId:'CASH',branchId:'cash-branch',events:[event]};
  const pushed=await fixture.push(body);
  assert.equal(pushed.status,200,await pushed.text());
  const movement=await db.prepare('SELECT amount_cents,shift_id FROM cash_shift_movements WHERE tenant_id=? AND source_event_id=?')
    .bind('CASH',event.id).first();
  assert.deepEqual(movement,{amount_cents:2000,shift_id:'cash-shift'});
  assert.equal((await fixture.push(body)).status,200);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM cash_shift_movements WHERE tenant_id=? AND source_event_id=?')
    .bind('CASH',event.id).first()).n,1);
  const wrong={...event,id:'cash-sale-event-wrong',entityId:'cash-sale-wrong',payload:{...event.payload,id:'cash-sale-wrong',cashShiftId:'missing-shift'}};
  Reflect.deleteProperty(wrong,'conflictPolicyVersion');
  Reflect.deleteProperty(wrong,'preconditions');
  const denied=await fixture.push({tenantId:'CASH',branchId:'cash-branch',events:[wrong]});
  assert.equal(denied.status,403,await denied.text());
  const otherCashier={...event,id:'cash-sale-event-staff',entityId:'cash-sale-staff',payload:{...event.payload,id:'cash-sale-staff'}};
  Reflect.deleteProperty(otherCashier,'conflictPolicyVersion');
  Reflect.deleteProperty(otherCashier,'preconditions');
  await db.prepare("INSERT INTO users(id,tenant_id,name,username,password_hash,role,status,branch_id,permissions_json) VALUES('cash-shift-staff','CASH','Shift cashier','shiftcashier',?,'cashier','active','cash-branch','{}')")
    .bind(await hashPassword(pass)).run();
  try {
    const staffToken=await login('CASH','shiftcashier',pass,'cash-staff-fixture');
    const forbidden=await call('/api/sync/push','POST',{tenantId:'CASH',branchId:'cash-branch',events:[otherCashier]},staffToken);
    assert.equal(forbidden.status,403,await forbidden.text());
  } finally {
    await db.prepare("DELETE FROM sessions WHERE principal_id='cash-shift-staff'").run();
    await db.prepare("DELETE FROM users WHERE id='cash-shift-staff'").run();
  }
  const voidBase={entityType:'invoice',entityId:'cash-sale-1',action:'void',branchId:'cash-branch',timestamp:Date.now(),
    payload:{id:'cash-sale-1',status:'voided'}};
  const missingShift=await call('/api/sync/push','POST',{tenantId:'CASH',branchId:'cash-branch',events:[{...voidBase,id:'cash-void-no-shift'}]},cashOwner);
  assert.equal(missingShift.status,400,await missingShift.text());
  const voidEvent={...voidBase,id:'cash-void-event-1',payload:{...voidBase.payload,cashShiftId:'cash-shift'}};
  const voidBody={tenantId:'CASH',branchId:'cash-branch',events:[voidEvent]};
  const voided=await fixture.push(voidBody);
  assert.equal(voided.status,200,await voided.text());
  assert.deepEqual(await db.prepare('SELECT amount_cents,reverses_source_event_id FROM cash_shift_movements WHERE tenant_id=? AND source_event_id=?')
    .bind('CASH',voidEvent.id).first(),{amount_cents:-2000,reverses_source_event_id:event.id});
  assert.equal((await fixture.push(voidBody)).status,200);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM cash_shift_movements WHERE tenant_id=? AND source_event_id=?')
    .bind('CASH',voidEvent.id).first()).n,1);
  const repeatedVoid={...voidBase,id:'cash-void-event-2',payload:{...voidBase.payload,cashShiftId:'cash-shift'}};
  const doubleReverse=await fixture.push({tenantId:'CASH',branchId:'cash-branch',events:[repeatedVoid]});
  assert.equal(doubleReverse.status,409,await doubleReverse.text());
  const newSale={...event,id:'cash-sale-event-batch',entityId:'cash-sale-batch',payload:{...event.payload,id:'cash-sale-batch'}};
  Reflect.deleteProperty(newSale,'conflictPolicyVersion');
  Reflect.deleteProperty(newSale,'preconditions');
  const sameBatchVoid={...voidBase,id:'cash-void-batch',entityId:'cash-sale-batch',payload:{id:'cash-sale-batch',status:'voided'}};
  const batchWithoutShift=await fixture.push({tenantId:'CASH',branchId:'cash-branch',events:[newSale,sameBatchVoid]});
  assert.equal(batchWithoutShift.status,400,await batchWithoutShift.text());
  const close=fixture.source('cash-close-source','cash_shift',{...openInput,status:'closed_local',
    closedAt:new Date().toISOString(),closedBy:'CASH',countedCash:98,expectedCash:100,variance:-2},'update');
  const closing=await fixture.push({tenantId:'CASH',events:[close]});
  assert.equal(closing.status,200,await closing.clone().text());
  assert.deepEqual(await db.prepare("SELECT expected_cash_cents,variance_cents FROM cash_shifts WHERE id='cash-shift'").first(),
    {expected_cash_cents:10000,variance_cents:-200});
  assert.equal((await fixture.push({tenantId:'CASH',events:[close]})).status,200);
  assert.equal((await fixture.push(body)).status,200);
  assert.equal((await fixture.push(voidBody)).status,200);
  const lateSale={...event,id:'cash-sale-after-close',entityId:'cash-sale-after-close',payload:{...event.payload,id:'cash-sale-after-close'}};
  Reflect.deleteProperty(lateSale,'conflictPolicyVersion');
  Reflect.deleteProperty(lateSale,'preconditions');
  const late=await fixture.push({tenantId:'CASH',branchId:'cash-branch',events:[lateSale]});
  assert.equal(late.status,400,await late.text());
  const next=await fixture.push({tenantId:'CASH',events:[fixture.source('cash-next-source','cash_shift',{
    ...openInput,id:'cash-shift-next',openingCash:98,openedAt:new Date().toISOString()})]});
  assert.equal(next.status,200,await next.text());
});
test('cash shift replay rejects a drawer owned by another tenant without writing state', async () => {
  await db.prepare("INSERT INTO cash_drawers(id,tenant_id,branch_id,name) VALUES('foreign-replay-drawer','B','fixture-b-main','Foreign drawer')").run();
  const at = new Date().toISOString();
  const event = { id: 'foreign-drawer-replay', entityType: 'cash_shift', entityId: 'foreign-drawer-shift', action: 'create',
    branchId: 'fixture-a-main', timestamp: Date.parse(at), payload: { id: 'foreign-drawer-shift', tenantId: 'A',
      branchId: 'fixture-a-main', drawerId: 'foreign-replay-drawer', actorId: 'A', offlineDeviceId: 'unverified-device',
      timeZone: 'Asia/Riyadh', accountingDate: accountingDate(at, 'Asia/Riyadh'), openedAt: at, openingCash: 100, events: [], status: 'open' } };
  const response = await call('/api/sync/push', 'POST', { tenantId: 'A', events: [event] }, a);
  assert.equal(response.status, 403, await response.text());
  assert.equal(await db.prepare("SELECT id FROM cash_shifts WHERE id='foreign-drawer-shift'").first(), null);
  assert.equal(await db.prepare("SELECT id FROM sync_events_v2 WHERE tenant_id='A' AND id='foreign-drawer-replay'").first(), null);
});

test('offline cash shift events replay through sync preserving actor and order', async () => {
  await db.prepare("INSERT INTO tenants(id,store_code,company_name,username,password_hash,status,role) VALUES('SHIFT','SHIFT','Shift fixture','shiftowner',?,'active','company_owner')")
    .bind(await hashPassword(pass)).run();
  await db.prepare("INSERT INTO branches(id,tenant_id,name,code,is_main,status) VALUES('shift-main','SHIFT','Shift main','SHIFT',1,'active')").run();
  await db.prepare("INSERT INTO cash_drawers(id,tenant_id,branch_id,name) VALUES('drawer-1','SHIFT','shift-main','Drawer')").run();
  const owner = await login('SHIFT', 'shiftowner', pass, 'shift-owner-fixture');
  const fixture=await signedCashFixture('SHIFT',owner,[{id:'drawer-1',branchId:'shift-main'}],'device-1');
  const at=new Date(Math.max(Date.now(),Date.parse(fixture.grant.claims.onlineVerifiedAt))).toISOString();
  const shiftBase = {
    tenantId: 'SHIFT', branchId: 'shift-main', drawerId: 'drawer-1', actorId: 'SHIFT',
    offlineDeviceId: 'device-1', timeZone: 'Asia/Riyadh', accountingDate: accountingDate(at, 'Asia/Riyadh'),
    openedAt: at, openingCash: 100
  };
  const openEvent = { id: 'cash-shift-open-1', entityType: 'cash_shift', entityId: 'shift-1', action: 'create',
    branchId: 'shift-main', timestamp: Date.parse(at), payload: { ...shiftBase, id: 'shift-1', events: [], status: 'open' } };
  const body = { tenantId: 'SHIFT', branchId: 'shift-main', events: [openEvent] };
  const pushed = await fixture.push(body);
  assert.equal(pushed.status, 200, await pushed.text());
  assert.ok(await db.prepare("SELECT id FROM sync_events_v2 WHERE tenant_id='SHIFT' AND id='cash-shift-open-1'").first());
  assert.equal((await fixture.push(body)).status, 200);
  assert.deepEqual(await db.prepare("SELECT opening_cash_cents, status FROM cash_shifts WHERE id='shift-1'").first(),
    { opening_cash_cents: 10000, status: 'open' });
  const closeEvent = { id: 'cash-shift-close-1', entityType: 'cash_shift', entityId: 'shift-1', action: 'update',
    branchId: 'shift-main', timestamp: Math.max(Date.now(),Date.parse(at)), payload: { ...shiftBase, id: 'shift-1', events: [], status: 'closed_local',
      closedAt: new Date().toISOString(), closedBy: 'SHIFT', countedCash: 100, expectedCash: 100, variance: 0 } };
  assert.equal((await fixture.push({ tenantId: 'SHIFT', branchId: 'shift-main', events: [closeEvent] })).status, 200);
  assert.deepEqual(await db.prepare("SELECT status, counted_cash_cents, expected_cash_cents, variance_cents FROM cash_shifts WHERE id='shift-1'").first(),
    { status: 'closed', counted_cash_cents: 10000, expected_cash_cents: 10000, variance_cents: 0 });
  const wrongActor = { ...openEvent, id: 'cash-shift-open-2', payload: { ...openEvent.payload, actorId: 'someone-else' } };
  Reflect.deleteProperty(wrongActor, 'conflictPolicyVersion');
  Reflect.deleteProperty(wrongActor, 'preconditions');
  assert.equal((await call('/api/sync/push', 'POST', { tenantId: 'SHIFT', branchId: 'shift-main', events: [wrongActor] }, owner)).status, 403);
  assert.equal((await call('/api/sync/push', 'POST', { tenantId: 'B', branchId: 'fixture-b-main', events: [openEvent] }, owner)).status, 403);
  const pulled = await call('/api/sync/pull?tenantId=SHIFT&cursor=0', 'GET', undefined, owner).then(r => r.json());
  assert.deepEqual(pulled.events.map(e => [e.id, e.action]), [['cash-shift-open-1', 'create'], ['cash-shift-close-1', 'update']]);
});

test('server reconciles replayed cash movements when closing a shift', async () => {
  await db.prepare("INSERT INTO tenants(id,store_code,company_name,username,password_hash,status,role) VALUES('RECON','RECON','Recon fixture','reconowner',?,'active','company_owner')")
    .bind(await hashPassword(pass)).run();
  await db.prepare("INSERT INTO branches(id,tenant_id,name,code,is_main,status) VALUES('recon-main','RECON','Recon main','RECON',1,'active')").run();
  await db.prepare("INSERT INTO cash_drawers(id,tenant_id,branch_id,name) VALUES('drawer-recon','RECON','recon-main','Drawer')").run();
  const owner = await login('RECON', 'reconowner', pass, 'recon-owner-fixture');
  const fixture=await signedCashFixture('RECON',owner,[{id:'drawer-recon',branchId:'recon-main'}],'device-1');
  const at=new Date(Math.max(Date.now(),Date.parse(fixture.grant.claims.onlineVerifiedAt))).toISOString();
  const shiftBase = { tenantId: 'RECON', branchId: 'recon-main', drawerId: 'drawer-recon', actorId: 'RECON',
    offlineDeviceId: 'device-1', timeZone: 'Asia/Riyadh', accountingDate: accountingDate(at, 'Asia/Riyadh'),
    openedAt: at, openingCash: 100 };
  const openEvent = { id: 'recon-open', entityType: 'cash_shift', entityId: 'recon-shift', action: 'create',
    branchId: 'recon-main', timestamp: Date.parse(at), payload: { ...shiftBase, id: 'recon-shift', events: [], status: 'open' } };
  assert.equal((await fixture.push({ tenantId: 'RECON', branchId: 'recon-main', events: [openEvent] })).status, 200);

  const invoice = { id: 'recon-sale', entityType: 'invoice', entityId: 'recon-sale', action: 'create',
    branchId: 'recon-main', timestamp: Math.max(Date.now(),Date.parse(at)) + 1,
    payload: { id: 'recon-sale', tenantId: 'RECON', branchId: 'recon-main', cashShiftId: 'recon-shift',
      saleType: 'cash', paidAmount: 20, finalTotal: 20, status: 'active', customerId: 'walk_in', items: [] } };
  assert.equal((await fixture.push({ tenantId: 'RECON', branchId: 'recon-main', events: [invoice] })).status, 200);
  assert.deepEqual(await db.prepare("SELECT amount_cents FROM cash_shift_movements WHERE tenant_id='RECON' AND source_event_id='recon-sale'").first(),
    { amount_cents: 2000 });

  const closeGood = { id: 'recon-close', entityType: 'cash_shift', entityId: 'recon-shift', action: 'update',
    branchId: 'recon-main', timestamp: Math.max(Date.now(),Date.parse(at)) + 2,
    payload: { ...shiftBase, id: 'recon-shift', events: [], status: 'closed_local', closedAt: new Date().toISOString(),
      closedBy: 'RECON', countedCash: 118, expectedCash: 120, variance: -2 } };
  assert.equal((await fixture.push({ tenantId: 'RECON', branchId: 'recon-main', events: [closeGood] })).status, 200);
  assert.deepEqual(await db.prepare("SELECT status, counted_cash_cents, expected_cash_cents, variance_cents FROM cash_shifts WHERE id='recon-shift'").first(),
    { status: 'closed', counted_cash_cents: 11800, expected_cash_cents: 12000, variance_cents: -200 });

  const openB = { ...openEvent, id: 'recon-open-b', entityId: 'recon-shift-b', payload: { ...shiftBase, id: 'recon-shift-b', events: [], status: 'open' } };
  Reflect.deleteProperty(openB, 'conflictPolicyVersion');
  Reflect.deleteProperty(openB, 'preconditions');
  const openBResponse = await fixture.push({ tenantId: 'RECON', branchId: 'recon-main', events: [openB] });
  assert.equal(openBResponse.status, 200, await openBResponse.clone().text());
  const closeWrong = { ...closeGood, id: 'recon-close-b', entityId: 'recon-shift-b',
    payload: { ...shiftBase, id: 'recon-shift-b', events: [], status: 'closed_local', closedAt: new Date().toISOString(),
      closedBy: 'RECON', countedCash: 100, expectedCash: 150, variance: -50 } };
  Reflect.deleteProperty(closeWrong, 'conflictPolicyVersion');
  Reflect.deleteProperty(closeWrong, 'preconditions');
  assert.equal((await fixture.push({ tenantId: 'RECON', branchId: 'recon-main', events: [closeWrong] })).status, 409);
});

test('one offline commit group replays open sale close next-open and retries without duplicating cash', async () => {
  await db.prepare("INSERT INTO tenants(id,store_code,company_name,username,password_hash,status,role) VALUES('CHAIN','CHAIN','Chain fixture','chainowner',?,'active','company_owner')")
    .bind(await hashPassword(pass)).run();
  await db.prepare("INSERT INTO branches(id,tenant_id,name,code,is_main,status) VALUES('chain-main','CHAIN','Chain main','CHAIN',1,'active')").run();
  await db.prepare("INSERT INTO cash_drawers(id,tenant_id,branch_id,name) VALUES('chain-drawer','CHAIN','chain-main','Chain drawer')").run();
  const owner = await login('CHAIN', 'chainowner', pass, 'chain-owner-fixture');
  const fixture=await signedCashFixture('CHAIN',owner,[{id:'chain-drawer',branchId:'chain-main'}],'chain-device');
  const at = new Date(Math.max(Date.now(),Date.parse(fixture.grant.claims.onlineVerifiedAt))).toISOString(), groupId = crypto.randomUUID();
  const shift = { id: 'chain-shift-1', tenantId: 'CHAIN', branchId: 'chain-main', drawerId: 'chain-drawer', actorId: 'CHAIN',
    offlineDeviceId: 'chain-device', timeZone: 'Asia/Riyadh', accountingDate: accountingDate(at, 'Asia/Riyadh'),
    openedAt: at, openingCash: 100, events: [], status: 'open' };
  const base = { groupId, branchId: 'chain-main', timestamp: Date.parse(at) };
  const events = [
    { ...base, id: 'chain-open-1', entityType: 'cash_shift', entityId: shift.id, action: 'create', payload: shift },
    { ...base, id: 'chain-sale', entityType: 'invoice', entityId: 'chain-invoice', action: 'create',
      payload: { id: 'chain-invoice', tenantId: 'CHAIN', branchId: 'chain-main', cashShiftId: shift.id,
        saleType: 'cash', paidAmount: 27, finalTotal: 27, status: 'active', customerId: 'walk_in', items: [] } },
    { ...base, id: 'chain-close', entityType: 'cash_shift', entityId: shift.id, action: 'update', payload: {
      ...shift, status: 'closed_local', closedAt: at, closedBy: 'CHAIN', countedCash: 127, expectedCash: 127, variance: 0 } },
    { ...base, id: 'chain-open-2', entityType: 'cash_shift', entityId: 'chain-shift-2', action: 'create', payload: {
      ...shift, id: 'chain-shift-2', openingCash: 127 } }
  ];
  const body = { tenantId: 'CHAIN', events };
  const incomplete = structuredClone(body);
  incomplete.events[2].payload.expectedCash = 100;
  const rejected = await fixture.push(incomplete);
  assert.equal(rejected.status, 409, await rejected.text());
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM cash_shifts WHERE tenant_id='CHAIN'").first()).n, 0);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM sync_events_v2 WHERE tenant_id='CHAIN'").first()).n, 0);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM cash_shift_movements WHERE tenant_id='CHAIN'").first()).n, 0);
  const first = await fixture.push(body);
  assert.equal(first.status, 200, await first.text());
  const replay = await fixture.push(body);
  assert.equal(replay.status, 200, await replay.text());
  assert.deepEqual(await db.prepare("SELECT status,expected_cash_cents,counted_cash_cents FROM cash_shifts WHERE id='chain-shift-1'").first(),
    { status: 'closed', expected_cash_cents: 12700, counted_cash_cents: 12700 });
  assert.equal((await db.prepare("SELECT status FROM cash_shifts WHERE id='chain-shift-2'").first()).status, 'open');
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM cash_shift_movements WHERE tenant_id='CHAIN'").first()).n, 1);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM sync_events_v2 WHERE tenant_id='CHAIN'").first()).n, 4);
});

test('offline cashier grant is login-bound, device-bound, and server-signed', async () => {
  await db.prepare("INSERT INTO tenants(id,store_code,company_name,username,password_hash,status,role) VALUES('GRANT','GRANT','Grant fixture','grantowner',?,'active','company_owner')")
    .bind(await hashPassword(pass)).run();
  await db.prepare("INSERT INTO branches(id,tenant_id,name,code,is_main,status) VALUES('grant-main','GRANT','Grant main','GRANT',1,'active')").run();
  await db.prepare("INSERT INTO branches(id,tenant_id,name,code,is_main,status) VALUES('grant-second','GRANT','Grant second','G2',0,'active')").run();
  await db.prepare("INSERT INTO users(id,tenant_id,name,username,password_hash,role,status,branch_ids_json,permissions_json) VALUES('grant-cashier','GRANT','Grant cashier','grantcashier',?,'cashier','active',?,'{}')")
    .bind(await hashPassword(pass), JSON.stringify(['grant-main'])).run();
  const cashier = await login('GRANT', 'grantcashier', pass, 'grant-cashier-fixture');

  const deviceId = 'grant-device';
  const proof = deviceProof();
  const competingProofs = [deviceProof(), deviceProof()];
  const racing = await Promise.all(competingProofs.map(deviceProof => call('/api/cash/devices', 'POST', {
    tenantId: 'GRANT', deviceId: 'race-device', deviceProof
  }, cashier)));
  assert.deepEqual(racing.map(response => response.status).sort(), [201, 409]);
  const winner = racing.findIndex(response => response.status === 201);
  assert.equal((await call('/api/cash/devices', 'POST', { tenantId: 'GRANT', deviceId: 'race-device',
    deviceProof: competingProofs[winner] }, cashier)).status, 200);
  assert.equal((await call('/api/cash/devices', 'POST', { tenantId: 'GRANT', deviceId, deviceProof: proof }, cashier)).status, 201);
  assert.equal((await call('/api/cash/devices', 'POST', { tenantId: 'GRANT', deviceId, deviceProof: proof }, cashier)).status, 200);
  assert.equal((await call('/api/cash/devices', 'POST', { tenantId: 'GRANT', deviceId, deviceProof: deviceProof() }, cashier)).status, 409);
  assert.equal((await call('/api/cash/devices', 'POST', { tenantId: 'B', deviceId, deviceProof: deviceProof() }, cashier)).status, 403);

  const owner=await login('GRANT','grantowner');
  assert.equal((await call('/api/cash/drawers','POST',{tenantId:'GRANT',branchId:'grant-main',id:'grant-drawer',name:'Grant drawer'},owner)).status,201);
  const assignment={tenantId:'GRANT',branchId:'grant-main',drawerId:'grant-drawer',deviceId};
  assert.equal((await call('/api/cash/drawers','PATCH',assignment,cashier)).status,403);
  assert.equal((await call('/api/cash/drawers','PATCH',assignment,owner)).status,201);
  assert.equal((await call('/api/cash/drawers','PATCH',assignment,owner)).status,200);
  assert.equal((await call('/api/cash/drawers','PATCH',{...assignment,deviceId:'race-device'},owner)).status,409);
  assert.equal((await call('/api/cash/drawers','PATCH',{...assignment,tenantId:'B'},owner)).status,403);

  assert.equal((await call('/api/cash/grants', 'POST', { tenantId: 'GRANT', deviceId, deviceProof: proof })).status, 401);
  assert.equal((await call('/api/cash/grants', 'POST', { tenantId: 'GRANT', deviceId, deviceProof: deviceProof() }, cashier)).status, 403);
  assert.equal((await call('/api/cash/grants', 'POST', { tenantId: 'GRANT', deviceId: 'unknown-device', deviceProof: proof }, cashier)).status, 403);

  const eventKeys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const eventPublicJwk=await crypto.subtle.exportKey('jwk',eventKeys.publicKey);
  const eventPrivateJwk=await crypto.subtle.exportKey('jwk',eventKeys.privateKey);
  assert.equal((await call('/api/cash/grants','POST',{tenantId:'GRANT',deviceId,deviceProof:proof,eventPublicJwk:eventPrivateJwk},cashier)).status,400);
  assert.equal((await call('/api/cash/grants','POST',{tenantId:'GRANT',deviceId,deviceProof:proof,eventPublicJwk:{...eventPublicJwk,x:'invalid'}},cashier)).status,400);
  const issued = await call('/api/cash/grants', 'POST', { tenantId: 'GRANT', deviceId, deviceProof: proof,eventPublicJwk,
    cashierId: 'attacker', branchIds: ['grant-second'], onlineVerifiedAt: '2000-01-01T00:00:00Z',
    offlineIdentity:{role:'super_admin',permissions:{canAccessSettings:true},syncScopeVersion:999} }, cashier);
  assert.equal(issued.status, 200);
  const grant = (await issued.json()).grant;
  assert.equal(grant.claims.tenantId, 'GRANT');
  assert.equal(grant.claims.cashierId, 'grant-cashier');
  assert.equal(grant.claims.offlineIdentity?.role,'cashier');
  assert.equal(grant.claims.offlineIdentity?.permissions?.canAccessSettings,false);
  assert.equal(grant.claims.offlineIdentity?.syncScopeVersion,0);
  assert.equal(grant.claims.deviceId, deviceId);
  assert.deepEqual(grant.claims.eventPublicJwk,{kty:'EC',crv:'P-256',x:eventPublicJwk.x,y:eventPublicJwk.y});
  assert.deepEqual(grant.claims.branchIds, ['grant-main']);
  assert.deepEqual(grant.claims.drawerIds,['grant-drawer']);
  assert.equal(Date.parse(grant.claims.onlineVerifiedAt) > Date.now() - 60_000, true);

  const handle = await verifySignedOfflineGrant(grant, grantPublicJwk);
  assert.equal(assertVerifiedOfflineGrant(handle, { tenantId: 'GRANT', cashierId: 'grant-cashier', deviceId, branchId: 'grant-main' },
    new Date(Date.now() + 60_000).toISOString()), true);
  assert.throws(() => assertVerifiedOfflineGrant(handle, { tenantId: 'GRANT', cashierId: 'grant-cashier', deviceId, branchId: 'grant-second' }), /تصريح/);
  assert.equal(assertVerifiedOfflineGrant(handle,{tenantId:'GRANT',cashierId:'grant-cashier',deviceId,branchId:'grant-main',drawerId:'grant-drawer'},
    grant.claims.onlineVerifiedAt),true);
  assert.throws(()=>assertVerifiedOfflineGrant(handle,{tenantId:'GRANT',cashierId:'grant-cashier',deviceId,branchId:'grant-main',drawerId:'other-drawer'}),/درج|تصريح/);
  await assert.rejects(() => verifySignedOfflineGrant({ ...grant, claims: { ...grant.claims, cashierId: 'attacker' } }, grantPublicJwk), /توقيع/);
});

test('signed drawer replay preserves original cashiers across account handover and rejects forgery',async()=>{
  await db.prepare("INSERT INTO tenants(id,store_code,company_name,username,password_hash,status,role) VALUES('SIGNED','SIGNED','Signed replay','signedowner',?,'active','company_owner')").bind(await hashPassword(pass)).run();
  await db.prepare("INSERT INTO branches(id,tenant_id,name,is_main,status) VALUES('signed-main','SIGNED','Main',1,'active')").run();
  for(const id of ['signed-1','signed-2'])await db.prepare(`INSERT INTO users(id,tenant_id,name,username,password_hash,role,status,branch_ids_json,permissions_json)
    VALUES(?,'SIGNED',?,?,?,'custom','active','["signed-main"]','{"canSell":true,"canManageExpenses":true}')`).bind(id,id,id,await hashPassword(pass)).run();
  const owner=await login('SIGNED','signedowner'),first=await login('SIGNED','signed-1'),second=await login('SIGNED','signed-2');
  const deviceId='signed-device',proof=deviceProof();
  assert.equal((await call('/api/cash/devices','POST',{tenantId:'SIGNED',deviceId,deviceProof:proof},first)).status,201);
  assert.equal((await call('/api/cash/drawers','POST',{tenantId:'SIGNED',branchId:'signed-main',id:'signed-drawer',name:'Drawer'},owner)).status,201);
  assert.equal((await call('/api/cash/drawers','PATCH',{tenantId:'SIGNED',branchId:'signed-main',drawerId:'signed-drawer',deviceId},owner)).status,201);
  const pairs=await Promise.all([first,second].map(async token=>{
    const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
    const response=await call('/api/cash/grants','POST',{tenantId:'SIGNED',deviceId,deviceProof:proof,eventPublicJwk:await crypto.subtle.exportKey('jwk',keys.publicKey)},token);
    assert.equal(response.status,200);return {keys,grant:(await response.json()).grant};
  }));
  // Miniflare's worker clock and the Node fixture clock need not tick together.
  // The source is deliberately created after both authenticated grants.
  const timestamp=Math.max(Date.now(),...pairs.map(pair=>Date.parse(pair.grant.claims.onlineVerifiedAt)));
  const at=new Date(timestamp).toISOString(),heads={};
  const opened={id:'signed-shift-1',tenantId:'SIGNED',branchId:'signed-main',drawerId:'signed-drawer',actorId:'signed-1',offlineDeviceId:deviceId,
    timeZone:'Asia/Riyadh',accountingDate:accountingDate(at,'Asia/Riyadh'),openedAt:at,openingCash:100,status:'open',events:[]};
  const source=(id,type,payload,action='create')=>attachConflictPreconditions({id,tenantId:'SIGNED',branchId:'signed-main',entityType:type,entityId:payload.id,action,payload,timestamp,groupId:crypto.randomUUID()},heads);
  const events=[source('signed-open','cash_shift',opened),
    source('signed-expense','expense',{id:'signed-expense-row',tenantId:'SIGNED',branchId:'signed-main',amount:12,paymentMethod:'cash',cashShiftId:opened.id}),
    source('signed-close','cash_shift',{...opened,status:'closed_local',closedAt:at,closedBy:'signed-1',countedCash:88,expectedCash:88,variance:0},'update'),
    source('signed-next-open','cash_shift',{...opened,id:'signed-shift-2',actorId:'signed-2',openingCash:88})];
  const proofs=await Promise.all(events.map(async(source,index)=>{
    const pair=pairs[index===3?1:0];
    const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.keys.privateKey,new TextEncoder().encode(JSON.stringify(source)));
    return {source,grant:pair.grant,signature:Buffer.from(signature).toString('base64url')};
  }));
  const body={tenantId:'SIGNED',deviceId,deviceProof:proof,proofs};
  const tampered=structuredClone(body);tampered.proofs[1].source.payload.amount=13;
  assert.equal((await call('/api/cash/replay','POST',tampered,second)).status,403);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM sync_events_v2 WHERE tenant_id='SIGNED'").first()).n,0);
  assert.equal((await call('/api/cash/replay','POST',body,b)).status,403);
  const accepted=await call('/api/cash/replay','POST',body,second);
  assert.equal(accepted.status,200,await accepted.clone().text());
  assert.deepEqual((await accepted.json()).acceptedIds,events.map(event=>event.id));
  const shifts=await db.prepare("SELECT opened_by,status,expected_cash_cents FROM cash_shifts WHERE tenant_id='SIGNED' ORDER BY id").all();
  assert.deepEqual(shifts.results,[{opened_by:'signed-1',status:'closed',expected_cash_cents:8800},{opened_by:'signed-2',status:'open',expected_cash_cents:null}]);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM cash_source_proofs WHERE tenant_id='SIGNED'").first()).n,4);
  const retry=await call('/api/cash/replay','POST',body,second);
  assert.equal(retry.status,200,await retry.clone().text());
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM cash_shift_movements WHERE tenant_id='SIGNED'").first()).n,1);
  await assert.rejects(db.prepare("UPDATE cash_source_proofs SET cashier_id='signed-2' WHERE tenant_id='SIGNED'").run(),/CASH_SOURCE_PROOF_IMMUTABLE/);
  await assert.rejects(db.prepare("DELETE FROM cash_source_proofs WHERE tenant_id='SIGNED'").run(),/CASH_SOURCE_PROOF_IMMUTABLE/);
  await db.prepare("UPDATE users SET auth_version=auth_version+1 WHERE id='signed-1'").run();
  assert.equal((await call('/api/cash/replay','POST',body,second)).status,403);
  await db.prepare("UPDATE users SET auth_version=auth_version-1 WHERE id='signed-1'").run();
  await db.prepare("UPDATE cash_devices SET revoked_at=datetime('now') WHERE tenant_id='SIGNED' AND id=?").bind(deviceId).run();
  assert.equal((await call('/api/cash/replay','POST',body,second)).status,403);
});

test('actual hook drawer sale, signed void and expense reach real API and survive lost local acknowledgement',async()=>{
  await db.prepare("INSERT INTO tenants(id,store_code,company_name,username,password_hash,status,role) VALUES('HOOKCASH','HOOKCASH','Hook cash','hookowner',?,'active','company_owner')").bind(await hashPassword(pass)).run();
  await db.prepare("INSERT INTO branches(id,tenant_id,name,is_main,status) VALUES('hook-main','HOOKCASH','Main',1,'active')").run();
  const token=await login('HOOKCASH','hookowner'),deviceId='hook-device',proof=deviceProof();
  assert.equal((await call('/api/sync/push','POST',{tenantId:'HOOKCASH',events:[{id:'hook-branch-source',entityType:'branch',entityId:'hook-main',action:'create',
    payload:{id:'hook-main',tenantId:'HOOKCASH',name:'Main',isMain:true,status:'active'}}]},token)).status,200);
  await call('/api/cash/devices','POST',{tenantId:'HOOKCASH',deviceId,deviceProof:proof},token);
  await call('/api/cash/drawers','POST',{tenantId:'HOOKCASH',branchId:'hook-main',id:'hook-drawer',name:'Drawer'},token);
  await call('/api/cash/drawers','PATCH',{tenantId:'HOOKCASH',branchId:'hook-main',drawerId:'hook-drawer',deviceId},token);
  const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const response=await call('/api/cash/grants','POST',{tenantId:'HOOKCASH',deviceId,deviceProof:proof,eventPublicJwk:await crypto.subtle.exportKey('jwk',keys.publicKey)},token);
  assert.equal(response.status,200);
  const envelope=(await response.json()).grant;
  const original={localStorage:globalThis.localStorage,sessionStorage:globalThis.sessionStorage,fetch:globalThis.fetch,
    window:globalThis.window,document:globalThis.document,navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator')};
  globalThis.localStorage=memoryStorage();globalThis.sessionStorage=memoryStorage();
  const locks={async request(_key,_options,callback){return callback({});}};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false,locks}});
  Object.assign(globalThis,{window:{addEventListener(){},removeEventListener(){},location:{origin:'https://test.invalid'}},
    document:{addEventListener(){},removeEventListener(){},visibilityState:'hidden'}});
  globalThis.fetch=(url,init)=>{const target=new URL(url);return mf.dispatchFetch('https://test.invalid'+target.pathname+target.search,init);};
  const bundle=await build({stdin:{contents:"export {useAppStore} from './src/store/useAppStore.js';export {cloudflareSync} from './src/services/cloudflareSync.js';export {setSessionToken,setSessionUser} from './src/services/authSession.js';export {enrollOfflineGrant} from './src/services/offlineUnlock.js';export {OfflineGrantStore,memoryBackend} from './src/services/offlineGrantStore.js';",resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node',packages:'external',define:{'import.meta.env':'{}'}});
  const loaded={exports:{}};
  new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
  const {useAppStore,cloudflareSync,setSessionToken,setSessionUser,enrollOfflineGrant,OfflineGrantStore,memoryBackend}=loaded.exports;
  const identity={id:'HOOKCASH',tenantId:'HOOKCASH',role:'company_owner',branchIds:['all'],sessionExpiresAt:new Date(Date.now()+60000).toISOString()};
  const initial=seedAggregate(localStorage,identity,{branches_v1:[{id:'hook-main',tenantId:'HOOKCASH',name:'Main',isMain:true,status:'active'}],
    active_branch_id_v1:'hook-main',cash_shifts_v1:[],expenses_v3:[],products_v3:[],customers_v3:[],suppliers_v3:[],invoices_v3:[]});
  const rows=new Map([['braka:HOOKCASH:HOOKCASH:atomic_v1',initial]]);
  let fail=false;
  const disk={async read(key){return structuredClone(rows.get(key)??null);},
    async commit(key,snapshot,revision){assert.equal(rows.get(key)?.revision??null,revision);rows.set(key,structuredClone(snapshot));return structuredClone(snapshot);},
    async commitBatch(entries){if(fail)throw Error('Local replay acknowledgement quota');for(const entry of entries)assert.equal(rows.get(entry.key)?.revision??null,entry.expectedRevision);
      for(const entry of entries)rows.set(entry.key,structuredClone(entry.snapshot));return entries.map(entry=>structuredClone(entry.snapshot));}};
  const grantStore=new OfflineGrantStore(memoryBackend());
  await grantStore.saveDeviceIdentity({deviceId,deviceProof:proof});
  const enrolled=await enrollOfflineGrant({tenantId:'HOOKCASH',cashierId:'HOOKCASH',deviceId,branchId:'hook-main',password:pass,envelope,
    pinnedPublicJwk:grantPublicJwk,eventPrivateJwk:await crypto.subtle.exportKey('jwk',keys.privateKey),at:envelope.claims.onlineVerifiedAt});
  await grantStore.saveRecord({tenantId:'HOOKCASH',cashierId:'HOOKCASH',deviceId},enrolled);
  let app,root;
  function Harness(){app=useAppStore({durableRepository:disk,cashGrantStore:grantStore,offlineGrantPublicJwk:grantPublicJwk});return null;}
  try {
    setSessionToken(token);setSessionUser(identity);
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));await new Promise(resolve=>setTimeout(resolve,30));});
    const deadline=Date.now()+2000;
    while(!app.persistence.ready&&!app.persistence.error&&Date.now()<deadline)
      await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));});
    assert.equal(app.persistence.ready,true,app.persistence.error);
    await act(async()=>{await app.unlockCashDrawer(pass,'hook-shift');});
    await act(async()=>{await app.openShift({id:'hook-shift',tenantId:'HOOKCASH',branchId:'hook-main',drawerId:'hook-drawer',actorId:'HOOKCASH',
      offlineDeviceId:deviceId,openingCash:100,timeZone:'Asia/Riyadh',at:new Date().toISOString()});});
    await act(async()=>{await app.addExpense({id:'hook-expense',title:'Rent',amount:12,paymentMethod:'cash'});});
    await act(async()=>{await app.addProduct({id:'hook-product',name:'Carrot',currentStockKg:10,costPerKg:2,defaultPricePerKg:3});});
    await act(async()=>{await app.saveInvoice({id:'hook-invoice',customerId:'walk_in',items:[{productId:'hook-product',netWeight:2,pricePerKg:3}],
      saleType:'cash',paymentMethod:'cash',paidAmount:6,finalTotal:6,remainingDebt:0});});
    assert.equal(app.products.find(row=>row.id==='hook-product').currentStockKg,8);
    await act(async()=>{await app.voidInvoice('hook-invoice');});
    assert.equal(app.products.find(row=>row.id==='hook-product').currentStockKg,10);
    await act(async()=>{await app.closeShift({shiftId:'hook-shift',actorId:'HOOKCASH',deviceId,countedCash:88,at:new Date().toISOString()});});
    globalThis.fetch=(url,init)=>{const target=new URL(url);return mf.dispatchFetch('https://test.invalid'+target.pathname+target.search,init);};
    cloudflareSync.isOnline=true;fail=true;
    assert.equal(await cloudflareSync.flushQueue({pullAfterFlush:false}),false);
    assert.match(cloudflareSync.lastError,/quota/);
    assert.ok(cloudflareSync.repository.current.outbox.length>0);
    fail=false;
    assert.equal(await cloudflareSync.flushQueue({pullAfterFlush:false}),true,cloudflareSync.lastError);
    assert.equal(cloudflareSync.repository.current.outbox.length,0);
    const shift=await db.prepare("SELECT status,expected_cash_cents,counted_cash_cents FROM cash_shifts WHERE id='hook-shift'").first();
    assert.deepEqual(shift,{status:'closed',expected_cash_cents:8800,counted_cash_cents:8800});
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM cash_shift_movements WHERE tenant_id='HOOKCASH'").first()).n,3);
    const reversed=await db.prepare(`SELECT reversal.amount_cents,original.amount_cents original_cents FROM cash_shift_movements reversal
      JOIN cash_shift_movements original ON original.tenant_id=reversal.tenant_id AND original.source_event_id=reversal.reverses_source_event_id
      WHERE reversal.tenant_id='HOOKCASH'`).first();
    assert.deepEqual(reversed,{amount_cents:-600,original_cents:600});
    assert.equal(app.expenses.length,1);
  } finally {
    await act(async()=>{root?.unmount();});cloudflareSync.stopAutoSync();
    Object.assign(globalThis,{localStorage:original.localStorage,sessionStorage:original.sessionStorage,fetch:original.fetch,window:original.window,document:original.document});
    if(original.navigator)Object.defineProperty(globalThis,'navigator',original.navigator);else delete globalThis.navigator;
  }
});

test('sync sequence migration preserves events from the preceding schema', async () => {
  const legacy=await mf.getD1Database('LEGACY');
  for(const name of (await readdir('d1/migrations')).filter(n=>/^000[1-4]_/.test(n)).sort()) {
    const sql=(await readFile('d1/migrations/'+name,'utf8')).replace(/--[^\n]*/g,'');
    for(const statement of sql.match(/\s*CREATE TRIGGER[\s\S]*?END;|[^;]+;/gi) || []) if(statement.trim()) await legacy.prepare(statement).run();
  }
  await legacy.prepare("INSERT INTO tenants(id,company_name,username,password_hash) VALUES('legacy','Fixture','legacy','disabled-fixture')").run();
  await legacy.prepare("INSERT INTO sync_events(id,tenant_id,entity_type,entity_id,action,payload_json,client_timestamp,server_timestamp) VALUES('legacy-event','legacy','product','p','create','{}',1,1)").run();
  const sql=(await readFile('d1/migrations/0005_sync_sequence.sql','utf8')).replace(/--[^\n]*/g,'');
  for(const statement of sql.split(';')) if(statement.trim()) await legacy.prepare(statement).run();
  assert.equal((await legacy.prepare("SELECT COUNT(*) AS n FROM sync_events").first()).n,1);
  const migrated=await legacy.prepare("SELECT id,payload_json,sequence FROM sync_events_v2").first();
  assert.deepEqual(migrated,{id:'legacy-event',payload_json:'{}',sequence:1});
});
test('missing authentication is denied on all protected routes', async () => {
  for (const [path, method] of [['/api/users?tenantId=A','GET'], ['/api/users','POST'], ['/api/tenants','GET'], ['/api/sync/push','POST'], ['/api/sync/pull?tenantId=A','GET'], ['/api/branches?tenantId=A','GET'], ['/api/backup?tenantId=A','GET'], ['/api/backup','POST'], ['/api/trial-requests','GET'], ['/api/trial-requests?id=x','DELETE'], ['/api/releases','POST'], ['/api/cash/devices','POST'], ['/api/cash/grants','POST']]) {
    assert.equal((await call(path,method, method === 'POST' ? {} : undefined)).status,401,path);
  }
});
test('cross-tenant identifiers are rejected for reads and writes', async () => {
  for (const path of ['/api/users?tenantId=B','/api/backup?tenantId=B','/api/sync/pull?tenantId=B','/api/branches?tenantId=B']) assert.equal((await call(path,'GET',undefined,a)).status,403,path);
  assert.equal((await call('/api/sync/push','POST',{tenantId:'B',events:[]},a)).status,403);
  assert.equal((await call('/api/backup','POST',{tenantId:'B',snapshot:{}},a)).status,403);
});
test('cashier cannot administer users, backups, trials, or releases', async () => {
  assert.equal((await call('/api/users?tenantId=A','GET',undefined,staff)).status,403);
  assert.equal((await call('/api/backup?tenantId=A','GET',undefined,staff)).status,403);
  assert.equal((await call('/api/trial-requests','GET',undefined,staff)).status,403);
  assert.equal((await call('/api/releases','POST',{},staff)).status,403);
});
test('tenant administrator cannot manufacture a platform administrator', async () => {
  const r = await call('/api/users','POST',{tenantId:'A', name:'Escalation',username:'attacker',password:pass,role:'super_admin'},a);
  assert.equal(r.status,400);
  assert.equal(await db.prepare("SELECT id FROM users WHERE username = 'attacker'").first(),null);
});
test('sync retries are idempotent and changed retries conflict', async () => {
  const event = { id:'evt-fixture-1',entityType:'product',entityId:'p1',action:'create',payload:{id:'p1',tenantId:'A',name:'Fixture'}};
  const body = {tenantId:'A',events:[event]};
  for (let i=0;i<2;i++) assert.equal((await call('/api/sync/push','POST',body,a)).status,200);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM sync_events_v2 WHERE tenant_id='A'").first()).n,1);
  assert.equal((await call('/api/sync/push','POST',{tenantId:'A',events:[{...event,payload:{...event.payload,name:'changed'}}]},a)).status,409);
  assert.equal((await call('/api/sync/pull?tenantId=B','GET',undefined,b).then(r=>r.json())).events.length,0);
});
test('legacy checkpoint audit requires full-tenant server visibility and every applied prefix event', async () => {
  const fetchPage = token => async ({tenantId,cursor,limit}) => {
    const response=await call(`/api/sync/pull?tenantId=${encodeURIComponent(tenantId)}&cursor=${cursor}&limit=${limit}`,'GET',undefined,token);
    assert.equal(response.status,200);
    return response.json();
  };
  const first=await fetchPage(a)({tenantId:'A',cursor:0,limit:500});
  assert.equal(first.fullTenantVisibility,true);
  assert.ok(first.events.length>0);
  const fetchBranches = token => async ({tenantId}) => {
    const response=await call(`/api/branches?tenantId=${encodeURIComponent(tenantId)}`,'GET',undefined,token);
    assert.equal(response.status,200);
    return response.json();
  };
  const manifest=await fetchBranches(a)({tenantId:'A'});
  assert.equal(manifest.latestSequence,first.nextCursor);
  assert.equal(manifest.branches.length,1);
  const recordsFor = type => first.events
    .filter(event => event.entityType === type && event.action === 'create')
    .map(event => event.payload);
  const snapshot={identity:{id:'ownerA',tenantId:'A'},cursor:first.nextCursor,
    applied:Object.fromEntries(first.events.map(event=>[event.id,true])),outbox:[],state:{
      khodar_pos_branches_v1:manifest.branches,khodar_pos_active_branch_id_v1:manifest.branches[0].id,
      khodar_pos_products_v3:recordsFor('product')
    }};
  const result=await verifyCloudCheckpoint(snapshot,fetchPage(a));
  assert.equal(result.verifiedThrough,snapshot.cursor);
  assert.equal(result.observedEvents,first.events.length);
  const missing=structuredClone(snapshot);
  delete missing.applied[first.events[0].id];
  await assert.rejects(verifyCloudCheckpoint(missing,fetchPage(a)),/لم تُطبّق محليًا/);
  const staffPage=await fetchPage(staff)({tenantId:'A',cursor:0,limit:500});
  assert.equal(staffPage.fullTenantVisibility,false);
  await assert.rejects(verifyCloudCheckpoint(snapshot,fetchPage(staff)),/كامل سجل مزامنة الشركة/);
  assert.equal((await call('/api/branches?tenantId=A','GET',undefined,staff)).status,403);
  await assert.rejects(verifyCloudCheckpoint(snapshot,async()=>({...first,nextCursor:first.nextCursor+1})),/تخفي أحداثًا/);
  const backend=memoryStorage();
  const receiveState={
    khodar_pos_branches_v1:manifest.branches,
    khodar_pos_active_branch_id_v1:manifest.branches[0].id
  };
  const local=new AtomicStore({id:'audit-fixture',tenantId:'A'},receiveState,backend);
  await local.acquire();
  try {
    const tables = {
      product: 'khodar_pos_products_v3',
      branch: 'khodar_pos_branches_v1',
      customer: 'khodar_pos_customers_v3',
      customer_payment: 'khodar_pos_customer_payments_v3',
      supplier: 'khodar_pos_suppliers_v3',
      supplier_payment: 'khodar_pos_supplier_payments_v3',
      expense: 'khodar_pos_expenses_v3',
      worker_transaction: 'khodar_pos_worker_transactions_v3'
    };
    local.receive(first.events,first.nextCursor,batch=>{
      for (const event of batch) {
        const key=tables[event.entityType];
        if (!key) continue;
        const rows=local.value.state[key] || [];
        if (event.action === 'create') local.set(key,rows.some(row=>row.id===event.entityId)?rows:[...rows,event.payload]);
        else if (event.action === 'update') local.set(key,rows.map(row=>row.id===event.entityId?{...row,...event.payload}:row));
        else if (event.action === 'delete') local.set(key,rows.filter(row=>row.id!==event.entityId));
      }
    });
    let adopted=false;
    const migrated=await local.adoptCloudCheckedAggregate({adoptIfEmpty:async(_key,record)=>{
      adopted=true;return structuredClone(record);
    }},fetchPage(a),fetchBranches(a));
    assert.equal(adopted,true);
    assert.equal(migrated.saved.cursor,first.nextCursor);
    assert.equal(migrated.audit.observedEvents,first.events.length);
    assert.equal(migrated.branchAudit.branchCount,1);
  } finally {await local.close();}
});
test('legacy checkpoint rejects a local receipt amount that differs from actual D1 event payload', async () => {
  const receipt={id:'migration-receipt',tenantId:'A',customerId:'migration-customer',amount:12};
  const customer={id:'migration-customer',tenantId:'A',name:'Migration customer',balance:0};
  const events=[
    {id:'migration-customer-event',entityType:'customer',entityId:'migration-customer',action:'create',
      payload:customer},
    {id:'migration-receipt-event',entityType:'customer_payment',entityId:receipt.id,action:'create',payload:receipt}
  ];
  const pushed=await call('/api/sync/push','POST',{tenantId:'A',events},a);
  assert.equal(pushed.status,200,await pushed.text());
  const pull=async({tenantId,cursor,limit})=>(await call(
    `/api/sync/pull?tenantId=${tenantId}&cursor=${cursor}&limit=${limit}`,'GET',undefined,a)).json();
  const page=await pull({tenantId:'A',cursor:0,limit:500});
  const recordsFor = type => page.events
    .filter(event => event.entityType === type && event.action === 'create')
    .map(event => event.payload);
  const snapshot={identity:{id:'ownerA',tenantId:'A'},cursor:page.nextCursor,
    applied:Object.fromEntries(page.events.map(event=>[event.id,true])),outbox:[],
    state:{khodar_pos_customer_payments_v3:[{...receipt,amount:13}],
      khodar_pos_customers_v3:[{...customer,balance:-12}],
      khodar_pos_products_v3:recordsFor('product')}};
  await assert.rejects(verifyCloudCheckpoint(snapshot,pull),/لا يطابق آخر حركة/);
  const backend=memoryStorage();
  const raw=JSON.stringify({...snapshot,schema:1,revision:1});
  const key=scopedStorageKey('atomic_v1',snapshot.identity);
  backend.setItem(key,raw);
  const legacy=new AtomicStore(snapshot.identity,snapshot.state,backend);
  await legacy.acquire();
  let adopted=false;
  try {
    await assert.rejects(legacy.adoptCloudCheckedAggregate({adoptIfEmpty:async()=>{adopted=true;}},
      pull,async()=>{throw Error('branch audit must not run after financial mismatch');}),/لا يطابق آخر حركة/);
    assert.equal(adopted,false);
    assert.equal(legacy.writable,false);
    assert.equal(backend.getItem(key),raw);
  } finally {await legacy.close();}
  snapshot.state.khodar_pos_customer_payments_v3=[receipt];
  snapshot.state.khodar_pos_customers_v3=[{...customer,balance:-11}];
  await assert.rejects(verifyCloudCheckpoint(snapshot,pull),/رصيد عميل محلي لا يطابق/);
  snapshot.state.khodar_pos_customers_v3=[{...customer,balance:-12}];
  const verified=await verifyCloudCheckpoint(snapshot,pull);
  assert.equal(verified.verifiedThrough,page.nextCursor);
  assert.equal(verified.verifiedCustomerBalances,1);
  await assert.rejects(verifyCloudCheckpoint({...snapshot,outbox:[{
    ...page.events.find(event=>event.id==='migration-receipt-event'),
    payload:{...receipt,amount:13}
  }]},pull),/تختلف عن الحركة المقبولة/);
});
test('legacy checkpoint rejects a local supplier balance that differs from actual D1 purchase history', async () => {
  const supplier={id:'migration-supplier',tenantId:'B',name:'Migration supplier',balance:5};
  const purchase={id:'migration-purchase',tenantId:'B',supplierId:supplier.id,creditAmount:20};
  const payment={id:'migration-supplier-payment',tenantId:'B',supplierId:supplier.id,amount:7};
  const returned={id:'migration-purchase-return',tenantId:'B',purchaseId:purchase.id,supplierId:supplier.id,
    refundMethod:'supplier_debt_deduction',totalRefundAmount:3};
  const events=[
    {id:'migration-supplier-event',entityType:'supplier',entityId:supplier.id,action:'create',payload:supplier},
    {id:'migration-purchase-event',entityType:'purchase',entityId:purchase.id,action:'create',payload:purchase},
    {id:'migration-supplier-payment-event',entityType:'supplier_payment',entityId:payment.id,action:'create',payload:payment},
    {id:'migration-purchase-return-event',entityType:'purchase_return',entityId:returned.id,action:'create',payload:returned}
  ];
  const pushed=await call('/api/sync/push','POST',{tenantId:'B',events},b);
  assert.equal(pushed.status,200,await pushed.text());
  const pull=async({tenantId,cursor,limit})=>(await call(
    `/api/sync/pull?tenantId=${tenantId}&cursor=${cursor}&limit=${limit}`,'GET',undefined,b)).json();
  const page=await pull({tenantId:'B',cursor:0,limit:500});
  const applied=Object.fromEntries(page.events.map(event=>[event.id,true]));
  const recordsFor = type => page.events
    .filter(event => event.entityType === type && event.action === 'create')
    .map(event => event.payload);
  const snapshot={identity:{id:'ownerB',tenantId:'B'},cursor:page.nextCursor,applied,outbox:[],
    state:{khodar_pos_suppliers_v3:[{...supplier,balance:16}],
      khodar_pos_purchases_v3:recordsFor('purchase'),
      khodar_pos_purchase_returns_v3:recordsFor('purchase_return'),
      khodar_pos_products_v3:recordsFor('product'),
      khodar_pos_customer_payments_v3:recordsFor('customer_payment'),
      khodar_pos_supplier_payments_v3:recordsFor('supplier_payment'),
      khodar_pos_expenses_v3:recordsFor('expense'),
      khodar_pos_worker_transactions_v3:recordsFor('worker_transaction')}};
  await assert.rejects(verifyCloudCheckpoint(snapshot,pull),/رصيد مورد محلي لا يطابق/);
  snapshot.state.khodar_pos_suppliers_v3=[{...supplier,balance:15}];
  const verified=await verifyCloudCheckpoint(snapshot,pull);
  assert.equal(verified.verifiedThrough,page.nextCursor);
  assert.equal(verified.verifiedSupplierBalances,1);
  snapshot.state.khodar_pos_purchases_v3[0]={...purchase,paidBankAmount:99};
  await assert.rejects(verifyCloudCheckpoint(snapshot,pull),/مصدر النقد أو البنك/);
});
test('branch creation and dependent transfer are one D1 batch, visible to owner only', async () => {
  const branchId='branch-created-for-transfer';
  const branch={id:branchId,tenantId:'A',name:'Receiving branch',code:'RCV',isMain:false,status:'active'};
  const main={id:'main',tenantId:'A',name:'Main',code:'MAIN',isMain:true,status:'active'};
  const createMain={id:'evt-create-main-branch',entityType:'branch',entityId:'main',action:'create',payload:main};
  const create={id:'evt-create-branch',entityType:'branch',entityId:branchId,action:'create',payload:branch};
  const transfer={id:'evt-transfer-branch',entityType:'stock_transfer',entityId:'transfer-branch',action:'create',payload:{id:'transfer-branch',fromBranchId:'main',toBranchId:branchId,productId:'p',quantityKg:3}};
  const body={tenantId:'A',events:[createMain,create,transfer]};
  assert.equal((await call('/api/sync/push','POST',body,staff)).status,403);
  assert.equal((await call('/api/sync/push','POST',{tenantId:'B',events:[create]},b)).status,400);
  assert.equal((await call('/api/sync/push','POST',{tenantId:'A',events:[transfer]},a)).status,400);
  assert.equal((await call('/api/sync/push','POST',{tenantId:'A',events:[transfer,create]},a)).status,400);
  assert.equal(await db.prepare('SELECT id FROM branches WHERE id = ?').bind(branchId).first(),null);
  let response=await call('/api/sync/push','POST',body,a);
  assert.equal(response.status,200,await response.text());
  assert.equal((await db.prepare('SELECT tenant_id AS tenantId, name FROM branches WHERE id = ?').bind(branchId).first()).tenantId,'A');
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM sync_events_v2 WHERE id IN ('evt-create-main-branch','evt-create-branch','evt-transfer-branch')").first()).n,3);
  response=await call('/api/sync/push','POST',body,a);
  assert.equal(response.status,200,await response.text());
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM sync_events_v2 WHERE id IN ('evt-create-main-branch','evt-create-branch','evt-transfer-branch')").first()).n,3);
  const all=await call('/api/sync/pull?tenantId=A','GET',undefined,a).then(r=>r.json());
  assert.ok(all.events.find(e=>e.id===create.id));assert.ok(all.events.find(e=>e.id===transfer.id));
  const tenantB=await call('/api/sync/pull?tenantId=B','GET',undefined,b).then(r=>r.json());
  assert.equal(tenantB.events.some(e=>e.entityId===branchId),false);
  const update={id:'evt-update-branch',entityType:'branch',entityId:branchId,action:'update',payload:{...branch,status:'inactive'}};
  assert.equal((await call('/api/sync/push','POST',{tenantId:'A',events:[update]},a)).status,200);
  assert.equal((await db.prepare('SELECT status FROM branches WHERE id = ?').bind(branchId).first()).status,'inactive');
  assert.equal((await call('/api/sync/push','POST',{tenantId:'A',events:[{...update,id:'evt-branch-delete',action:'delete'}]},a)).status,400);
});
test('legacy demo branch bootstrap fails closed before inventing another tenant branch', async () => {
  const tenantId=`bootstrap-${crypto.randomUUID()}`;
  await db.prepare('INSERT INTO tenants (id,store_code,company_name,username,password_hash,status,role,allowed_branches) VALUES (?,?,?,?,?,?,?,?)')
    .bind(tenantId,tenantId,'Fresh fixture','fresh',await hashPassword(pass),'active','company_owner',1).run();
  await db.prepare("INSERT OR IGNORE INTO branches (id,tenant_id,name,status) VALUES ('branch-main','A','Existing fixture','active')").run();
  const token=await login(tenantId,'fresh');
  const backend=memoryStorage();
  const local=new AtomicStore({id:tenantId,tenantId},{branches:INITIAL_BRANCHES},backend);
  await local.acquire();
  try {
    assert.throws(()=>local.bootstrapBranches('branches'),/لا تخص هذه الشركة/);
    assert.deepEqual(local.value.outbox,[]);
    const response=await call('/api/sync/pull?tenantId='+encodeURIComponent(tenantId),'GET',undefined,token);
    assert.equal(response.status,200);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM branches WHERE tenant_id = ?').bind(tenantId).first()).n,0);
    assert.equal(local.value.state.branches[0].tenantId,'tenant-demo','source remains available for owner review');
  } finally {await local.close();}
});
test('new tenant creation atomically provisions a unique main branch and permits its idempotent first sync event', async () => {
  const tenantId=`new-${crypto.randomUUID()}`;
  const response=await call('/api/tenants','POST',{
    id:tenantId,storeCode:tenantId,companyName:'New fixture',username:'newowner',password:pass,allowedBranches:1
  },platform);
  const created=await response.json();
  assert.equal(response.status,200,JSON.stringify(created));
  assert.equal(created.mainBranch.tenantId,tenantId);
  assert.notEqual(created.mainBranch.id,'branch-main');
  const row=await db.prepare('SELECT tenant_id,is_main FROM branches WHERE id = ?').bind(created.mainBranch.id).first();
  assert.equal(row.tenant_id,tenantId);
  assert.equal(row.is_main,1);
  const signIn=await call('/api/tenants/lookup','POST',{storeCode:tenantId,username:'newowner',password:pass});
  assert.equal(signIn.status,200);
  const session=await signIn.json();
  assert.deepEqual(session.branches,[created.mainBranch]);
  assert.equal(session.tenant.allowedBranches,1);
  const backend=memoryStorage();
  const local=new AtomicStore({id:tenantId,tenantId},{branches:session.branches},backend);
  await local.acquire();
  try {
    local.bootstrapBranches('branches');
    const event=local.value.outbox[0];
    assert.equal(event.entityId,created.mainBranch.id);
    for(let i=0;i<2;i++) {
      const pushed=await call('/api/sync/push','POST',{tenantId,events:[event]},session.session.token);
      assert.equal(pushed.status,200,await pushed.text());
    }
    const changed={...event,id:`evt-${crypto.randomUUID()}`,payload:{...event.payload,name:'Altered main'}};
    assert.equal((await call('/api/sync/push','POST',{tenantId,events:[changed]},session.session.token)).status,409);
    assert.equal(await db.prepare('SELECT id FROM sync_events_v2 WHERE tenant_id = ? AND id = ?').bind(tenantId,changed.id).first(),null);
    const extraId=`branch-${crypto.randomUUID()}`;
    const extra={id:`evt-${crypto.randomUUID()}`,entityType:'branch',entityId:extraId,action:'create',
      payload:{id:extraId,tenantId,name:'Over limit',isMain:false,status:'active'}};
    assert.equal((await call('/api/sync/push','POST',{tenantId,events:[extra]},session.session.token)).status,400);
    assert.equal(await db.prepare('SELECT id FROM branches WHERE id = ?').bind(extraId).first(),null);
    assert.equal(await db.prepare('SELECT id FROM sync_events_v2 WHERE tenant_id = ? AND id = ?').bind(tenantId,extra.id).first(),null);
    const pulled=await call(`/api/sync/pull?tenantId=${encodeURIComponent(tenantId)}`,'GET',undefined,session.session.token).then(r=>r.json());
    assert.equal(pulled.events.filter(item=>item.id===event.id).length,1);
    const second=await call('/api/tenants/lookup','POST',{storeCode:tenantId,username:'newowner',password:pass}).then(r=>r.json());
    assert.deepEqual(second.branches,session.branches);
  } finally {await local.close();}
});
test('branch provisioning failure rolls back tenant creation in the same D1 batch', async () => {
  const tenantId=`fail-provision-${crypto.randomUUID()}`;
  await db.prepare(`CREATE TRIGGER fixture_abort_branch_provision BEFORE INSERT ON branches
    WHEN NEW.tenant_id = '${tenantId}' BEGIN SELECT RAISE(ABORT, 'fixture abort'); END`).run();
  try {
    const response=await call('/api/tenants','POST',{
      id:tenantId,storeCode:tenantId,companyName:'Rollback fixture',username:'rollback',password:pass,allowedBranches:1
    },platform);
    assert.equal(response.status,500);
    assert.equal(await db.prepare('SELECT id FROM tenants WHERE id = ?').bind(tenantId).first(),null);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM branches WHERE tenant_id = ?').bind(tenantId).first()).n,0);
  } finally {await db.prepare('DROP TRIGGER fixture_abort_branch_provision').run();}
});
test('sync rejects nested foreign tenant and cashier inventory writes', async () => {
  const evt = {id:'evt-foreign',entityType:'product',entityId:'p2',action:'create',payload:{tenantId:'B'}};
  assert.equal((await call('/api/sync/push','POST',{tenantId:'A',events:[evt]},a)).status,400);
  assert.equal((await call('/api/sync/push','POST',{tenantId:'A',events:[{...evt,payload:{tenantId:'A'}}]},staff)).status,403);
});
test('sequence pagination cannot lose events with identical wall-clock time', async () => {
  const before=await db.prepare("SELECT COALESCE(MAX(sequence), 0) AS cursor FROM sync_events_v2 WHERE tenant_id = 'A'").first();
  const events = Array.from({length:3},(_,i)=>({id:'page-'+i,entityId:'p-'+i,entityType:'product',action:'create',timestamp:1,payload:{name:'Product '+i}}));
  assert.equal((await call('/api/sync/push','POST',{tenantId:'A',events},a)).status,200);
  let cursor=before.cursor; const ids=[];
  for(let i=0;i<3;i++) {
    const body=await call('/api/sync/pull?tenantId=A&limit=1&cursor='+cursor,'GET',undefined,a).then(r=>r.json());
    ids.push(...body.events.map(e=>e.id)); cursor=body.nextCursor;
  }
  assert.deepEqual(new Set(ids),new Set(events.map(event=>event.id)));
});
test('pull pagination retains a complete local commit group and advances cursor past it', async () => {
  const before=await db.prepare("SELECT COALESCE(MAX(sequence), 0) AS cursor FROM sync_events_v2 WHERE tenant_id = 'A'").first();
  const groupId=crypto.randomUUID();
  const events=['supplier','purchase','customer_payment'].map((type,i)=>({id:`group-boundary-${i}`,tenantId:'A',entityType:type,entityId:`group-record-${i}`,action:'create',payload:{id:`group-record-${i}`},groupId}));
  const response=await call('/api/sync/push','POST',{tenantId:'A',events},a);
  assert.equal(response.status,200,await response.text());
  const first=await call(`/api/sync/pull?tenantId=A&cursor=${before.cursor}&limit=1`,'GET',undefined,a).then(r=>r.json());
  assert.deepEqual(first.events.map(e=>e.id),events.map(e=>e.id));
  assert.equal(first.events.every(e=>e.groupId===groupId),true);
  const next=await call(`/api/sync/pull?tenantId=A&cursor=${first.nextCursor}&limit=1`,'GET',undefined,a).then(r=>r.json());
  assert.equal(next.events.some(e=>e.groupId===groupId),false);
  assert.equal((await call('/api/sync/push','POST',{tenantId:'A',events:[{...events[0],groupId:crypto.randomUUID()}]},a)).status,409);
  const lateBase={...events[0]}; Reflect.deleteProperty(lateBase,'conflictPolicyVersion'); Reflect.deleteProperty(lateBase,'preconditions');
  assert.equal((await call('/api/sync/push','POST',{tenantId:'A',events:[{...lateBase,id:'late-group-member',entityId:'late-group-member',payload:{id:'late-group-member'}}]},a)).status,409);
});
test('concurrent first writers cannot extend the same commit group', async () => {
  const groupId=crypto.randomUUID();
  const event=n=>({id:`concurrent-group-${n}`,tenantId:'A',entityType:'product',entityId:`concurrent-product-${n}`,action:'create',payload:{id:`concurrent-product-${n}`},groupId});
  const [first,second]=await Promise.all([0,1].map(n=>call('/api/sync/push','POST',{tenantId:'A',events:[event(n)]},a)));
  assert.deepEqual([first.status,second.status].sort(),[200,409]);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM sync_events_v2 WHERE tenant_id = ? AND group_id = ?').bind('A',groupId).first()).n,1);
  assert.equal((await db.prepare('SELECT event_count FROM sync_commit_groups WHERE tenant_id = ? AND group_id = ?').bind('A',groupId).first()).event_count,1);
  assert.equal((await call('/api/sync/push','POST',{tenantId:'A',events:[event(0),{...event(1),groupId:crypto.randomUUID()},event(0)]},a)).status,400);
});
test('conflicting duplicate IDs roll back the whole sync batch', async () => {
  const event = {id:'batch-conflict', entityId:'batch-product', entityType:'product', action:'create', payload:{name:'first'}};
  const response = await call('/api/sync/push','POST',{tenantId:'A',events:[event,{...event,payload:{name:'second'}}]},a);
  assert.equal(response.status,409);
  assert.equal(await db.prepare("SELECT id FROM sync_events_v2 WHERE id='batch-conflict'").first(),null);
});
test('concurrent changed retries acknowledge only one payload', async () => {
  const event = {id:'concurrent-conflict', entityId:'concurrent-product', entityType:'product', action:'create', payload:{name:'first'}};
  const responses = await Promise.all([event,{...event,payload:{name:'second'}}].map(e=>call('/api/sync/push','POST',{tenantId:'A',events:[e]},a)));
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM sync_events_v2 WHERE id='concurrent-conflict'").first()).n,1);
});
test('server rejects stale edits, cancel-modify races, debt races, stock races and offline reconnects', async () => {
  const loadHeads=async()=>Object.fromEntries((await db.prepare(
    'SELECT conflict_key,last_event_id FROM sync_conflict_heads WHERE tenant_id = ?'
  ).bind('A').all()).results.map(row=>[row.conflict_key,row.last_event_id]));
  const push=event=>call('/api/sync/push','POST',{tenantId:'A',events:[event]},a);

  const customerHeads=await loadHeads();
  const customer=attachConflictPreconditions({id:'conflict-customer-create',entityType:'customer',entityId:'conflict-customer',action:'create',payload:{id:'conflict-customer',balance:100}},customerHeads);
  assert.equal((await push(customer)).status,200);
  const editA=attachConflictPreconditions({id:'conflict-customer-edit-a',entityType:'customer',entityId:'conflict-customer',action:'update',payload:{id:'conflict-customer',name:'A'}},{...customerHeads});
  const editB=attachConflictPreconditions({id:'conflict-customer-edit-b',entityType:'customer',entityId:'conflict-customer',action:'update',payload:{id:'conflict-customer',name:'B'}},{...customerHeads});
  assert.equal((await push(editA)).status,200); assert.equal((await push(editB)).status,409);

  const invoiceHeads=await loadHeads();
  const invoice=attachConflictPreconditions({id:'conflict-invoice-create',branchId:'fixture-a-main',entityType:'invoice',entityId:'conflict-invoice',action:'create',payload:{id:'conflict-invoice',branchId:'fixture-a-main',items:[]}},invoiceHeads);
  assert.equal((await push(invoice)).status,200);
  const cancel=attachConflictPreconditions({id:'conflict-invoice-void',branchId:'fixture-a-main',entityType:'invoice',entityId:'conflict-invoice',action:'void',payload:{id:'conflict-invoice',status:'voided'}},{...invoiceHeads});
  const modify=attachConflictPreconditions({id:'conflict-invoice-edit',branchId:'fixture-a-main',entityType:'invoice',entityId:'conflict-invoice',action:'update',payload:{id:'conflict-invoice',notes:'stale'}},{...invoiceHeads});
  assert.equal((await push(cancel)).status,200); assert.equal((await push(modify)).status,409);

  const debtHeads=await loadHeads();
  const paymentA=attachConflictPreconditions({id:'conflict-payment-a',entityType:'customer_payment',entityId:'conflict-payment-a',action:'create',payload:{id:'conflict-payment-a',customerId:'conflict-customer',amount:60}},{...debtHeads});
  const paymentB=attachConflictPreconditions({id:'conflict-payment-b',entityType:'customer_payment',entityId:'conflict-payment-b',action:'create',payload:{id:'conflict-payment-b',customerId:'conflict-customer',amount:60}},{...debtHeads});
  assert.equal((await push(paymentA)).status,200); assert.equal((await push(paymentB)).status,409);

  const stockHeads=await loadHeads();
  const saleA=attachConflictPreconditions({id:'conflict-sale-a',branchId:'fixture-a-main',entityType:'invoice',entityId:'conflict-sale-a',action:'create',payload:{id:'conflict-sale-a',branchId:'fixture-a-main',items:[{productId:'p',netWeight:8}]}},{...stockHeads});
  const saleB=attachConflictPreconditions({id:'conflict-sale-b',branchId:'fixture-a-main',entityType:'invoice',entityId:'conflict-sale-b',action:'create',payload:{id:'conflict-sale-b',branchId:'fixture-a-main',items:[{productId:'p',netWeight:8}]}},{...stockHeads});
  assert.equal((await push(saleA)).status,200); assert.equal((await push(saleB)).status,409);

  const offlineHeads=await loadHeads();
  const offline=attachConflictPreconditions({id:'conflict-offline-edit',entityType:'product',entityId:'offline-product',action:'update',payload:{id:'offline-product',name:'offline'}},{...offlineHeads});
  const online=attachConflictPreconditions({id:'conflict-online-edit',entityType:'product',entityId:'online-product',action:'update',payload:{id:'online-product',name:'online'}},{...offlineHeads});
  assert.equal((await push(online)).status,200); assert.equal((await push(offline)).status,409);
  const missing={id:'conflict-policy-missing',entityType:'expense',entityId:'conflict-policy-missing',action:'create',payload:{id:'conflict-policy-missing',amount:1}};
  const raw=await mf.dispatchFetch('https://test.invalid/api/sync/push',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${a}`},body:JSON.stringify({tenantId:'A',events:[missing]})});
  assert.equal(raw.status,400);
});
test('server accept followed by lost acknowledgement survives reopen and retries exactly once', async () => {
  const storage=memoryStorage();
  const identity={id:'retry-device',tenantId:'A'};
  const currentHeads=Object.fromEntries((await db.prepare(
    'SELECT conflict_key,last_event_id FROM sync_conflict_heads WHERE tenant_id = ?'
  ).bind('A').all()).results.map(row=>[row.conflict_key,row.last_event_id]));
  const store=new AtomicStore(identity,{stock:20,[SYNC_HEADS_STATE_KEY]:currentHeads},storage);
  await store.acquire();
  const event={id:'lost-response-event',tenantId:'A',entityType:'product',entityId:'retry-product',action:'create',payload:{id:'retry-product',currentStockKg:17}};
  store.transact(()=>{store.set('stock',17);store.enqueue(event);});
  assert.equal((await call('/api/sync/push','POST',{tenantId:'A',events:store.value.outbox},a)).status,200);
  // Simulate transport loss after the real server commit: intentionally do not acknowledge locally.
  await store.close();
  const reopened=new AtomicStore(identity,{},storage);await reopened.acquire();
  try {
    assert.equal(reopened.read('stock'),17);assert.equal(reopened.value.outbox.length,1);
    const response=await call('/api/sync/push','POST',{tenantId:'A',events:reopened.value.outbox},a);
    assert.equal(response.status,200);
    reopened.acknowledge(new Set((await response.json()).acceptedIds));
    assert.equal(reopened.value.outbox.length,0);
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM sync_events_v2 WHERE id='lost-response-event'").first()).n,1);
    assert.equal(reopened.read('stock'),17);
  } finally {await reopened.close();}
});
test('authoritative restore events require tenant-wide administrators and round-trip unchanged', async () => {
  const before=await db.prepare("SELECT COALESCE(MAX(sequence), 0) AS cursor FROM sync_events_v2 WHERE tenant_id = 'A'").first();
  const snapshot={version:4,tenantId:'A',syncCursor:before.cursor,settings:{},products:[],customers:[],invoices:[],expenses:[],
    expenseCategories:[],damagedItems:[],workers:[],workerTransactions:[],customerPayments:[],purchases:[],suppliers:[],
    supplierPayments:[],salesReturns:[],purchaseReturns:[],partners:[],partnerDrawings:[],profitDistributions:[],
    branches:[{id:'fixture-a-main',tenantId:'A'}],activeBranchId:'fixture-a-main',stockTransfers:[]};
  const id='restore-api-fixture';
  const event={id,tenantId:'A',entityType:'restore_snapshot',entityId:id,action:'create',payload:{id,snapshot}};
  assert.equal((await call('/api/sync/push','POST',{tenantId:'A',events:[event]},staff)).status,403);
  const accepted=await call('/api/sync/push','POST',{tenantId:'A',events:[event]},a);
  assert.equal(accepted.status,200,await accepted.text());
  assert.equal((await call('/api/sync/push','POST',{tenantId:'A',events:[event]},a)).status,200);
  const later={id:'post-restore-api-fixture',entityType:'product',entityId:'post-restore-product',action:'create',payload:{id:'post-restore-product',name:'Later'}};
  assert.equal((await call('/api/sync/push','POST',{tenantId:'A',events:[later]},a)).status,200);
  const pulled=await call(`/api/sync/pull?tenantId=A&cursor=${before.cursor}`,'GET',undefined,a).then(r=>r.json());
  assert.deepEqual(pulled.events.find(item=>item.id===id)?.payload,event.payload);
  assert.equal(pulled.events.some(item=>item.id===later.id),false);
  assert.equal(pulled.hasMore,true);
  const next=await call(`/api/sync/pull?tenantId=A&cursor=${pulled.nextCursor}`,'GET',undefined,a).then(r=>r.json());
  assert.equal(next.events.some(item=>item.id===later.id),true);
  const oversized={...event,id:'restore-too-large',entityId:'restore-too-large',payload:{id:'restore-too-large',snapshot:{...snapshot,padding:'x'.repeat(5*1024*1024)}}};
  assert.equal((await call('/api/sync/push','POST',{tenantId:'A',events:[oversized]},a)).status,400);
});
test('backup round trip preserves data', async () => {
  const snapshot={products:[{id:'p',tenantId:'A',currentStockKg:17.25}],customers:[]};
  assert.equal((await call('/api/backup','POST',{tenantId:'A',snapshot},a)).status,200);
  const read=await call('/api/backup?tenantId=A&latest=true','GET',undefined,a).then(r=>r.json());
  assert.deepEqual(read.backup.snapshot,snapshot);
});
test('session identity is sanitized and follows the database, not request hints', async () => {
  const response = await call('/api/auth/me?tenantId=B&role=super_admin','GET',undefined,a);
  assert.equal(response.status,200);
  const result = await response.json();
  assert.equal(result.user.tenantId,'A');
  assert.equal(result.user.role,'company_owner');
  assert.equal(result.user.password_hash,undefined);
  assert.equal(result.user.token,undefined);
  assert.equal(result.user.syncScopeVersion,0);
});
test('staff authorization changes revoke the old session and advance the client sync scope', async () => {
  const beforeResponse=await call('/api/tenants/lookup','POST',{storeCode:'A',username:'cashier',password:pass});
  const before=await beforeResponse.json();
  assert.equal(beforeResponse.status,200);
  const changed=await call('/api/users','PATCH',{tenantId:'A',id:'staff',name:'Cashier',username:'cashier',
    role:'cashier',status:'active',branchId:'fixture-a-main',phone:'',permissions:{}},a);
  assert.equal(changed.status,200,await changed.text());
  assert.equal((await call('/api/auth/me','GET',undefined,before.session.token)).status,401);
  const afterResponse=await call('/api/tenants/lookup','POST',{storeCode:'A',username:'cashier',password:pass});
  const after=await afterResponse.json();
  assert.equal(afterResponse.status,200);
  assert.equal(after.user.branchId,'fixture-a-main');
  assert.equal(after.user.syncScopeVersion,before.user.syncScopeVersion+1);
  const verified=await call('/api/auth/me','GET',undefined,after.session.token).then(response=>response.json());
  assert.equal(verified.user.syncScopeVersion,after.user.syncScopeVersion);
  staff=after.session.token;
});
test('recovery tokens are tenant-scoped, one-use, and revoke existing sessions', async () => {
  assert.equal((await call('/api/auth/recovery-token','POST',{tenantId:'B',userId:'staff'},a)).status,403);
  assert.equal((await call('/api/auth/recovery-token','POST',{tenantId:'A',userId:'staff'},staff)).status,403);
  const issued = await call('/api/auth/recovery-token','POST',{tenantId:'A',userId:'staff'},a).then(r=>r.json());
  assert.ok(issued.resetToken);
  const newPassword=crypto.randomUUID()+'Aa!';
  assert.equal((await call('/api/auth/reset','POST',{resetToken:issued.resetToken,newPassword})).status,200);
  assert.equal((await call('/api/auth/me','GET',undefined,staff)).status,401);
  assert.equal((await call('/api/auth/reset','POST',{resetToken:issued.resetToken,newPassword})).status,400);
  staff=await login('A','cashier',newPassword);
});
test('trusted legacy reset preserves owner, admin, staff and disabled identities without accepting plaintext', async () => {
  assert.throws(()=>legacyReset.prepareLegacyReset({tenantId:"LEGACY';DROP",principalType:'user',principalId:'staff'}));
  assert.throws(()=>legacyReset.prepareLegacyReset({tenantId:'LEGACY',principalType:'tenant',principalId:'OTHER'}));
  const legacyCall=(path,method,body,token)=>call(path,method,body,token,'legacy-reset-fixture');
  const oldHashed=await hashPassword(pass);
  await db.prepare("INSERT INTO tenants (id,store_code,company_name,username,password_hash,status,role) VALUES ('LEGACY','LEGACY','Legacy company','legacyowner',?,'active','company_owner')")
    .bind(oldHashed).run();
  const oldOwnerResponse=await legacyCall('/api/tenants/lookup','POST',{storeCode:'LEGACY',username:'legacyowner',password:pass});
  assert.equal(oldOwnerResponse.status,200);
  const oldOwnerToken=(await oldOwnerResponse.json()).session.token;
  await db.prepare("UPDATE tenants SET password_hash='OldPlain123!' WHERE id='LEGACY'").run();
  for(const [id,role,status] of [['legacy-normal','cashier','active'],['legacy-admin','admin','active'],['legacy-disabled','cashier','disabled']])
    await db.prepare('INSERT INTO users (id,tenant_id,name,username,password_hash,role,status,permissions_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id,'LEGACY',id,id,'OldPlain123!',role,status,'{"reports":true}').run();
  for(const username of ['legacyowner','legacy-normal','legacy-admin','legacy-disabled'])
    assert.equal((await legacyCall('/api/tenants/lookup','POST',{storeCode:'LEGACY',username,password:'OldPlain123!'})).status,401);
  const issue=async(type,id)=>{
    const prepared=legacyReset.prepareLegacyReset({tenantId:'LEGACY',principalType:type,principalId:id});
    assert.equal(prepared.sql.includes(prepared.token),false);
    assert.equal((await db.prepare(prepared.sql).run()).meta.changes,1);
    return prepared.token;
  };
  const freshPassword=crypto.randomUUID()+'Aa!';
  for(const [type,id] of [['tenant','LEGACY'],['user','legacy-normal'],['user','legacy-admin'],['user','legacy-disabled']]){
    const resetToken=await issue(type,id);
    assert.equal((await legacyCall('/api/auth/reset','POST',{resetToken,newPassword:freshPassword})).status,200);
    assert.equal((await legacyCall('/api/auth/reset','POST',{resetToken,newPassword:freshPassword})).status,400);
  }
  assert.equal((await legacyCall('/api/auth/me','GET',undefined,oldOwnerToken)).status,401);
  assert.equal((await legacyCall('/api/tenants/lookup','POST',{storeCode:'LEGACY',username:'legacyowner',password:'WrongPassword123!'})).status,401);
  for(const [username,role] of [['legacyowner','company_owner'],['legacy-normal','cashier'],['legacy-admin','admin']]){
    const response=await legacyCall('/api/tenants/lookup','POST',{storeCode:'LEGACY',username,password:freshPassword});
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.user.role,role);assert.equal(body.user.tenantId,'LEGACY');
  }
  assert.equal((await legacyCall('/api/tenants/lookup','POST',{storeCode:'LEGACY',username:'legacy-disabled',password:freshPassword})).status,401);
  const {results:users}=await db.prepare("SELECT id,tenant_id,role,status,permissions_json FROM users WHERE tenant_id='LEGACY' ORDER BY id").all();
  assert.deepEqual(users.map(row=>[row.id,row.tenant_id,row.role,row.status,row.permissions_json]),[
    ['legacy-admin','LEGACY','admin','active','{"reports":true}'],
    ['legacy-disabled','LEGACY','cashier','disabled','{"reports":true}'],
    ['legacy-normal','LEGACY','cashier','active','{"reports":true}']
  ]);
});
test('session expiration compares dates, including the same calendar day', async () => {
  const token=await login('A','ownerA');
  await db.prepare("UPDATE sessions SET expires_at = strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 minute') WHERE principal_id = 'A'").run();
  assert.equal((await call('/api/users?tenantId=A','GET',undefined,token)).status,401);
  a=await login('A','ownerA');
});
test('tenant suspension immediately invalidates staff sessions', async () => {
  await db.prepare("UPDATE tenants SET status='suspended' WHERE id='A'").run();
  assert.equal((await call('/api/sync/pull?tenantId=A','GET',undefined,staff)).status,401);
  await db.prepare("UPDATE tenants SET status='active' WHERE id='A'").run();
  a=await login('A','ownerA');
});
test('logout revokes token server-side', async () => {
  assert.equal((await call('/api/auth/logout','POST',{},a)).status,200);
  assert.equal((await call('/api/users?tenantId=A','GET',undefined,a)).status,401);
});
test('platform owner securely initializes and changes email/password with audit and session revocation', async () => {
  assert.equal((await call('/api/auth/platform-owner','GET',undefined,b)).status,403);
  assert.equal((await call('/api/auth/platform-owner','PATCH',{currentPassword:pass,newEmail:'blocked@example.test'},b)).status,403);

  const initialReset=legacyReset.prepareLegacyReset({tenantId:'PLATFORM',principalType:'tenant',principalId:'PLATFORM'});
  assert.equal(initialReset.sql.includes(initialReset.token),false);
  assert.equal((await db.prepare(initialReset.sql).run()).meta.changes,1);
  const initialPassword=crypto.randomUUID()+'Init!Aa';
  assert.equal((await call('/api/auth/reset','POST',{resetToken:initialReset.token,newPassword:initialPassword})).status,200);
  assert.equal((await call('/api/auth/me','GET',undefined,platform)).status,401);
  assert.equal((await call('/api/auth/reset','POST',{resetToken:initialReset.token,newPassword:initialPassword})).status,400);
  platform=await login('PLATFORM','platform',initialPassword,'platform-owner-initial-login');
  assert.equal((await call('/api/auth/password','POST',{currentPassword:'wrong-password',newPassword:crypto.randomUUID()+'Aa!'},platform)).status,403);
  assert.equal((await call('/api/auth/password','POST',{currentPassword:initialPassword,newPassword:initialPassword},platform)).status,400);
  assert.equal((await call('/api/tenants','PATCH',{id:'PLATFORM',username:'bypass@example.test'},platform)).status,403);

  const profileResponse=await call('/api/auth/platform-owner','GET',undefined,platform);
  assert.equal(profileResponse.status,200);
  const profile=await profileResponse.json();
  assert.equal(profile.owner.email,'platform');
  assert.equal(profile.events.some(event=>event.type==='platform_owner_password_initialized'),true);
  assert.equal(JSON.stringify(profile.events).includes(initialPassword),false);

  assert.equal((await call('/api/auth/platform-owner','PATCH',{
    currentPassword:'incorrect-current-password',newEmail:'owner@example.test'
  },platform)).status,403);
  assert.equal((await call('/api/auth/platform-owner','PATCH',{
    currentPassword:initialPassword,newPassword:'AnotherStrongPassword!24',confirmPassword:'mismatch'
  },platform)).status,400);
  assert.equal((await call('/api/auth/platform-owner','PATCH',{
    currentPassword:initialPassword,newEmail:'ownera'
  },platform)).status,400);
  await db.prepare("INSERT INTO users(id,tenant_id,name,username,password_hash,role,status,permissions_json) VALUES('email-conflict','A','Conflict','taken@example.test',?,'cashier','active','{}')")
    .bind(await hashPassword(crypto.randomUUID()+'Aa!')).run();
  assert.equal((await call('/api/auth/platform-owner','PATCH',{
    currentPassword:initialPassword,newEmail:'taken@example.test'
  },platform)).status,409);

  const replacementPassword=crypto.randomUUID()+'Next!Aa';
  const changed=await call('/api/auth/platform-owner','PATCH',{
    currentPassword:initialPassword,newEmail:'owner@example.test',
    newPassword:replacementPassword,confirmPassword:replacementPassword
  },platform);
  assert.equal(changed.status,200,await changed.text());
  assert.equal((await call('/api/auth/me','GET',undefined,platform)).status,401);
  assert.equal((await call('/api/tenants/lookup','POST',{storeCode:'PLATFORM',username:'platform',password:initialPassword},undefined,'platform-owner-old-login')).status,401);
  platform=await login('PLATFORM','owner@example.test',replacementPassword,'platform-owner-replacement-login');
  const me=await call('/api/auth/me','GET',undefined,platform).then(response=>response.json());
  assert.equal(me.user.role,'super_admin');
  const events=await call('/api/auth/platform-owner','GET',undefined,platform).then(response=>response.json());
  const credentialEvent=events.events.find(event=>event.type==='platform_owner_credentials_changed');
  assert.deepEqual(credentialEvent.metadata.fields,['email','password']);
  assert.equal(credentialEvent.metadata.allSessionsRevoked,true);
  assert.equal(JSON.stringify(credentialEvent).includes(replacementPassword),false);
  assert.equal((await db.prepare("SELECT role FROM tenants WHERE id='PLATFORM'").first()).role,'super_admin');

  const genericPassword=crypto.randomUUID()+'Generic!Aa';
  const genericChange=await call('/api/auth/password','POST',{
    currentPassword:replacementPassword,newPassword:genericPassword
  },platform);
  assert.equal(genericChange.status,200,await genericChange.text());
  assert.equal((await call('/api/auth/me','GET',undefined,platform)).status,401);
  assert.equal((await call('/api/tenants/lookup','POST',{
    storeCode:'PLATFORM',username:'owner@example.test',password:replacementPassword
  },undefined,'platform-owner-generic-old-login')).status,401);
  platform=await login('PLATFORM','owner@example.test',genericPassword,'platform-owner-generic-new-login');
  const afterGeneric=await call('/api/auth/platform-owner','GET',undefined,platform).then(response=>response.json());
  assert.equal(afterGeneric.events.some(event=>event.type==='platform_owner_credentials_changed' &&
    event.metadata.fields.length===1 && event.metadata.fields[0]==='password'),true);
});
test('plaintext records never authenticate', async () => {
  await db.prepare("UPDATE tenants SET password_hash=? WHERE id='B'").bind(pass).run();
  assert.equal((await call('/api/tenants/lookup','POST',{storeCode:'B',username:'ownerB',password:pass},undefined,'plaintext-login-test')).status,401);
});
test('owner grants specific branches; staff cannot see other branch events or administer users', async () => {
  a=await login('A','ownerA');
  const aggregateWrite=await call('/api/sync/push','POST',{tenantId:'A',events:[{
    id:'aggregate-write-denied',tenantId:'A',branchId:'all',entityType:'expense',entityId:'aggregate-write-denied',
    action:'create',payload:{id:'aggregate-write-denied',tenantId:'A',branchId:'all',amount:1}
  }]},a);
  assert.equal(aggregateWrite.status,400);
  const unscopedWrite=await call('/api/sync/push','POST',{tenantId:'A',events:[{
    id:'unscoped-write-denied',tenantId:'A',entityType:'expense',entityId:'unscoped-write-denied',
    action:'create',payload:{id:'unscoped-write-denied',tenantId:'A',amount:1}
  }]},a,'unscoped-write',false);
  assert.equal(unscopedWrite.status,400);
  const second='fixture-a-second-grants';
  await db.prepare('INSERT INTO branches (id,tenant_id,name,code,is_main,status) VALUES (?,?,?,?,0,?)')
    .bind(second,'A','Second branch','SECOND','active').run();
  const username='grant-' + crypto.randomUUID();
  const createdResponse=await call('/api/users','POST',{tenantId:'A',name:'Branch accountant',username,
    password:pass,role:'custom',status:'active',branchIds:['fixture-a-main',second],
    permissions:{canViewInvoices:true,canManageInventory:true}},a);
  const createdBody=await createdResponse.json();
  assert.equal(createdResponse.status,201,JSON.stringify(createdBody));
  const created=createdBody.user;
  const loginResponse=await call('/api/tenants/lookup','POST',{storeCode:'A',username,password:pass},undefined,'branch-grant-first-login');
  assert.equal(loginResponse.status,200);
  const signed=await loginResponse.json();
  assert.deepEqual(signed.user.branchIds,['fixture-a-main',second]);
  assert.deepEqual(signed.branches.map(row=>row.id).sort(),['fixture-a-main',second].sort());
  const cursor=(await db.prepare("SELECT COALESCE(MAX(sequence),0) AS n FROM sync_events_v2 WHERE tenant_id='A'").first()).n;
  for(const [suffix,branch] of [['one','fixture-a-main'],['two',second],['global',null]])
    await db.prepare('INSERT INTO sync_events_v2 (id,tenant_id,branch_id,entity_type,entity_id,action,payload_json,client_timestamp,server_timestamp) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(`grants-${suffix}`,'A',branch,'invoice',`grants-${suffix}`,'create',JSON.stringify({id:`grants-${suffix}`,tenantId:'A',branchId:branch}),1,1).run();
  const pull=await call(`/api/sync/pull?tenantId=A&cursor=${cursor}`,'GET',undefined,signed.session.token);
  assert.equal(pull.status,200);
  assert.deepEqual((await pull.json()).events.map(event=>event.entityId),['grants-one','grants-two']);
  assert.equal((await call('/api/users','POST',{tenantId:'A'},signed.session.token)).status,403);
  const changed=await call('/api/users','PATCH',{tenantId:'A',id:created.id,branchIds:[second]},a);
  assert.equal(changed.status,200);
  assert.equal((await call(`/api/sync/pull?tenantId=A&cursor=${cursor}`,'GET',undefined,signed.session.token)).status,401);
  const narrowedResponse=await call('/api/tenants/lookup','POST',{storeCode:'A',username,password:pass},undefined,'branch-grant-second-login');
  assert.equal(narrowedResponse.status,200,JSON.stringify(await narrowedResponse.clone().json()));
  const narrowed=await narrowedResponse.json();
  assert.deepEqual(narrowed.branches.map(row=>row.id),[second]);
  const narrowPull=await call(`/api/sync/pull?tenantId=A&cursor=${cursor}`,'GET',undefined,narrowed.session.token);
  assert.deepEqual((await narrowPull.json()).events.map(event=>event.entityId),['grants-two']);
  const forbiddenWrite=await call('/api/sync/push','POST',{tenantId:'A',events:[{
    id:'grant-forbidden-write',tenantId:'A',branchId:'fixture-a-main',entityType:'invoice',entityId:'grant-forbidden-write',
    action:'create',payload:{id:'grant-forbidden-write',tenantId:'A',branchId:'fixture-a-main'}
  }]},narrowed.session.token);
  assert.equal(forbiddenWrite.status,403);
  const crossBranchEdit=await call('/api/sync/push','POST',{tenantId:'A',events:[{
    id:'grant-cross-branch-edit',tenantId:'A',branchId:second,entityType:'invoice',entityId:'grants-one',
    action:'update',payload:{id:'grants-one',tenantId:'A',branchId:second,notes:'wrong branch'}
  }]},a);
  assert.equal(crossBranchEdit.status,403);
  await db.prepare('INSERT INTO sync_events_v2 (id,tenant_id,branch_id,entity_type,entity_id,action,payload_json,client_timestamp,server_timestamp) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind('grant-customer-event','A','fixture-a-main','customer','grant-customer','create',
      JSON.stringify({id:'grant-customer',tenantId:'A',branchId:'fixture-a-main'}),1,1).run();
  const crossBranchCustomer=await call('/api/sync/push','POST',{tenantId:'A',events:[{
    id:'grant-cross-customer',tenantId:'A',branchId:second,entityType:'invoice',entityId:'grant-new-invoice',
    action:'create',payload:{id:'grant-new-invoice',tenantId:'A',branchId:second,customerId:'grant-customer'}
  }]},a);
  assert.equal(crossBranchCustomer.status,403);
  const transferCursor=(await db.prepare("SELECT COALESCE(MAX(sequence),0) AS n FROM sync_events_v2 WHERE tenant_id='A'").first()).n;
  const transferGroup=crypto.randomUUID();
  for (const [id,branch,type] of [
    ['grant-transfer-source','fixture-a-main','product'],
    ['grant-transfer-destination',second,'product'],
    ['grant-transfer-audit',null,'stock_transfer']
  ]) await db.prepare('INSERT INTO sync_events_v2 (id,tenant_id,branch_id,entity_type,entity_id,action,payload_json,client_timestamp,server_timestamp,group_id) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .bind(id,'A',branch,type,id,'create',JSON.stringify({id,...(branch ? {branchId:branch} : {})}),1,1,transferGroup).run();
  const transferPull=await call(`/api/sync/pull?tenantId=A&cursor=${transferCursor}`,'GET',undefined,narrowed.session.token);
  assert.equal(transferPull.status,200);
  const transferPage=await transferPull.json();
  assert.equal(transferPage.fullTenantVisibility,false);
  assert.deepEqual(transferPage.events.map(event=>event.id),['grant-transfer-destination']);
  assert.equal(transferPage.nextCursor > transferCursor,true);
});
