import { openShift, postCashEvent, closeShift } from './cashShiftEngine.js';
import { assertVerifiedOfflineGrant } from './verifiedOfflineGrant.js';
import {signOfflineCashEvent} from './offlineUnlock.js';
import {cashMovementFromRecord} from './cashMovement.js';
import {assertInvoiceVoidPayload,assertInvoiceUpdatePayload} from './invoiceMutationPolicy.js';

const SHIFT_KEY = 'khodar_pos_cash_shifts_v1';
const part = value => encodeURIComponent(value);
const keyFor = ({ tenantId, branchId, drawerId, deviceId }) =>
  `braka:${part(tenantId)}:${part(branchId)}:${part(drawerId)}:${part(deviceId)}:cash_drawer_journal_v1`;

// Staged transport boundary: send authenticates the current uploader/device.
// Preserve every original proof; acknowledgements never migrate another
// cashier's sources into this user's financial aggregate.
export async function replayDrawerJournal(durable,locks,scope,send,{repository=null,assertCurrent=()=>{}}={}) {
  if (!durable?.read || !durable?.commit || !durable?.commitBatch || !locks?.request || typeof send!=='function' ||
      ['tenantId','branchId','drawerId','deviceId'].some(name=>typeof scope?.[name]!=='string'||!scope[name]))
    throw Error('Invalid drawer replay scope');
  if(repository && (repository.durable!==durable || repository.user?.tenantId!==scope.tenantId))
    throw Error('Drawer acknowledgement repository scope mismatch');
  const key=keyFor(scope);
  assertCurrent();
  const validate=saved=>{
    if(!saved || !Number.isSafeInteger(saved.revision) || !Array.isArray(saved.sources) ||
        Object.entries(scope).some(([name,value])=>saved[name]!==value) ||
        saved.sources.some(proof=>!proof?.source?.id||proof.source.tenantId!==scope.tenantId||
          proof.source.branchId!==scope.branchId) ||
        new Set(saved.sources.map(proof=>proof.source.id)).size!==saved.sources.length ||
        (saved.acceptedIds!==undefined&&(!Array.isArray(saved.acceptedIds)||
          saved.acceptedIds.some(id=>!saved.sources.some(proof=>proof.source.id===id)))))
      throw Error('Invalid durable drawer replay journal');
    return saved;
  };
  const saved=validate(await durable.read(key)),accepted=new Set(saved.acceptedIds||[]);
  const pending=saved.sources.filter(proof=>!accepted.has(proof.source.id));
  // Never split the actual app's atomic commit group at the API's 100 limit.
  let end=Math.min(100,pending.length);
  if(end<pending.length&&pending[end-1].source.groupId &&
      pending[end-1].source.groupId===pending[end].source.groupId) {
    const group=pending[end].source.groupId;
    while(end>0&&pending[end-1].source.groupId===group)end--;
  }
  if(!end&&pending.length)throw Error('Drawer commit group exceeds replay limit');
  const batch=pending.slice(0,end),result=batch.length?await send(structuredClone(batch)):
    {success:true,acceptedIds:[]};
  const ids=new Set(result?.acceptedIds||[]);
  if(!result?.success || !Array.isArray(result.acceptedIds)||ids.size!==batch.length ||
      result.acceptedIds.length!==batch.length||batch.some(proof=>!ids.has(proof.source.id)))
    throw Error('Invalid drawer replay acknowledgement');
  // Network waits do not hold the local financial writer lock. Re-read under
  // that lock before CAS so sales created during the request cannot be lost.
  return locks.request(key,{ifAvailable:true},async lock=>{
    if(!lock)throw Error('Drawer acknowledgement lock unavailable');
    const current=validate(await durable.read(key));
    assertCurrent();
    if(batch.some(proof=>JSON.stringify(current.sources.find(row=>row.source.id===proof.source.id))!==JSON.stringify(proof)))
      throw Error('Drawer sources changed during replay');
    const allAccepted=new Set([...(current.acceptedIds||[]),...ids]);
    const snapshot={...current,revision:current.revision+1,acceptedIds:[...allAccepted]};
    const own=repository?.current.outbox.filter(event=>allAccepted.has(event.id))||[];
    if(own.some(event=>JSON.stringify(current.sources.find(proof=>proof.source.id===event.id)?.source)!==JSON.stringify(event)))
      throw Error('Own queue differs from signed drawer source');
    if(own.length) {
      const wrapper={commit:async(userKey,value,expectedRevision)=>{
        assertCurrent();
        const [committed]=await durable.commitBatch([
          {key:userKey,snapshot:value,expectedRevision},
          {key,snapshot,expectedRevision:current.revision}
        ]);
        return committed;
      }};
      await repository.acknowledgeDurable(new Set(own.map(event=>event.id)),wrapper);
    } else if(batch.length) {
      assertCurrent();
      await durable.commit(key,snapshot,current.revision);
    }
    return current.sources.every(proof=>allAccepted.has(proof.source.id));
  });
}

const cashTypes = new Set(['invoice','customer_payment','expense','purchase','supplier_payment',
  'worker_transaction','partner_drawing','profit_distribution','sales_return','purchase_return']);

// Opt-in integration for actual app actions that already append the cash event.
// Never append a second event here. Verify the resulting projection instead.
// Login/UI and server writer assignment remain required before enabling this.
export async function commitDrawerFinancialAction(store, durable, locks, context, action) {
  if (!store?.durable || store.durable !== durable || !durable?.commitBatch || !locks?.request)
    throw new Error('الحفظ الدائم المشترك أو قفل الدرج غير متاح');
  const owned = store.read(SHIFT_KEY) ?? [];
  const shift = owned.find(row => row.id === context?.shiftId);
  if (!shift || shift.actorId !== store.user?.id || shift.tenantId !== store.user?.tenantId ||
      shift.offlineDeviceId !== context.deviceId || shift.status !== 'open')
    throw new Error('الدرج أو المحاسب أو الجهاز لا يطابق تصريح الحركة');
  const scope = {tenantId:shift.tenantId,branchId:shift.branchId,drawerId:shift.drawerId,deviceId:context.deviceId};
  assertVerifiedOfflineGrant(context.verifiedClaims, {...scope,cashierId:store.user.id},new Date().toISOString());
  const key = keyFor(scope);
  return locks.request(key,{ifAvailable:true},async lock => {
    if (!lock) throw new Error('الدرج قيد الاستخدام على نافذة أخرى');
    const saved = await durable.read(key);
    if (!saved || !Number.isSafeInteger(saved.revision) || !Array.isArray(saved.shifts) ||
        !Array.isArray(saved.sources) || Object.entries(scope).some(([name,value])=>saved[name]!==value) ||
        JSON.stringify(saved.shifts.find(row=>row.id===shift.id))!==JSON.stringify(shift))
      throw new Error('وردية المحاسب تختلف عن سجل الدرج؛ لم تُحفظ العملية');
    const wrapper = {commit:async(userKey,snapshot,expectedRevision)=>{
      const known = new Set(store.value.outbox.map(event=>event.id));
      const created = snapshot.outbox.filter(event=>!known.has(event.id));
      const cashSources = [];
      for (const event of created.filter(event=>cashTypes.has(event.entityType))) {
        let amount,entryId=`cash:${event.payload.clientTransactionId||event.payload.id}`;
        if(event.entityType==='invoice'&&event.action==='void'){
          assertInvoiceVoidPayload(event.payload);
          const original=store.value.state.khodar_pos_invoices_v3?.find(row=>row.id===event.entityId);
          if(!original||original.status==='voided'||original.branchId!==scope.branchId)
            throw new Error('أصل الفاتورة غير صالح لعكس النقد؛ لم تُحفظ العملية');
          amount=-cashMovementFromRecord('invoice',original);
          entryId=`cash:void:${original.clientTransactionId||original.id}`;
        }else if(event.entityType==='invoice'&&event.action==='update'){
          assertInvoiceUpdatePayload(event.payload);amount=0;
        }else{
          if (event.action !== 'create') throw new Error('عكس الحركة المالية يحتاج تسوية درج مدعومة؛ لم تُحفظ العملية');
          amount = cashMovementFromRecord(event.entityType,event.payload);
        }
        if (amount !== 0) cashSources.push({event,amount,entryId});
      }
      if (cashSources.length > 1) throw new Error('مصادر نقدية متعددة غير مدعومة في معاملة الدرج');
      const cashEvents = created.filter(event=>event.entityType==='cash_shift');
      let expected = owned;
      if (cashSources.length) {
        const {event,amount,entryId} = cashSources[0];
        const nextShift = snapshot.state[SHIFT_KEY]?.find(row=>row.id===shift.id);
        const entry = nextShift?.events?.at(-1);
        if (event.tenantId!==scope.tenantId || event.branchId!==scope.branchId ||
            event.payload.cashShiftId!==shift.id || cashEvents.length!==1 ||
            cashEvents[0].entityId!==shift.id || cashEvents[0].action!=='update' ||
            cashEvents[0].groupId!==event.groupId || !entry ||
            entry.id!==entryId || entry.amount!==amount)
          throw new Error('مصدر الحركة لا يطابق حركة الدرج؛ لم تُحفظ العملية');
        expected = postCashEvent(owned,{shiftId:shift.id,id:entry.id,actorId:store.user.id,
          deviceId:context.deviceId,amount,at:entry.at});
        if (JSON.stringify(cashEvents[0].payload)!==JSON.stringify(expected.find(row=>row.id===shift.id)))
          throw new Error('مصدر الوردية لا يطابق حركة الدرج');
      } else if (cashEvents.length) throw new Error('حركة درج دون مصدر نقدي');
      if (JSON.stringify(snapshot.state[SHIFT_KEY])!==JSON.stringify(expected))
        throw new Error('سجل الورديات لا يطابق مصادر الحركة');
      const proofs = [];
      for (const event of created) proofs.push(await signOfflineCashEvent(context.verifiedClaims,event));
      const shifts = saved.shifts.map(row=>row.id===shift.id ? expected.find(item=>item.id===shift.id) : row);
      const nextJournal = {...saved,revision:saved.revision+1,shifts,sources:[...saved.sources,...proofs]};
      const [committed] = await durable.commitBatch([
        {key:userKey,snapshot,expectedRevision},
        {key,snapshot:nextJournal,expectedRevision:saved.revision}
      ]);
      return committed;
    }};
    return store.transactDurable(action,wrapper);
  });
}

// Staged core only. Callers must cryptographically verify the server grant;
// this module is not yet wired to login, sales, sync, or the UI.
export async function commitDrawerShiftDurable(store, durable, locks, operation, input, verifiedClaims, options = {}) {
  if (!store?.durable || store.durable !== durable || !durable?.commitBatch || !locks?.request)
    throw new Error('الحفظ الدائم المشترك أو قفل الدرج غير متاح');
  if (!input || input.actorId !== store.user?.id)
    throw new Error('هوية المحاسب لا تطابق صاحب السجل المالي');
  const owned = store.read(SHIFT_KEY) ?? [];
  const ownShift = operation === 'open' ? null : owned.find(row => row.id === input.shiftId);
  if (operation !== 'open' && !ownShift)
    throw new Error('الوردية لا تخص هذا المحاسب في السجل المحلي');
  const scope = operation === 'open'
    ? { tenantId:input.tenantId, branchId:input.branchId, drawerId:input.drawerId, deviceId:input.offlineDeviceId }
    : { tenantId:ownShift.tenantId, branchId:ownShift.branchId, drawerId:ownShift.drawerId, deviceId:ownShift.offlineDeviceId };
  if (Object.values(scope).some(value => typeof value !== 'string' || !value))
    throw new Error('هوية الدرج والجهاز غير صالحة');
  if (scope.tenantId !== store.user.tenantId || (operation !== 'open' && input.deviceId !== scope.deviceId))
    throw new Error('الدرج أو الجهاز لا يخص هذا السجل');
  assertVerifiedOfflineGrant(verifiedClaims, { tenantId:scope.tenantId, cashierId:store.user.id,
    deviceId:scope.deviceId, branchId:scope.branchId, drawerId:scope.drawerId }, input.at);
  const key = keyFor(scope);
  return locks.request(key, { ifAvailable:true }, async lock => {
    if (!lock) throw new Error('الدرج قيد الاستخدام على نافذة أخرى');
    const saved = await durable.read(key);
    if (saved && (saved.tenantId !== scope.tenantId || saved.branchId !== scope.branchId ||
        saved.drawerId !== scope.drawerId || saved.deviceId !== scope.deviceId ||
        !Number.isSafeInteger(saved.revision) || !Array.isArray(saved.shifts) ||
        (saved.sources!==undefined&&!Array.isArray(saved.sources))))
      throw new Error('سجل الدرج المشترك غير صالح؛ لم تُحفظ العملية');
    const previous = saved?.shifts ?? [];
    if (ownShift && JSON.stringify(previous.find(row => row.id === ownShift.id)) !== JSON.stringify(ownShift))
      throw new Error('وردية المحاسب تختلف عن سجل الدرج؛ يلزم فحص البيانات قبل المتابعة');
    let shifts;
    if (operation === 'open') shifts = openShift(previous,input);
    else if (operation === 'cash') shifts = postCashEvent(previous,input);
    else if (operation === 'close') shifts = closeShift(previous,{...input,mode:'local',pendingEventCount:store.current.outbox.length});
    else throw new Error('عملية الوردية غير معروفة');
    const shiftId = operation === 'open' ? input.id : input.shiftId;
    const shift = shifts.find(row => row.id === shiftId);
    const nextJournal = { revision:(saved?.revision ?? -1)+1, ...scope, shifts, sources:[...(saved?.sources??[])] };
    const eventId = operation === 'open' ? `cash-shift:${shiftId}:open` :
      operation === 'cash' ? `cash-shift:${shiftId}:cash:${input.id}` : `cash-shift:${shiftId}:close`;
    const wrapper = { commit:async (userKey,snapshot,expectedRevision) => {
      if (options.signSources || options.financialAction) {
        const known=new Set(store.value.outbox.map(event=>event.id));
        const created=snapshot.outbox.filter(event=>!known.has(event.id));
        const financial=created.filter(event=>event.entityType!=='cash_shift');
        const sources=financial.filter(event=>event.payload?.cashShiftId===shiftId);
        if (options.financialAction&&(sources.length!==1||sources[0].action!=='create'||
            sources[0].branchId!==scope.branchId||sources[0].tenantId!==scope.tenantId||
            input.id!==`cash:${sources[0].payload.clientTransactionId||sources[0].payload.id}`||
            Math.abs(cashMovementFromRecord(sources[0].entityType,sources[0].payload)-input.amount)>1e-9))
          throw new Error('مصدر الحركة لا يطابق حركة الدرج؛ لم تُحفظ العملية');
        const proofs=[];
        for (const event of created) proofs.push(await signOfflineCashEvent(verifiedClaims,event));
        nextJournal.sources=[...(saved?.sources??[]),...proofs];
      }
      const [committed] = await durable.commitBatch([
        { key:userKey, snapshot, expectedRevision },
        { key, snapshot:nextJournal, expectedRevision:saved?.revision ?? null }
      ]);
      return committed;
    } };
    return store.transactDurable(() => {
      if (options.financialAction) {
        if (operation!=='cash'||typeof options.financialAction!=='function') throw new Error('عملية مالية غير صالحة');
        const result=options.financialAction();
        if (result?.then) throw new Error('الحركة المالية لا تنتظر اتصالًا داخل الحفظ الذري');
        if (result?.success===false) throw new Error('لم تُعتمد الحركة المالية');
      }
      const local = store.read(SHIFT_KEY) ?? [];
      store.set(SHIFT_KEY,operation === 'open' ? [...local,shift] : local.map(row => row.id === shiftId ? shift : row));
      store.enqueue({ id:eventId, tenantId:scope.tenantId, branchId:scope.branchId,
        entityType:'cash_shift', entityId:shiftId, action:operation === 'open' ? 'create' : 'update',
        payload:shift, timestamp:Date.parse(input.at) });
      return shift;
    },wrapper);
  });
}
