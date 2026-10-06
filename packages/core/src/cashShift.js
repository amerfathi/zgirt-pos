/**
 * Strict Cash Drawer and Shift Engine for ZGIRT
 * Enforces integer cents arithmetic, shift state machines, and variance tracking.
 */

export const SHIFT_STATUS = Object.freeze({
  OPEN: 'open',
  CLOSED: 'closed',
  CLOSED_LOCAL: 'closed_local'
});

export function openShiftRecord({ id, tenantId, branchId, drawerId, cashierUserId, deviceId, openingCashCents, openedAt = new Date().toISOString() }) {
  if (!id || !tenantId || !branchId || !cashierUserId || !deviceId) {
    throw new Error('Missing required shift parameters');
  }
  const cash = Number(openingCashCents);
  if (!Number.isSafeInteger(cash) || cash < 0) {
    throw new Error('Invalid opening cash balance');
  }

  return {
    id,
    tenantId,
    branchId,
    drawerId: drawerId || 'default-drawer',
    cashierUserId,
    deviceId,
    openedAt,
    closedAt: null,
    openingCashCents: cash,
    expectedCashCents: cash,
    countedCashCents: null,
    varianceCents: null,
    status: SHIFT_STATUS.OPEN,
    events: []
  };
}

export function recordCashTransaction(shift, { id, amountCents, type, referenceId, notes, timestamp = new Date().toISOString() }) {
  if (shift.status !== SHIFT_STATUS.OPEN) {
    throw new Error('Cannot record cash transaction on a closed shift');
  }
  const delta = Number(amountCents);
  if (!Number.isSafeInteger(delta)) {
    throw new Error('Invalid cash event amount');
  }

  const updatedExpected = shift.expectedCashCents + delta;
  const event = {
    id: id || crypto.randomUUID(),
    shiftId: shift.id,
    amountCents: delta,
    type, // 'sale', 'payment', 'expense', 'supplier_payment'
    referenceId,
    notes,
    timestamp
  };

  return {
    ...shift,
    expectedCashCents: updatedExpected,
    events: [...(shift.events || []), event]
  };
}

export function closeShiftRecord(shift, { countedCashCents, closedAt = new Date().toISOString(), notes, isLocal = false }) {
  if (shift.status !== SHIFT_STATUS.OPEN) {
    throw new Error('Shift is already closed');
  }
  const counted = Number(countedCashCents);
  if (!Number.isSafeInteger(counted) || counted < 0) {
    throw new Error('Counted cash must be a non-negative integer');
  }

  const variance = counted - shift.expectedCashCents;

  return {
    ...shift,
    closedAt,
    countedCashCents: counted,
    varianceCents: variance,
    status: isLocal ? SHIFT_STATUS.CLOSED_LOCAL : SHIFT_STATUS.CLOSED,
    notes: notes || shift.notes
  };
}
