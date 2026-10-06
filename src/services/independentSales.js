// Only additive invoice creates commute. Snapshots, reversals and shift-bound
// movements must retain their existing conflict/ownership checks.
export function isIndependentSale(event) {
  return event?.entityType === 'invoice' && event.action === 'create' &&
    typeof event.id === 'string' && !!event.id && typeof event.entityId === 'string' && !!event.entityId &&
    event.payload?.id === event.entityId && typeof event.branchId === 'string' &&
    !!event.branchId && event.branchId !== 'all' && event.payload.branchId === event.branchId &&
    event.payload.status === 'active' && !event.payload.cashShiftId &&
    Array.isArray(event.payload.items) && event.conflictPolicyVersion === 1;
}

export function isIndependentSalesQueue(events) {
  return Array.isArray(events) && events.length > 0 &&
    events.every(isIndependentSale) && new Set(events.map(event => event.id)).size === events.length &&
    new Set(events.map(event => event.entityId)).size === events.length;
}
