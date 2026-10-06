// A tenant owner sees all of that tenant's branches. Staff access is an
// explicit, non-empty set; legacy single-branch assignments remain readable.
const branchViewCache = new WeakMap();
const recordViewCache = new WeakMap();
export function assignedBranchIds(user) {
  if (!user) return [];
  if(user.isOfflineSession===true)return Array.isArray(user.branchIds)
    ? [...new Set(user.branchIds.filter(id=>typeof id==='string'&&id&&id!=='all'))]:[];
  if (user.type === 'tenant' || user.userType === 'owner' ||
      (user.role === 'company_owner' && user.isStaff !== true)) return ['all'];
  if (Array.isArray(user.branchIds)) {
    const ids = [...new Set(user.branchIds.filter(id => typeof id === 'string' && id && id !== 'all'))];
    return ids;
  }
  return user.branchId && user.branchId !== 'all' ? [user.branchId] : [];
}

export function canAccessBranch(user, branchId) {
  const allowed = assignedBranchIds(user);
  if (branchId === 'all') return allowed.includes('all') ||
    (allowed.length > 0 && user?.permissions?.canViewAllBranches === true);
  return allowed.includes('all') || allowed.includes(branchId);
}

export function visibleBranches(user, branches) {
  if (!user) return branches || [];
  const allowed = assignedBranchIds(user);
  if (allowed.includes('all')) return branches || [];
  if (!Array.isArray(branches)) return [];
  let views = branchViewCache.get(branches);
  if (!views) { views = new Map(); branchViewCache.set(branches, views); }
  const key = allowed.join('\u0000');
  if (!views.has(key)) views.set(key, branches.filter(branch => allowed.includes(branch.id)));
  return views.get(key);
}

export function visibleBranchRecords(user, branchId, rows) {
  if (!Array.isArray(rows)) return [];
  // Pre-upgrade owner fixtures remain readable; an old staff session without
  // explicit grants fails closed instead of inheriting the old "all" default.
  if (!Array.isArray(user?.branchIds)) {
    if (!user || (!user.isStaff && ['company_owner', 'super_admin'].includes(user.role))) return rows;
    if (branchId !== user.branchId) return [];
    return rows.filter(row => row?.branchId && row.branchId === user.branchId);
  }
  const allowed = assignedBranchIds(user);
  if (branchId === 'all' && !canAccessBranch(user, 'all')) return [];
  const selected = branchId === 'all' ? allowed : [branchId];
  if (branchId !== 'all' && !canAccessBranch(user, branchId)) return [];
  let views = recordViewCache.get(rows);
  if (!views) { views = new Map(); recordViewCache.set(rows, views); }
  const key = selected.join('\u0000');
  if (!views.has(key)) views.set(key, rows.filter(row =>
    typeof row?.branchId === 'string' && row.branchId &&
    (selected.includes('all') || selected.includes(row.branchId))));
  return views.get(key);
}
