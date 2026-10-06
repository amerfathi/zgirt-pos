import { openShift, postCashEvent, closeShift } from './cashShiftEngine.js';

const KEY = 'khodar_pos_cash_shifts_v1';

// Not connected to the UI until the server accepts and reconciles cash_shift events.
export async function commitCashShiftDurable(store, operation, input) {
  if (!store?.durable) throw new Error('إدارة الورديات تتطلب سجلًا محليًا دائمًا');
  if (!input || input.actorId !== store.user?.id)
    throw new Error('هوية المحاسب لا تطابق مالك السجل المحلي');
  return store.transactDurable(() => {
    const before = store.read(KEY) ?? [];
    let after, shiftId, eventId, action;
    if (operation === 'open') {
      after = openShift(before, input);
      shiftId = input.id;
      eventId = `cash-shift:${shiftId}:open`;
      action = 'create';
    } else if (operation === 'cash') {
      after = postCashEvent(before, input);
      shiftId = input.shiftId;
      eventId = `cash-shift:${shiftId}:cash:${input.id}`;
      action = 'update';
    } else if (operation === 'close') {
      shiftId = input.shiftId;
      const pendingEventCount = store.current.outbox.length;
      after = closeShift(before, { ...input, pendingEventCount, mode:'local' });
      eventId = `cash-shift:${shiftId}:close`;
      action = 'update';
    } else throw new Error('عملية الوردية غير معروفة');
    const shift = after.find(row => row.id === shiftId);
    store.set(KEY, after);
    store.enqueue({ id:eventId, tenantId:shift.tenantId, branchId:shift.branchId,
      entityType:'cash_shift', entityId:shift.id, action, payload:shift,
      timestamp:Date.parse(input.at) });
    return shift;
  });
}
