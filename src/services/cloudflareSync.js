/**
 * Cloudflare Edge Synchronization Service
 * ----------------------------------------------------
 * Background sync between the local POS aggregate and Cloudflare Edge.
 * and Cloudflare Edge (Workers & D1 Database).
 * 
 * Key Principles:
 * 1. A server push is acknowledged locally only after the aggregate queue commit.
 * 2. Immediate outbound delivery; activity-triggered inbound refresh with a rare fallback.
 * 3. Pending mutations remain in the aggregate across retryable network failures.
 * 4. Flush and pull resume once connectivity returns.
 * 5. Multi-Tenant isolation: Per-tenant sync cursor and state partitioning.
 */

import { getApiBaseUrl } from '../config/appVersion.js';
import { isIndependentSalesQueue } from './independentSales.js';
import { INBOUND_REVIEW_KEY } from './atomicStore.js';
import {replayDrawerJournal} from './cashDrawerJournal.js';
import {canAccessBranch} from './branchAccess.js';
import {requestReviewedOperation} from './reviewProgress.js';

const QUEUE_STORAGE_KEY = 'khodar_offline_sync_queue';
const ACTIVITY_REFRESH_MIN_MS = 5 * 60_000;
const FALLBACK_SYNC_MIN_MS = 60 * 60_000;
const FALLBACK_SYNC_JITTER_MS = 60 * 60_000;
const getTenantSyncKey = (tenantId) => `braka_sync_cursor_v2_${tenantId}_${getSessionUser()?.id || 'none'}`;
import { getSessionToken, getSessionUser } from './authSession.js';
const authHeaders = () => {
  const token = getSessionToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export function selectSyncBatch(queue) {
  let count = Math.min(queue.length, 100);
  if (count < queue.length && queue[count - 1].groupId && queue[count - 1].groupId === queue[count].groupId) {
    const splitGroup = queue[count].groupId;
    while (count > 0 && queue[count - 1].groupId === splitGroup) count--;
  }
  if (count === 0) throw new Error('Sync group exceeds server batch limit');
  return queue.slice(0, count);
}

export class CloudflareSyncService {
  constructor() {
    this.isSyncing = false;
    this.isPulling = false;
    this.generation = 0;
    this.lastError = null;
    this.syncIntervalId = null;
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.listeners = new Set();
    this.repository = null;
    this.drawerReplay = null; // Explicit staged opt-in, never enabled by default.
    this.updateHandler = null;
    this.currentTenantId = null;
    this.focusListenerAttached = false;
    this.lastPullAt = 0;
    this.activitySyncPromise = null;
    this.retryTimerId = null;
    this.retryDelayMs = 5_000;
    this.batchTimerId = null;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notifyListeners('online');
        void this.refreshForActivity({ force: true });
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notifyListeners('offline');
      });

      this.setupFocusListeners();
    }
  }

  schedulePendingRetry() {
    if (this.retryTimerId || !this.isOnline || !this.currentTenantId || !getSessionToken()) return;
    if (!this.drawerReplay && !this.getQueue().some(event => event.tenantId === this.currentTenantId)) return;
    const delay = this.retryDelayMs;
    this.retryDelayMs = Math.min(this.retryDelayMs * 2, 5 * 60_000);
    this.retryTimerId = setTimeout(() => {
      this.retryTimerId = null;
      void this.flushQueue();
    }, delay + Math.floor(Math.random() * Math.min(delay, 5_000)));
  }

  setupFocusListeners() {
    if (this.focusListenerAttached || typeof window === 'undefined') return;

    const onWindowActive = () => {
      void this.refreshForActivity();
    };

    window.addEventListener('focus', onWindowActive);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        onWindowActive();
      }
    });

    this.focusListenerAttached = true;
  }

  // Activity refreshes are coalesced and throttled; queued writes are never throttled.
  refreshForActivity({ force = false } = {}) {
    if (!this.isOnline || !this.currentTenantId || !getSessionToken()) return Promise.resolve(false);
    if (this.activitySyncPromise) return this.activitySyncPromise;
    try {
      if (!force && !this.drawerReplay && this.getQueueLength() === 0 && Date.now() - this.lastPullAt < ACTIVITY_REFRESH_MIN_MS)
        return Promise.resolve(true);
    } catch (error) {
      this.lastError = error.message;
      this.notifyListeners('error', { error: error.message });
      return Promise.resolve(false);
    }
    const tenantId = this.currentTenantId;
    const task = (async () => {
      const clear = await this.flushQueue({ pullAfterFlush: false });
      if (!clear || tenantId !== this.currentTenantId) return false;
      await this.pullUpdates(tenantId, this.updateHandler);
      return !this.lastError;
    })().catch(error => {
      this.lastError = error.message;
      this.notifyListeners('error', { error: error.message });
      return false;
    });
    this.activitySyncPromise = task;
    const clearTask = () => { if (this.activitySyncPromise === task) this.activitySyncPromise = null; };
    void task.then(clearTask, clearTask);
    return task;
  }

  // Subscribe to sync status changes (for UI indicators)
  subscribe(callback) {
    this.listeners.add(callback);
    return () => { this.listeners.delete(callback); };
  }

  notifyListeners(status, details = {}) {
    let queueLength = null;
    try { queueLength = this.getQueueLength(); }
    catch (error) {
      status = 'error';
      details = { ...details, error: error.message };
    }
    for (const cb of this.listeners) {
      try {
        cb({ 
          status, 
          isOnline: this.isOnline, 
          queueLength,
          lastSyncTime: this.lastPullAt || null,
          ...details 
        });
      } catch (err) {
        console.error('Error in sync listener:', err);
      }
    }
  }

  getQueue() {
    if (this.repository) return this.repository.current.outbox;
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    const queue = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(queue) || queue.some(event => !event || typeof event.id !== 'string')) {
      throw new Error('Invalid sync queue; original storage has been preserved for recovery');
    }
    return queue;
  }

  getQueueLength() {
    return this.getQueue().filter(event => event.tenantId === getSessionUser()?.tenantId).length;
  }

  saveQueue(queue) {
    // Quota/corruption must never be mistaken for an empty, successfully saved queue.
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  }

  // Record an action to sync (e.g. new invoice, expense, product, customer, stock change)
  recordMutation(tenantId, branchId, entityType, entityId, action, payload) {
    const queue = [...this.getQueue()];
    const eventId = payload?.idempotencyKey 
      ? `evt_${tenantId}_${entityType}_${payload.idempotencyKey}_${action}`
      : `evt_${crypto.randomUUID()}`;

    // Prevent duplicate entries in local sync queue
    if (!this.repository && queue.some(e => e.id === eventId)) {
      return;
    }

    const event = {
      id: eventId,
      tenantId,
      branchId,
      entityType,
      entityId,
      action,
      payload,
      timestamp: Date.now()
    };

    queue.push(event);
    if (this.repository) {
      // Do not flush uncommitted draft state. The periodic sync sees only the commit.
      this.repository.enqueue(event);
      return;
    }
    this.saveQueue(queue);
    this.notifyListeners('queued', { event });

    // Attempt instant background flush if online
    if (this.isOnline && !this.isSyncing) {
      this.flushQueue();
    }
  }

  // Flush queued mutations to Cloudflare
  async flushQueue({ pullAfterFlush = true } = {}) {
    if (this.isSyncing || !this.isOnline || !getSessionToken() || !this.currentTenantId) return false;
    if(this.drawerReplay)return this.flushDrawerJournal();

    const queue = this.getQueue().filter(event => event.tenantId === this.currentTenantId);
    if (queue.length === 0) return true;

    const token = getSessionToken();
    const generation = this.generation;
    this.isSyncing = true;
    this.notifyListeners('syncing');

    try {
      const tenantId = queue[0].tenantId;
      // Preserve commit order across branch and tenant-level events. Never split
      // a local aggregate transaction across two server transactions.
      const batch = selectSyncBatch(queue);

      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/sync/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          tenantId,
          events: batch
        })
      });

      if (token !== getSessionToken() || generation !== this.generation) return;
      if (response.ok) {
        // Remove processed events from queue
        const result = await response.json();
        if (!result.success || !Array.isArray(result.acceptedIds)) throw new Error('Server did not acknowledge mutations');
        const accepted = new Set(result.acceptedIds);
        if (accepted.size !== batch.length || result.acceptedIds.length !== batch.length ||
            batch.some(event => !accepted.has(event.id)))
          throw new Error('Server returned incomplete or unrelated mutation acknowledgement');
        const remainingQueue = this.getQueue().filter(event => !accepted.has(event.id));
        if (this.repository?.durable) await this.repository.acknowledgeDurable(accepted);
        else if (this.repository) this.repository.acknowledge(accepted);
        else this.saveQueue(remainingQueue);
        this.lastError = null;
        this.retryDelayMs = 5_000;
        if (this.retryTimerId) { clearTimeout(this.retryTimerId); this.retryTimerId = null; }
        this.notifyListeners('synced_batch', { count: batch.length });

        // Re-read after the durable acknowledgement: another local commit may
        // have arrived while this request was in flight.
        const pendingForTenant = this.getQueue().some(event => event.tenantId === tenantId);
        if (pendingForTenant) {
          if (!this.batchTimerId) this.batchTimerId = setTimeout(() => {
            this.batchTimerId = null;
            void this.flushQueue();
          }, 100);
        } else {
          // A financial preflight just pulled the latest cursor. Avoid a second
          // empty D1 read after its push; server conflict heads still guard races.
          if (tenantId && pullAfterFlush && Date.now() - this.lastPullAt >= ACTIVITY_REFRESH_MIN_MS) {
            this.pullUpdates(tenantId, this.updateHandler);
          }
        }
        return !pendingForTenant;
      } else {
        const details=await response.json().catch(()=>null);
        if(response.status===409&&details?.error==='Source resolved by company owner; recover reviewed checkpoint'&&
          this.repository&&typeof this.updateHandler==='function'){
          const result=await requestReviewedOperation(()=>fetch(`${baseUrl}/api/sync/resolutions`,{method:'POST',headers:{'Content-Type':'application/json',...authHeaders()},
            body:JSON.stringify({tenantId,events:queue,checkpointProtocol:2})}),{isCurrent:()=>token===getSessionToken()&&generation===this.generation,
            onProgress:data=>this.notifyListeners('review_validating',{processedCount:data.processedCount,totalCount:data.totalCount})});
          if(!result)return false;
          const {response:recovery,data:proposal}=result;
          if(token!==getSessionToken()||generation!==this.generation)return false;
          if(!recovery.ok||!proposal?.success)throw Object.assign(new Error('تعذر استرداد التسوية؛ حُفظت الحركات المحلية دون تغيير'),{nonRetryable:recovery.status===409});
          if(!proposal.ready){
            if(recovery.status===202){this.schedulePendingRetry();return false;}
            const unresolved=new Set(proposal.unresolvedEventIds||[]),remaining=queue.filter(event=>unresolved.has(event.id));
            if(remaining.length){
              await fetch(`${baseUrl}/api/sync/conflicts`,{method:'POST',headers:{'Content-Type':'application/json',...authHeaders()},
                body:JSON.stringify({tenantId,events:selectSyncBatch(remaining)})});
              if(token!==getSessionToken()||generation!==this.generation)return false;
            }
            throw Object.assign(new Error('توجد حركات مترابطة لم يعتمدها المالك بعد؛ لم تتغير البيانات المحلية'),{nonRetryable:true});
          }
          if(!['owner-reviewed-ledger-v1','owner-reviewed-checkpoint-v2'].includes(proposal.protocol)||proposal.tenantId!==tenantId||JSON.stringify(proposal.queue)!==JSON.stringify(queue))throw new Error('Invalid reviewed recovery receipt');
          await this.updateHandler(proposal.history,proposal.nextCursor,proposal.conflictHeads,true,proposal);
          if(token!==getSessionToken()||generation!==this.generation)return false;
          this.lastError=null;this.retryDelayMs=5_000;
          this.notifyListeners('review_resolved',{count:queue.length});
          return this.getQueue().length===0;
        }
        if (response.status === 409 && this.repository && typeof this.updateHandler === 'function' &&
            isIndependentSalesQueue(queue)) {
          const cursor = this.repository.current.cursor;
          const reconciliation = await fetch(`${baseUrl}/api/sync/rebase`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ tenantId, cursor, events: batch })
          });
          if (token !== getSessionToken() || generation !== this.generation) return false;
          if (reconciliation.ok) {
            const proposal = await reconciliation.json();
            if (token !== getSessionToken() || generation !== this.generation) return false;
            if (!proposal.success || proposal.protocol !== 'independent-sales-v1') throw new Error('Invalid reconciliation response');
            await this.updateHandler(proposal.events, proposal.nextCursor, proposal.conflictHeads, true,
              { protocol: proposal.protocol, acceptedIds: proposal.acceptedIds, queue, cursor });
            this.lastError = null;
            // Backoff also bounds repeated races with active cashiers. Never
            // recursively hammer push/rebase or mark unaccepted sales as synced.
            if (this.getQueue().length) this.schedulePendingRetry();
            return this.getQueue().length === 0;
          }
          if (![400, 403, 409].includes(reconciliation.status))
            throw new Error(`Sales reconciliation unavailable: HTTP ${reconciliation.status}`);
        }
        let ownerReviewId=null;
        if(response.status===409&&details?.error==='Stale multi-device mutation; synchronize and resolve the conflict'){
          // Evidence receipt is never a financial acknowledgement. Keep the
          // original optimistic state, event IDs and complete pending group.
          try{
            const reviewResponse=await fetch(`${baseUrl}/api/sync/conflicts`,{
              method:'POST',headers:{'Content-Type':'application/json',...authHeaders()},
              body:JSON.stringify({tenantId,events:batch})
            });
            if(token!==getSessionToken()||generation!==this.generation)return false;
            const review=await reviewResponse.json().catch(()=>null);
            if(token!==getSessionToken()||generation!==this.generation)return false;
            if(reviewResponse.ok&&review?.success===true&&review.posted===false&&typeof review.reviewId==='string'&&review.reviewId){
              ownerReviewId=review.reviewId;
              this.notifyListeners('review_pending',{reviewId:ownerReviewId,count:batch.length});
            }
          }catch{/* Retain the original conflict and queue if evidence upload fails. */}
        }
        const failure = Object.assign(new Error(ownerReviewId
          ? 'حُفظ التعارض لمراجعة مالك الشركة؛ الحركة المحلية لم تُعتمد أو تُحذف'
          : response.status===409
          ? 'تعارض بين جهازين: لم تُرفع الحركة المحلية. زامن وراجع الحركة قبل إعادة المحاولة'
          : details?.error || `Sync push failed: HTTP ${response.status}`),
          { nonRetryable: [400, 401, 403, 409].includes(response.status) });
        throw failure;
      }
    } catch (err) {
      this.lastError = err.message;
      this.notifyListeners('error', { error: err.message });
      console.warn('Cloudflare sync failed (will retry automatically):', err.message);
      if (!err.nonRetryable) this.schedulePendingRetry();
      return false;
    } finally {
      this.isSyncing = false;
      if (!this.lastError) this.notifyListeners('idle');
    }
  }

  async flushDrawerJournal() {
    const configuration=this.drawerReplay,repository=this.repository;
    const token=getSessionToken(),user=getSessionUser(),generation=this.generation;
    this.isSyncing=true;
    const assertCurrent=()=>{
      const current=getSessionUser(),scope=configuration?.scope;
      if(!token || token!==getSessionToken() || generation!==this.generation ||
          configuration!==this.drawerReplay || repository!==this.repository ||
          !scope || this.currentTenantId!==scope.tenantId || current?.id!==user?.id ||
          current?.tenantId!==scope.tenantId || repository?.user?.id!==current?.id ||
          repository.user.tenantId!==scope.tenantId || !canAccessBranch(current,scope.branchId) ||
          repository.read('khodar_pos_active_branch_id_v1')!==scope.branchId)
        throw Object.assign(Error('تغير الحساب أو الفرع أثناء مزامنة الدرج؛ حُفظت المصادر دون تأكيد محلي'),{nonRetryable:true});
    };
    try {
      assertCurrent();this.notifyListeners('syncing');
      const clear=await replayDrawerJournal(repository.durable,configuration.locks,configuration.scope,async proofs=>{
        assertCurrent();
        const response=await fetch(`${getApiBaseUrl()}/api/cash/replay`,{method:'POST',
          headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
          body:JSON.stringify({tenantId:configuration.scope.tenantId,deviceId:configuration.scope.deviceId,
            deviceProof:configuration.deviceProof,proofs})});
        assertCurrent();
        if(!response.ok)throw Object.assign(Error('لم يقبل الخادم سجل الدرج؛ المصادر المحلية محفوظة'),
          {nonRetryable:[400,401,403,409].includes(response.status)});
        return response.json();
      },{repository,assertCurrent});
      assertCurrent();
      // Unjournaled sources must not silently fall back to unsigned push.
      const ownPending=repository.current.outbox.length>0;
      this.lastError=ownPending&&clear?'توجد مصادر غير مرتبطة بسجل الدرج؛ يلزم فحصها قبل المزامنة':null;
      if(clear&&!ownPending)this.notifyListeners('synced_batch');
      if(!clear&&!this.batchTimerId)this.batchTimerId=setTimeout(()=>{
        this.batchTimerId=null;
        if(generation===this.generation)void this.flushQueue();
      },100);
      return clear&&!ownPending;
    } catch(error) {
      if(generation===this.generation && token===getSessionToken() && getSessionUser()?.id===user?.id) {
        this.lastError=error.message;this.notifyListeners('error',{error:error.message});
        if(!error.nonRetryable)this.schedulePendingRetry();
      }
      return false;
    } finally {if(generation===this.generation)this.isSyncing=false;}
  }

  // Pull latest updates from Cloudflare edge
  async pullUpdates(tenantId, onUpdatesReceived = null, forceSince = null) {
    if (!this.isOnline || !tenantId || !getSessionToken() || this.isPulling) return 0;
    if (this.repository?.current.outbox.some(event=>event.tenantId===tenantId)) return 0;
    const token = getSessionToken();
    const generation = this.generation;
    this.isPulling = true;

    const syncKey = getTenantSyncKey(tenantId);
    let cursor = forceSince !== null ? forceSince : this.repository ? this.repository.current.cursor : parseInt(localStorage.getItem(syncKey) || '0', 10);
    const callback = onUpdatesReceived || this.updateHandler;

    try {
      const baseUrl = getApiBaseUrl();
      let received = 0;
      for (let page = 0; page < 100; page++) {
        const res = await fetch(`${baseUrl}/api/sync/pull?tenantId=${encodeURIComponent(tenantId)}&cursor=${cursor}`, { headers: authHeaders() });
        if (!res.ok) throw new Error(`Sync pull failed: HTTP ${res.status}`);
        if (token !== getSessionToken() || generation !== this.generation) return 0;
        const data = await res.json();
        if (token !== getSessionToken() || generation !== this.generation) return 0;
        if (!data.success || !Array.isArray(data.events) || !Number.isSafeInteger(data.nextCursor) || data.nextCursor < cursor)
          throw new Error('Invalid sync response');
        if (data.hasMore && data.nextCursor === cursor) throw new Error('Sync cursor did not advance');
        // A checkout can commit while this network request is in flight.
        // Leave its ledger/cursor intact and let outbound reconciliation run.
        if (this.repository?.current.outbox.some(event => event.tenantId === tenantId)) return received;
        if (typeof callback !== 'function') throw new Error('No durable sync receiver');
        await callback(data.events, data.nextCursor, data.conflictHeads, data.fullTenantVisibility === false);
        const retained=this.repository?.current.state[INBOUND_REVIEW_KEY] || [];
        if(retained.length){
          const products=this.repository.current.state.khodar_pos_products_v3 || [];
          const references=retained.flatMap(group=>group.events).filter(event=>event.entityType==='invoice'&&event.action==='create')
            .flatMap(event=>(event.payload.items||[]).filter(item=>item.productId&&!products.some(product=>product.id===item.productId))
              .map(item=>({parentId:event.id,productId:item.productId}))).slice(0,50);
          if(references.length){
            const proofResponse=await fetch(`${baseUrl}/api/sync/dependencies`,{method:'POST',headers:{...authHeaders(),'Content-Type':'application/json'},body:JSON.stringify({tenantId,references})});
            if(token!==getSessionToken()||generation!==this.generation)return received;
            if(proofResponse.ok){
              const proof=await proofResponse.json();
              if(token!==getSessionToken()||generation!==this.generation)return received;
              if(proof.success&&proof.tenantId===tenantId&&proof.proofs?.length)
                await callback([],this.repository.current.cursor,undefined,true,{protocol:'legacy-product-references-v1',proofs:proof.proofs});
            }
          }
        }
        if (token !== getSessionToken() || generation !== this.generation) return 0;
        if (!this.repository) localStorage.setItem(syncKey, String(data.nextCursor));
        cursor = data.nextCursor;
        received += data.events.length;
        if (!data.hasMore) {
          this.lastPullAt = Date.now();
          this.lastError = null;
          this.notifyListeners('synced_inbound', { count: received });
          return received;
        }
      }
      throw new Error('Sync backlog exceeds 100 pages; retry to continue');
    } catch (err) {
      this.lastError = err.message;
      this.notifyListeners('error', { error: err.message });
      console.warn('Cloudflare pull error:', err.message);
      return 0;
    } finally {
      this.isPulling = false;
    }
  }

  // Fetch the latest full snapshot backup from Cloudflare D1
  async fetchLatestSnapshot(tenantId) {
    if (!this.isOnline || !tenantId) return null;

    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/backup?tenantId=${encodeURIComponent(tenantId)}&latest=true`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.backup?.snapshot) {
          return data.backup.snapshot;
        }
      }
      return null;
    } catch (err) {
      console.warn('Failed to fetch latest cloud snapshot:', err);
      return null;
    }
  }

  // Automated full snapshot backup to Cloudflare R2 / D1
  async uploadBackupSnapshot(tenantId, fullSnapshotData) {
    if (!tenantId || !fullSnapshotData) return false;

    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          tenantId,
          snapshot: fullSnapshotData,
          version: '2.6.4'
        })
      });

      if (res.ok) {
        const result = await res.json();
        return result.success;
      }
      return false;
    } catch (err) {
      console.warn('Automated cloud backup failed:', err);
      return false;
    }
  }

  // Trigger immediate bidirectional sync on demand
  async syncNow(tenantId, onUpdatesReceived = null) {
    const targetTenant = tenantId || this.currentTenantId;
    if (!targetTenant) return { success: false, error: 'No active tenant' };

    if (!this.isOnline || !getSessionToken()) return { success: false, error: 'Offline or unauthenticated' };
    if (this.isSyncing || this.isPulling) return { success: false, error: 'Sync already in progress' };
    this.lastError = null;
    this.notifyListeners('syncing');
    const clear = await this.flushQueue({ pullAfterFlush: false });
    if (!clear && !this.lastError) {
      this.lastError = 'لم تكتمل مزامنة العمليات المعلقة؛ أعد المحاولة';
      this.notifyListeners('error', { error: this.lastError });
    }
    const pulled = clear ? await this.pullUpdates(targetTenant, onUpdatesReceived || this.updateHandler) : 0;
    if (!this.lastError) this.notifyListeners('idle', { pulledCount: pulled });
    return { success: clear && !this.lastError, pulledCount: pulled, ...(this.lastError ? { error: this.lastError } : {}) };
  }

  // Online financial commits must read the latest available server cursor first.
  // Offline commits remain local and pending; server causal checks still decide
  // whether a concurrently-created mutation is acceptable when it is pushed.
  async prepareFinancialMutation(tenantId, onUpdatesReceived = null) {
    if (!this.isOnline) return { success: true, offline: true };
    const deadline = Date.now() + 15_000;
    while (this.isSyncing || this.isPulling || this.activitySyncPromise) {
      if (Date.now() >= deadline) return { success: false, error: 'المزامنة مشغولة؛ أعد المحاولة بعد قليل' };
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return this.syncNow(tenantId, onUpdatesReceived);
  }

  // Set handler for applying inbound synced events to local store
  setUpdateHandler(handler) {
    this.updateHandler = handler;
  }

  // Rare recovery fallback. Normal inbound refresh is triggered by user activity.
  startAutoSync(tenantId, onUpdatesReceived = null, intervalMs = FALLBACK_SYNC_MIN_MS, drawerReplay = null) {
    this.stopAutoSync();
    this.currentTenantId = tenantId;
    this.drawerReplay=drawerReplay;
    if (onUpdatesReceived) {
      this.updateHandler = onUpdatesReceived;
    }

    // Immediate initial sync (do not wait for the fallback timer).
    if (tenantId && this.isOnline) {
      void this.refreshForActivity({ force: true });
    }
    const scheduleFallback = () => {
      this.syncIntervalId = setTimeout(() => {
        if (this.currentTenantId === tenantId && this.isOnline) void this.refreshForActivity({ force: true });
        if (this.currentTenantId === tenantId) scheduleFallback();
      }, intervalMs + Math.floor(Math.random() * FALLBACK_SYNC_JITTER_MS));
    };
    scheduleFallback();
  }

  stopAutoSync() {
    this.generation++;
    this.drawerReplay=null;
    this.isSyncing=false;
    this.currentTenantId = null;
    if (this.syncIntervalId) {
      clearTimeout(this.syncIntervalId);
      this.syncIntervalId = null;
    }
    if (this.retryTimerId) {
      clearTimeout(this.retryTimerId);
      this.retryTimerId = null;
    }
    if (this.batchTimerId) {
      clearTimeout(this.batchTimerId);
      this.batchTimerId = null;
    }
  }
}

export const cloudflareSync = new CloudflareSyncService();
