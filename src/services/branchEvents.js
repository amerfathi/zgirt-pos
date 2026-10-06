export function branchCreateEvent(tenantId, branch) {
  return {
    id: `evt_${tenantId}_branch_bootstrap_${branch.id}_create`, tenantId,
    branchId: null, entityType: 'branch', entityId: branch.id,
    action: 'create', payload: branch, timestamp: Date.now()
  };
}
