// Cancellation changes state, never the immutable financial content of a sale.
// The same contract is used at cloud ingestion and owner ledger recovery.
const voidFields = new Set(['id', 'tenantId', 'branchId', 'status', 'cashShiftId']);
const updateFields = new Set(['id', 'tenantId', 'branchId', 'notes']);
export function assertInvoiceUpdatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      typeof payload.id !== 'string' || !payload.id || typeof payload.notes !== 'string' ||
      Object.keys(payload).some(key => !updateFields.has(key)))
    throw new Error('Unsupported invoice financial update: only notes may be edited');
}
export function assertInvoiceVoidPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      typeof payload.id !== 'string' || !payload.id || payload.status !== 'voided' ||
      Object.keys(payload).some(key => !voidFields.has(key)))
    throw new Error('Invalid invoice void: cancellation cannot change financial fields');
}
