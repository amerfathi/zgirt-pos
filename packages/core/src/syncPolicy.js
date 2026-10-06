/**
 * Causal Synchronization and Conflict Precondition Engine
 * Tracks causal dependencies and prevents last-write-wins collisions across distributed POS terminals.
 */

export const CONFLICT_DOMAINS = Object.freeze([
  'domain:inventory',
  'domain:customers',
  'domain:suppliers',
  'domain:cash_shifts',
  'domain:liquidity'
]);

export function getConflictKeysForEvent(event) {
  const { entityType, entityId, payload } = event;
  
  if (entityType === 'sales_invoice') {
    return [
      'domain:inventory',
      'domain:liquidity',
      payload?.customerId ? `customer:${payload.customerId}` : null,
      payload?.shiftId ? `shift:${payload.shiftId}` : null
    ].filter(Boolean);
  }

  if (entityType === 'customer_payment') {
    return [
      'domain:liquidity',
      `customer:${payload?.customerId || entityId}`
    ];
  }

  if (entityType === 'purchase_invoice') {
    return [
      'domain:inventory',
      'domain:liquidity',
      `supplier:${payload?.supplierId || entityId}`
    ];
  }

  if (entityType === 'cash_shift') {
    return [
      'domain:cash_shifts',
      'domain:liquidity',
      `drawer:${payload?.drawerId || 'default'}`
    ];
  }

  if (entityType === 'product_stock_adjustment') {
    return [
      'domain:inventory',
      `product:${entityId}`
    ];
  }

  return [`record:${entityType}:${entityId}`];
}

/**
 * Builds conflict preconditions based on client's known vector state (heads)
 */
export function buildConflictPreconditions(event, knownHeads = {}) {
  const keys = getConflictKeysForEvent(event);
  const preconditions = {};
  for (const k of keys) {
    preconditions[k] = knownHeads[k] || null;
  }
  return {
    ...event,
    conflictPolicyVersion: 1,
    preconditions
  };
}

/**
 * Verifies whether an incoming event can be causally accepted against server heads
 */
export function verifyCausalPreconditions(event, currentServerHeads = {}) {
  if (event.conflictPolicyVersion !== 1 || !event.preconditions) {
    return { accepted: false, reason: 'MISSING_CONFLICT_POLICY' };
  }

  const keys = getConflictKeysForEvent(event);
  for (const k of keys) {
    const serverHead = currentServerHeads[k] || null;
    const clientExpected = event.preconditions[k] || null;

    if (serverHead !== clientExpected) {
      return {
        accepted: false,
        reason: 'CAUSAL_CONFLICT_DETECTED',
        key: k,
        serverHead,
        clientExpected
      };
    }
  }

  return { accepted: true };
}
