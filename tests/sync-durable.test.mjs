import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CloudflareSyncService } from '../src/services/cloudflareSync.js';
import { setSessionToken, setSessionUser } from '../src/services/authSession.js';
import { AtomicStore } from '../src/services/atomicStore.js';
import { attachConflictPreconditions, SYNC_HEADS_STATE_KEY } from '../src/services/syncConflictPolicy.js';
import { replayReviewedLedger } from '../src/services/reviewLedgerReplay.js';

const memoryStorage = () => {
  const rows = new Map();
  return {
    getItem: key => rows.get(key) ?? null,
    setItem: (key, value) => { rows.set(key, String(value)); },
    removeItem: key => { rows.delete(key); },
    clear: () => rows.clear(), key: index => [...rows.keys()][index] ?? null,
    get length() { return rows.size; }
  };
};

test('an owner-resolved original triggers authenticated recovery and waits for local durable installation',async()=>{
  const oldSession=globalThis.sessionStorage,oldFetch=globalThis.fetch;
  globalThis.sessionStorage=memoryStorage();setSessionToken('fixture-token');
  const identity={id:'reviewed-user',tenantId:'reviewed-tenant',branchIds:['main']};setSessionUser({...identity,sessionExpiresAt:new Date(Date.now()+60000).toISOString()});
  const repository=new AtomicStore(identity,{khodar_pos_branches_v1:[{id:'main',tenantId:identity.tenantId}],khodar_pos_active_branch_id_v1:'main'},memoryStorage());await repository.acquire();
  repository.transact(()=>repository.enqueue({id:'reviewed-original',tenantId:identity.tenantId,branchId:'main',entityType:'expense',entityId:'exp',action:'create',payload:{id:'exp',branchId:'main',amount:8}}));
  const queue=structuredClone(repository.current.outbox),before=JSON.stringify(repository.value);
  const service=new CloudflareSyncService();service.repository=repository;service.isOnline=true;service.currentTenantId=identity.tenantId;
  service.updateHandler=(_events,_cursor,_heads,_partial,proposal)=>repository.installReviewedResolution(proposal);
  globalThis.fetch=async url=>url.endsWith('/resolutions')?Response.json({success:true,ready:true,protocol:'owner-reviewed-ledger-v1',tenantId:identity.tenantId,
    completeHistory:true,history:[],queue,branches:[{id:'main',tenantId:identity.tenantId}],nextCursor:0,conflictHeads:{},
    receipts:[{reviewId:'resolved',tenantId:identity.tenantId,choice:'server',events:queue,acceptedEventIds:[]}]}):
    Response.json({error:'Source resolved by company owner; recover reviewed checkpoint'},{status:409});
  try{
    repository.durable={commit:async()=>{throw Error('review quota');}};
    assert.equal(await service.flushQueue({pullAfterFlush:false}),false);assert.equal(JSON.stringify(repository.value),before);assert.equal(service.lastError,'review quota');
    repository.durable=null;
    assert.equal(await service.flushQueue({pullAfterFlush:false}),true);assert.equal(repository.current.outbox.length,0);
    assert.equal(repository.read('braka_review_recovery_archive_v1')[0].original.outbox[0].id,'reviewed-original');
  }finally{service.stopAutoSync();await repository.close();globalThis.fetch=oldFetch;globalThis.sessionStorage=oldSession;}
});

test('paginated owner recovery preserves the outbox on quota failure and cancels a stale account response',async()=>{
  const previousSession=globalThis.sessionStorage,previousFetch=globalThis.fetch;
  globalThis.sessionStorage=memoryStorage();
  const identity={id:'large-recovery-user',tenantId:'large-recovery-tenant',branchIds:['main']};
  setSessionToken('fixture-token');setSessionUser({...identity,sessionExpiresAt:new Date(Date.now()+60000).toISOString()});
  const branch={id:'main',tenantId:identity.tenantId,name:'Main'};
  const repository=new AtomicStore(identity,{khodar_pos_branches_v1:[branch],khodar_pos_active_branch_id_v1:'main'},memoryStorage());
  await repository.acquire();
  repository.transact(()=>repository.enqueue({id:'large-recovery-original',tenantId:identity.tenantId,branchId:'main',entityType:'expense',entityId:'exp',action:'create',payload:{id:'exp',branchId:'main',amount:8}}));
  const queue=structuredClone(repository.current.outbox),before=JSON.stringify(repository.value);
  const proposal={success:true,ready:true,protocol:'owner-reviewed-checkpoint-v2',tenantId:identity.tenantId,
    completeHistory:false,validatedThroughCursor:2201,history:[],queue,branches:[branch],nextCursor:2201,conflictHeads:{},
    checkpoint:replayReviewedLedger([],identity.tenantId,{branches:[branch]}),
    receipts:[{reviewId:'large-resolved',tenantId:identity.tenantId,choice:'server',events:queue,acceptedEventIds:[]}]};
  const service=new CloudflareSyncService();service.repository=repository;service.isOnline=true;service.currentTenantId=identity.tenantId;
  service.updateHandler=(_events,_cursor,_heads,_partial,value)=>repository.installReviewedResolution(value);
  const statuses=[];service.subscribe(value=>statuses.push(value.status));
  let pages=0;
  globalThis.fetch=async(url,options)=>{
    if(!url.endsWith('/resolutions'))return Response.json({error:'Source resolved by company owner; recover reviewed checkpoint'},{status:409});
    assert.equal(JSON.parse(options.body).checkpointProtocol,2);
    pages++;
    assert.deepEqual(repository.current.outbox,queue);
    return pages%2===1?Response.json({success:true,ready:false,status:'validating',processedCount:200,totalCount:2201},{status:202}):Response.json(proposal);
  };
  try{
    repository.durable={commit:async()=>{throw Error('paginated review quota');}};
    assert.equal(await service.flushQueue({pullAfterFlush:false}),false);assert.equal(pages,2);
    assert.equal(JSON.stringify(repository.value),before);assert.equal(service.lastError,'paginated review quota');
    assert.equal(statuses.includes('review_resolved'),false);assert.equal(statuses.includes('review_validating'),true);
    let pendingResponse;
    globalThis.fetch=async url=>url.endsWith('/resolutions')?new Promise(resolve=>{pendingResponse=resolve;}):
      Response.json({error:'Source resolved by company owner; recover reviewed checkpoint'},{status:409});
    const stale=service.flushQueue({pullAfterFlush:false});
    for(let i=0;i<20&&!pendingResponse;i++)await new Promise(resolve=>setTimeout(resolve,0));
    assert.ok(pendingResponse);setSessionToken('replacement-account-token');
    pendingResponse(Response.json(proposal));assert.equal(await stale,false);
    assert.equal(JSON.stringify(repository.value),before);assert.equal(statuses.includes('review_resolved'),false);
    setSessionToken('fixture-token');repository.durable=null;
    globalThis.fetch=async url=>url.endsWith('/resolutions')?Response.json(proposal):
      Response.json({error:'Source resolved by company owner; recover reviewed checkpoint'},{status:409});
    assert.equal(await service.flushQueue({pullAfterFlush:false}),true);
    assert.equal(repository.current.outbox.length,0);assert.equal(repository.current.cursor,2201);
    assert.equal(repository.read('braka_review_recovery_archive_v1')[0].original.outbox[0].id,queue[0].id);
    assert.equal(statuses.filter(value=>value==='review_resolved').length,1);
  }finally{service.stopAutoSync();await repository.close();globalThis.fetch=previousFetch;globalThis.sessionStorage=previousSession;}
});

test('stale nonadditive mutations reach owner review without acknowledging or rewriting the local ledger', async()=>{
  const previousSession=globalThis.sessionStorage,previousFetch=globalThis.fetch;
  globalThis.sessionStorage=memoryStorage();
  const identity={id:'review-user',tenantId:'review-tenant'};
  setSessionToken('fixture-token');setSessionUser({...identity,sessionExpiresAt:new Date(Date.now()+60000).toISOString()});
  const repository=new AtomicStore(identity,{marker:1,[SYNC_HEADS_STATE_KEY]:{}},memoryStorage());
  await repository.acquire();
  repository.transact(()=>repository.enqueue({id:'price-edit',tenantId:identity.tenantId,branchId:'main',entityId:'p',entityType:'product',action:'update',payload:{id:'p',price:7}}));
  const service=new CloudflareSyncService();service.isOnline=true;service.currentTenantId=identity.tenantId;service.repository=repository;
  const requests=[],status=[];service.subscribe(value=>status.push(value));
  globalThis.fetch=async(url,options)=>{
    requests.push({url,body:JSON.parse(options.body)});
    return url.endsWith('/conflicts')?Response.json({success:true,reviewId:'review-id',posted:false}):Response.json({error:'Stale multi-device mutation; synchronize and resolve the conflict'},{status:409});
  };
  try{
    const before=JSON.stringify(repository.current);
    assert.equal(await service.flushQueue({pullAfterFlush:false}),false);
    assert.equal(requests.some(item=>item.url.endsWith('/conflicts')),true);
    assert.deepEqual(requests.find(item=>item.url.endsWith('/conflicts')).body.events,repository.current.outbox);
    assert.equal(JSON.stringify(repository.current),before);
    assert.equal(status.some(item=>item.status==='review_pending'&&item.reviewId==='review-id'),true);
    assert.match(service.lastError,/مالك الشركة/);
    assert.equal(status.some(item=>item.status==='synced_batch'),false);
    requests.length=0;
    globalThis.fetch=async(url)=>{requests.push({url});return Response.json({error:'Idempotency conflict'},{status:409});};
    assert.equal(await service.flushQueue({pullAfterFlush:false}),false);
    assert.equal(requests.some(item=>item.url.endsWith('/conflicts')),false);
    assert.equal(JSON.stringify(repository.current),before);
    globalThis.fetch=async(url)=>url.endsWith('/conflicts')?Response.json({error:'Unavailable'},{status:503}):Response.json({error:'Stale multi-device mutation; synchronize and resolve the conflict'},{status:409});
    assert.equal(await service.flushQueue({pullAfterFlush:false}),false);
    assert.equal(JSON.stringify(repository.current),before);
    assert.doesNotMatch(service.lastError,/حُفظ التعارض/);
  }finally{service.stopAutoSync();await repository.close();globalThis.fetch=previousFetch;globalThis.sessionStorage=previousSession;}
});

test('409 sales recovery durably rebases before retrying and only clears an acknowledged invoice', async () => {
  const oldSession = globalThis.sessionStorage, oldFetch = globalThis.fetch;
  globalThis.sessionStorage = memoryStorage();
  const identity = { id: crypto.randomUUID(), tenantId: 'rebase-service' };
  setSessionToken('fixture-token'); setSessionUser({ ...identity, sessionExpiresAt: new Date(Date.now()+60000).toISOString() });
  const backend = memoryStorage(), repository = new AtomicStore(identity, { marker: 0, [SYNC_HEADS_STATE_KEY]: {} }, backend);
  await repository.acquire();
  const sale = id => ({ id, tenantId: identity.tenantId, branchId: 'main', entityId: id, entityType: 'invoice', action: 'create',
    payload: { id, branchId: 'main', status: 'active', items: [] } });
  repository.transact(() => { repository.enqueue(sale('local')); repository.set('marker', 1); });
  const heads = {}, remote = attachConflictPreconditions(sale('remote'), heads);
  const service = new CloudflareSyncService();
  service.isOnline = true; service.currentTenantId = identity.tenantId; service.repository = repository;
  service.updateHandler = (events, cursor, heads, _partial, proposal) =>
    repository.reconcileSales(events, cursor, () => repository.set('marker', 2), heads, proposal);
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push(url);
    if (url.endsWith('/rebase')) return Response.json({ success: true, protocol: 'independent-sales-v1',
      events: [remote], nextCursor: 1, conflictHeads: heads, acceptedIds: [] });
    const event = JSON.parse(options.body).events[0];
    return event.preconditions['domain:inventory'] === 'remote'
      ? Response.json({ success: true, acceptedIds: [event.id] }) : Response.json({ error: 'stale' }, { status: 409 });
  };
  try {
    const before = JSON.stringify(repository.current), write = backend.setItem;
    backend.setItem = () => { throw Error('quota'); };
    assert.equal(await service.flushQueue({pullAfterFlush:false}), false);
    assert.equal(JSON.stringify(repository.current), before);
    assert.equal(service.lastError, 'quota');
    backend.setItem = write;
    assert.equal(await service.flushQueue({pullAfterFlush:false}), false);
    assert.equal(repository.current.outbox.length, 1);
    assert.equal(repository.read('marker'), 2);
    assert.equal(await service.flushQueue({pullAfterFlush:false}), true);
    assert.equal(repository.current.outbox.length, 0);
    assert.equal(repository.read('marker'), 2);
    assert.equal(requests.filter(url=>url.endsWith('/rebase')).length, 2);
  } finally {
    service.stopAutoSync(); await repository.close();
    globalThis.fetch = oldFetch; globalThis.sessionStorage = oldSession;
  }
});

test('server acceptance waits for durable outbox acknowledgement before sync success', async () => {
  const oldSession = globalThis.sessionStorage, oldFetch = globalThis.fetch;
  globalThis.sessionStorage = memoryStorage();
  setSessionToken('fixture-token');
  setSessionUser({ id: 'owner', tenantId: 'test-tenant', sessionExpiresAt: new Date(Date.now() + 60_000).toISOString() });
  const event = { id: 'sale-event', tenantId: 'test-tenant', entityType: 'invoice', entityId: 'sale', action: 'create', payload: { id: 'sale' } };
  const outbox = [event];
  let acknowledge, attempts = 0;
  const service = new CloudflareSyncService();
  service.isOnline = true;
  service.currentTenantId = 'test-tenant';
  service.pullUpdates = async () => 0;
  service.repository = {
    durable: {}, current: { outbox },
    acknowledgeDurable: ids => {
      attempts++;
      return new Promise((resolve, reject) => { acknowledge = { resolve: () => { outbox.splice(0, outbox.length); resolve(undefined); }, reject }; });
    }
  };
  const statuses = [];
  service.subscribe(item => statuses.push(item.status));
  globalThis.fetch = async () => Response.json({ success: true, acceptedIds: ['sale-event'] });
  try {
    const first = service.flushQueue();
    for (let i = 0; i < 20 && !acknowledge; i++) await new Promise(resolve => setTimeout(resolve, 0));
    assert.ok(acknowledge, 'server acknowledgement reached the durable repository');
    assert.equal(service.isSyncing, true);
    assert.deepEqual(outbox.map(item => item.id), ['sale-event']);
    assert.equal(statuses.includes('synced_batch'), false);
    acknowledge.reject(new Error('Injected durable acknowledgement failure'));
    await first;
    assert.equal(service.lastError, 'Injected durable acknowledgement failure');
    assert.deepEqual(outbox.map(item => item.id), ['sale-event']);
    assert.equal(statuses.includes('synced_batch'), false);

    acknowledge = null;
    const retry = service.flushQueue();
    for (let i = 0; i < 20 && !acknowledge; i++) await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(attempts, 2);
    acknowledge.resolve();
    await retry;
    assert.deepEqual(outbox, []);
    assert.equal(service.lastError, null);
    assert.equal(statuses.filter(status => status === 'synced_batch').length, 1);
  } finally {
    globalThis.fetch = oldFetch;
    globalThis.sessionStorage = oldSession;
  }
});

test('incomplete or unrelated server acknowledgement never clears an aggregate event', async () => {
  const oldSession = globalThis.sessionStorage, oldFetch = globalThis.fetch;
  globalThis.sessionStorage = memoryStorage();
  setSessionToken('fixture-token');
  setSessionUser({ id: 'owner', tenantId: 'test-tenant', sessionExpiresAt: new Date(Date.now() + 60_000).toISOString() });
  const event = { id: 'sale-event', tenantId: 'test-tenant', entityType: 'invoice', entityId: 'sale', action: 'create', payload: { id: 'sale' } };
  let acknowledged = 0;
  const service = new CloudflareSyncService();
  service.isOnline = true;
  service.currentTenantId = 'test-tenant';
  service.repository = { current: { outbox: [event] }, acknowledge: () => { acknowledged++; } };
  const statuses = [];
  service.subscribe(item => statuses.push(item.status));
  try {
    for (const ids of [[], ['unrelated-event'], ['sale-event', 'unexpected-event']]) {
      globalThis.fetch = async () => Response.json({ success: true, acceptedIds: ids });
      await service.flushQueue();
      assert.match(service.lastError, /incomplete or unrelated/);
      assert.equal(acknowledged, 0);
      assert.deepEqual(service.repository.current.outbox, [event]);
    }
    assert.equal(statuses.includes('synced_batch'), false);
  } finally {
    service.stopAutoSync();
    globalThis.fetch = oldFetch;
    globalThis.sessionStorage = oldSession;
  }
});

test('causal conflict remains visible, retains local outbox and blocks inbound overwrite', async () => {
  const oldSession=globalThis.sessionStorage,oldFetch=globalThis.fetch;
  globalThis.sessionStorage=memoryStorage();setSessionToken('fixture-token');
  setSessionUser({id:'owner',tenantId:'test-tenant',sessionExpiresAt:new Date(Date.now()+60000).toISOString()});
  const event={id:'stale-sale',tenantId:'test-tenant',entityType:'invoice',entityId:'sale',action:'create',payload:{id:'sale'}};
  let pulls=0,acknowledged=0;const statuses=[];
  const service=new CloudflareSyncService();service.isOnline=true;service.currentTenantId='test-tenant';
  service.repository={current:{outbox:[event]},acknowledge:()=>{acknowledged++;}};
  service.pullUpdates=async()=>{pulls++;return 1;};service.subscribe(state=>statuses.push(state));
  globalThis.fetch=async()=>Response.json({error:'Stale multi-device mutation'},{status:409});
  try {
    const result=await service.syncNow('test-tenant');
    assert.equal(result.success,false);assert.equal(pulls,0);assert.equal(acknowledged,0);
    assert.deepEqual(service.repository.current.outbox,[event]);
    assert.match(service.lastError,/تعارض بين جهازين/);
    assert.equal(statuses.at(-1).status,'error');
  } finally {globalThis.fetch=oldFetch;globalThis.sessionStorage=oldSession;}
});

test('manual sync does not claim success when outbound queue is still pending', async () => {
  const oldSession=globalThis.sessionStorage;
  globalThis.sessionStorage=memoryStorage();setSessionToken('fixture-token');
  const service=new CloudflareSyncService();service.isOnline=true;service.currentTenantId='test-tenant';
  const event={id:'pending',tenantId:'test-tenant',entityType:'invoice',entityId:'sale'};
  service.repository={current:{outbox:[event]}};
  let pulls=0;service.flushQueue=async()=>false;service.pullUpdates=async()=>{pulls++;return 0;};
  try {
    const result=await service.syncNow('test-tenant');
    assert.equal(result.success,false);
    assert.match(result.error,/لم تكتمل مزامنة/);
    assert.equal(pulls,0);
    assert.deepEqual(service.repository.current.outbox,[event]);
  } finally {globalThis.sessionStorage=oldSession;}
});

test('a sale committed during inbound fetch prevents that response overwriting the pending ledger', async () => {
  const oldSession = globalThis.sessionStorage, oldFetch = globalThis.fetch;
  globalThis.sessionStorage = memoryStorage(); setSessionToken('fixture-token');
  const service = new CloudflareSyncService(); service.isOnline = true; service.currentTenantId = 'test-tenant';
  const current = { outbox: [], cursor: 0 }; service.repository = { current };
  let complete, applied = 0;
  globalThis.fetch = () => new Promise(resolve => { complete = resolve; });
  try {
    const pending = service.pullUpdates('test-tenant', () => { applied++; });
    current.outbox.push({ id: 'new-sale', tenantId: 'test-tenant' });
    complete(Response.json({ success: true, events: [{ id: 'remote-snapshot' }], nextCursor: 1, hasMore: false }));
    assert.equal(await pending, 0);
    assert.equal(applied, 0);
    assert.equal(current.cursor, 0);
    assert.equal(current.outbox.length, 1);
  } finally { service.stopAutoSync(); globalThis.fetch = oldFetch; globalThis.sessionStorage = oldSession; }
});

test('manual sync waits for inbound application after a complete outbound flush', async () => {
  const oldSession=globalThis.sessionStorage;
  globalThis.sessionStorage=memoryStorage();setSessionToken('fixture-token');
  const service=new CloudflareSyncService();service.isOnline=true;service.currentTenantId='test-tenant';
  let finishPull,settled=false,pullCalls=0;
  service.flushQueue=async options=>{assert.equal(options.pullAfterFlush,false);return true;};
  service.pullUpdates=()=>{pullCalls++;return new Promise(resolve=>{finishPull=resolve;});};
  try {
    const pending=service.syncNow('test-tenant').then(result=>{settled=true;return result;});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(pullCalls,1);assert.equal(settled,false);
    finishPull(2);
    assert.deepEqual(await pending,{success:true,pulledCount:2});
  } finally {globalThis.sessionStorage=oldSession;}
});

test('activity refresh coalesces navigation and throttles only empty inbound checks', async () => {
  const oldSession = globalThis.sessionStorage;
  globalThis.sessionStorage = memoryStorage(); setSessionToken('fixture-token');
  setSessionUser({ id: 'owner', tenantId: 'test-tenant', sessionExpiresAt: new Date(Date.now() + 60_000).toISOString() });
  const service = new CloudflareSyncService(); service.isOnline = true; service.currentTenantId = 'test-tenant';
  service.repository = { current: { outbox: [] } };
  let flushes = 0, pulls = 0;
  service.flushQueue = async () => { flushes++; return true; };
  service.pullUpdates = async () => { pulls++; service.lastPullAt = Date.now(); return 0; };
  try {
    await Promise.all([service.refreshForActivity(), service.refreshForActivity()]);
    assert.equal(flushes, 1); assert.equal(pulls, 1);
    await service.refreshForActivity();
    assert.equal(pulls, 1);
    service.repository.current.outbox.push({ id: 'queued', tenantId: 'test-tenant' });
    await service.refreshForActivity();
    assert.equal(flushes, 2, 'pending writes must bypass inbound throttling');
    await service.refreshForActivity({ force: true });
    assert.equal(pulls, 3);
  } finally { globalThis.sessionStorage = oldSession; }
});

test('fallback is no faster than one hour and stops without another request', async () => {
  const oldTimeout = globalThis.setTimeout, oldClear = globalThis.clearTimeout;
  const service = new CloudflareSyncService(); service.isOnline = true;
  const timers = new Map(); let nextId = 1, refreshes = 0;
  service.refreshForActivity = async () => { refreshes++; return true; };
  // This test timer has numeric handles; the production Node timer has Timeout handles.
  globalThis.setTimeout = /** @type {typeof globalThis.setTimeout} */ (/** @type {unknown} */ (
    (callback, delay) => { const id = nextId++; timers.set(id, { callback, delay }); return id; }));
  globalThis.clearTimeout = id => { timers.delete(id); };
  try {
    service.startAutoSync('test-tenant');
    assert.equal(refreshes, 1);
    assert.equal(timers.size, 1);
    assert.ok([...timers.values()][0].delay >= 60 * 60_000);
    service.stopAutoSync();
    assert.equal(timers.size, 0);
  } finally { globalThis.setTimeout = oldTimeout; globalThis.clearTimeout = oldClear; }
});

test('inbound refresh drains all pages and advances cursor only after each applied page', async () => {
  const oldSession = globalThis.sessionStorage, oldLocal = globalThis.localStorage, oldFetch = globalThis.fetch;
  globalThis.sessionStorage = memoryStorage(); globalThis.localStorage = memoryStorage();
  setSessionToken('fixture-token');
  setSessionUser({ id: 'owner', tenantId: 'test-tenant', sessionExpiresAt: new Date(Date.now() + 60_000).toISOString() });
  const service = new CloudflareSyncService(); service.isOnline = true; service.currentTenantId = 'test-tenant';
  const urls = [], applied = [];
  globalThis.fetch = async url => {
    urls.push(String(url));
    const first = urls.length === 1;
    return Response.json({ success: true, events: [{ id: first ? 'a' : 'b' }], nextCursor: first ? 10 : 11, hasMore: first });
  };
  try {
    const count = await service.pullUpdates('test-tenant', async events => { applied.push(events[0].id); });
    assert.equal(count, 2);
    assert.deepEqual(applied, ['a', 'b']);
    assert.match(urls[1], /cursor=10/);
    assert.equal(globalThis.localStorage.getItem('braka_sync_cursor_v2_test-tenant_owner'), '11');
  } finally { globalThis.sessionStorage = oldSession; globalThis.localStorage = oldLocal; globalThis.fetch = oldFetch; }
});

test('an event committed during an in-flight push is sent without waiting an hour', async () => {
  const oldSession = globalThis.sessionStorage, oldFetch = globalThis.fetch;
  globalThis.sessionStorage = memoryStorage(); setSessionToken('fixture-token');
  setSessionUser({id:'owner', tenantId:'test-tenant', sessionExpiresAt:new Date(Date.now()+60_000).toISOString()});
  const events = [{id:'first', tenantId:'test-tenant', entityType:'invoice', entityId:'one', action:'create', payload:{id:'one'}}];
  const service = new CloudflareSyncService(); service.isOnline = true; service.currentTenantId = 'test-tenant';
  service.repository = {current:{outbox:events}, acknowledge: accepted => {
    for (let i=events.length-1;i>=0;i--) if (accepted.has(events[i].id)) events.splice(i,1);
  }};
  service.lastPullAt = Date.now();
  let releaseFirst, requests = 0;
  globalThis.fetch = async (_url, init) => {
    requests++;
    const ids = JSON.parse(init.body).events.map(event => event.id);
    if (requests === 1) await new Promise(resolve => { releaseFirst = resolve; });
    return Response.json({success:true, acceptedIds:ids});
  };
  try {
    const first = service.flushQueue();
    for (let i=0;i<20 && !releaseFirst;i++) await new Promise(resolve => setTimeout(resolve,0));
    assert.ok(releaseFirst);
    events.push({id:'second', tenantId:'test-tenant', entityType:'invoice', entityId:'two', action:'create', payload:{id:'two'}});
    releaseFirst(); await first;
    for (let i=0;i<30 && events.length;i++) await new Promise(resolve => setTimeout(resolve,10));
    assert.equal(requests,2);
    assert.deepEqual(events,[]);
  } finally { service.stopAutoSync(); globalThis.sessionStorage=oldSession; globalThis.fetch=oldFetch; }
});
