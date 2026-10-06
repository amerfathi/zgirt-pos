const required = (value, name) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`حقل مطلوب: ${name}`);
  return value;
};
const timestamp = value => {
  required(value, 'وقت الحركة');
  if (!Number.isFinite(Date.parse(value))) throw new Error('وقت الحركة غير صالح');
  return new Date(value).toISOString();
};
const cents = (value, name, allowNegative = false) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || (!allowNegative && amount < 0) ||
      Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6)
    throw new Error(`مبلغ غير صالح: ${name}`);
  return Math.round(amount * 100);
};
const findShift = (shifts, id) => {
  const shift = shifts.find(row => row.id === id);
  if (!shift) throw new Error('الوردية غير موجودة');
  return shift;
};

export function accountingDate(at, timeZone) {
  timestamp(at);
  required(timeZone, 'المنطقة الزمنية');
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date(at));
    const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${byType.year}-${byType.month}-${byType.day}`;
  } catch { throw new Error('المنطقة الزمنية غير صالحة'); }
}

export function openShift(shifts, input) {
  if (!Array.isArray(shifts)) throw new Error('سجل الورديات غير صالح');
  for (const field of ['id','tenantId','branchId','drawerId','actorId','offlineDeviceId','timeZone']) required(input[field], field);
  const openedAt = timestamp(input.at);
  if (shifts.some(row => row.id === input.id)) throw new Error('معرف الوردية مكرر');
  if (shifts.some(row => row.tenantId === input.tenantId && row.branchId === input.branchId &&
      row.drawerId === input.drawerId && row.status === 'open'))
    throw new Error('للدرج وردية مفتوحة بالفعل');
  const openingCashCents = cents(input.openingCash, 'رصيد فتح الدرج');
  return [...shifts, {
    id:input.id, tenantId:input.tenantId, branchId:input.branchId, drawerId:input.drawerId,
    actorId:input.actorId, offlineDeviceId:input.offlineDeviceId, timeZone:input.timeZone,
    accountingDate:accountingDate(openedAt,input.timeZone), openedAt,
    openingCash:openingCashCents / 100, events:[], status:'open'
  }];
}

export function postCashEvent(shifts, input) {
  const shift = findShift(shifts, required(input.shiftId, 'shiftId'));
  if (shift.status !== 'open') throw new Error('الوردية مقفلة');
  for (const field of ['id','actorId','deviceId']) required(input[field], field);
  if (input.actorId !== shift.actorId) throw new Error('الوردية لا تخص هذا المحاسب؛ يلزم إقفالها قبل تسليم الدرج');
  const at = timestamp(input.at);
  if (at < shift.openedAt) throw new Error('الحركة النقدية قبل فتح الوردية');
  if (accountingDate(at,shift.timeZone) !== shift.accountingDate)
    throw new Error('انتهى اليوم المحاسبي؛ أقفل الوردية قبل حركة نقدية جديدة');
  if (input.online !== true && input.deviceId !== shift.offlineDeviceId)
    throw new Error('جهاز آخر غير مخصص للعمل النقدي دون اتصال على هذا الدرج');
  if (shifts.some(row => row.events.some(event => event.id === input.id))) throw new Error('معرف الحركة مكرر');
  const amount = cents(input.amount, 'قيمة الحركة', true) / 100;
  if (amount === 0) throw new Error('قيمة الحركة صفر');
  const event = { id:input.id, actorId:input.actorId, deviceId:input.deviceId, amount, at,
    accountingDate:accountingDate(at,shift.timeZone), shiftId:shift.id, tenantId:shift.tenantId,
    branchId:shift.branchId, drawerId:shift.drawerId };
  return shifts.map(row => row.id === shift.id ? { ...row, events:[...row.events,event] } : row);
}

export function closeShift(shifts, input) {
  const shift = findShift(shifts, required(input.shiftId, 'shiftId'));
  if (shift.status !== 'open') throw new Error('الوردية مقفلة بالفعل');
  required(input.actorId, 'actorId');
  if (input.actorId !== shift.actorId) throw new Error('إقفال الوردية يخص المحاسب الذي فتحها');
  const closedAt = timestamp(input.at);
  if (closedAt < shift.openedAt) throw new Error('الإقفال يسبق فتح الوردية');
  if (!Number.isSafeInteger(input.pendingEventCount) || input.pendingEventCount < 0)
    throw new Error('حالة العمليات المعلقة غير مؤكدة');
  const localClose = input.mode === 'local';
  if (input.mode && !localClose) throw new Error('وضع الإقفال غير صالح');
  if (localClose && required(input.deviceId, 'جهاز الإقفال') !== shift.offlineDeviceId)
    throw new Error('جهاز آخر غير مخصص لإقفال الدرج دون اتصال');
  if (!localClose && input.pendingEventCount > 0) throw new Error('توجد عمليات نقدية معلقة؛ لا يمكن إقفال الوردية');
  const countedCashCents = cents(input.countedCash, 'النقد المعدود');
  const expectedCashCents = cents(shift.openingCash, 'رصيد البداية') +
    shift.events.reduce((sum,event) => sum + cents(event.amount, 'الحركة', true), 0);
  return shifts.map(row => row.id === shift.id ? {
    ...row, status:localClose ? 'closed_local' : 'closed', closedAt, closedBy:input.actorId,
    ...(localClose ? { pendingEventCountAtClose:input.pendingEventCount } : {}),
    countedCash:countedCashCents / 100, expectedCash:expectedCashCents / 100,
    variance:(countedCashCents - expectedCashCents) / 100
  } : row);
}
