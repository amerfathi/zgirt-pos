export const SYNC_HEADS_STATE_KEY = 'khodar_pos_sync_heads_v1';

export const CONFLICT_DOMAINS = Object.freeze([
  'domain:inventory','domain:customers','domain:suppliers','domain:liquidity',
  'domain:workers','domain:partners','domain:branches','domain:settings'
]);

const DOMAINS_BY_TYPE = Object.freeze({
  product:['domain:inventory'], invoice:['domain:inventory','domain:customers','domain:liquidity'],
  sales_return:['domain:inventory','domain:customers','domain:liquidity'],
  purchase:['domain:inventory','domain:suppliers','domain:liquidity'],
  purchase_return:['domain:inventory','domain:suppliers','domain:liquidity'],
  damaged_item:['domain:inventory'], stock_transfer:['domain:inventory','domain:branches'],
  customer:['domain:customers'], customer_payment:['domain:customers','domain:liquidity'],
  supplier:['domain:suppliers'], supplier_payment:['domain:suppliers','domain:liquidity'],
  expense:['domain:liquidity'], worker:['domain:workers'],
  worker_transaction:['domain:workers','domain:liquidity'], partner:['domain:partners'],
  partner_drawing:['domain:partners','domain:liquidity'],
  profit_distribution:['domain:partners','domain:liquidity'], branch:['domain:branches'],
  settings:['domain:settings','domain:liquidity'], cash_shift:['domain:cash_shifts','domain:liquidity']
});

export function conflictKeysForEvent(event) {
  if (event?.entityType === 'restore_snapshot') return ['tenant:*', ...CONFLICT_DOMAINS];
  if (event?.entityType === 'cash_shift') {
    const drawerId = typeof event.payload?.drawerId === 'string' && event.payload.drawerId ? event.payload.drawerId : event.entityId;
    return ['domain:cash_shifts', 'domain:liquidity', `record:cash_shift:${event.entityId}`, `record:cash_shift_drawer:${drawerId}`];
  }
  const domains = DOMAINS_BY_TYPE[event?.entityType];
  if (!domains || typeof event?.entityId !== 'string' || !event.entityId) return [];
  return [...domains, `record:${event.entityType}:${event.entityId}`];
}

export function attachConflictPreconditions(event, heads) {
  const keys=conflictKeysForEvent(event);
  if (!keys.length) return event;
  const preconditions=Object.fromEntries(keys.map(key=>[key, heads[key] ?? null]));
  for (const key of keys) heads[key]=event.id;
  return { ...event, conflictPolicyVersion: 1, preconditions };
}

export function applyAcceptedConflictEvent(event, heads) {
  const keys=conflictKeysForEvent(event);
  if (!keys.length) return;
  if (event.conflictPolicyVersion !== 1 || !event.preconditions || typeof event.preconditions !== 'object')
    throw new Error('حدث بلا سياسة تعارض معتمدة؛ لم يتقدم مؤشر المزامنة');
  for (const key of keys) {
    if ((heads[key] ?? null) !== (event.preconditions[key] ?? null))
      throw new Error('تعارض سببي بين الأجهزة؛ يلزم حل الحركة قبل متابعة المزامنة');
    heads[key]=event.id;
  }
}
