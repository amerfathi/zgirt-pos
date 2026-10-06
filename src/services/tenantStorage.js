import { getSessionUser } from './authSession.js';

const scopeVersion = user => Number.isSafeInteger(Number(user?.syncScopeVersion)) && Number(user?.syncScopeVersion) > 0
  ? Number(user.syncScopeVersion) : 0;
const scopeMarkerKey = user => `braka:${encodeURIComponent(user.tenantId)}:${encodeURIComponent(user.id)}:active_scope`;
const scopeTransitionKey = user => `braka:${encodeURIComponent(user.tenantId)}:${encodeURIComponent(user.id)}:scope_transition`;

export function withoutCredentials(value) {
  if (Array.isArray(value)) return value.map(withoutCredentials);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['password','password_hash','token','sessionToken'].includes(key))
    .map(([key, item]) => [key, withoutCredentials(item)]));
}
export function scopedStorageKey(key, user = getSessionUser()) {
  if (!user) return null;
  const version = scopeVersion(user);
  return `braka:${encodeURIComponent(user.tenantId)}:${encodeURIComponent(user.id)}:${version ? `scope-${version}:` : ''}${key}`;
}

export function prepareAccessScope(user, storage = globalThis.localStorage) {
  if (!user || !storage) return null;
  const next = scopeVersion(user);
  const markerKey = scopeMarkerKey(user);
  const raw = storage.getItem(markerKey);
  let previous = raw === null ? 0 : Number(raw);
  if (!Number.isSafeInteger(previous) || previous < 0) throw new Error('مؤشر نطاق الصلاحيات المحلي غير صالح؛ لم تُحذف البيانات');
  const previousUser = { ...user, syncScopeVersion: previous };
  const oldKey = scopedStorageKey('atomic_v1', previousUser);
  const nextKey = scopedStorageKey('atomic_v1', user);
  if (previous !== next && (storage.getItem(oldKey) !== null || raw !== null)) {
    storage.setItem(scopeTransitionKey(user), JSON.stringify({ from: previous, to: next, oldKey, nextKey }));
  }
  storage.setItem(markerKey, String(next));
  return previous === next ? null : { from: previous, to: next, oldKey, nextKey };
}

export function readAccessScopeTransition(user, storage = globalThis.localStorage) {
  if (!user || !storage) return null;
  const raw = storage.getItem(scopeTransitionKey(user));
  if (raw === null) return null;
  const value = JSON.parse(raw);
  if (!Number.isSafeInteger(value?.from) || !Number.isSafeInteger(value?.to) ||
      typeof value.oldKey !== 'string' || typeof value.nextKey !== 'string')
    throw new Error('سجل انتقال نطاق الصلاحيات غير صالح؛ لم تُحذف البيانات');
  return value;
}

export function clearAccessScopeTransition(user, storage = globalThis.localStorage) {
  if (user && storage) storage.removeItem(scopeTransitionKey(user));
}
export function readTenantStorage(key, fallback, user = getSessionUser()) {
  const scoped = scopedStorageKey(key, user);
  if (!scoped) return fallback;
  const raw = localStorage.getItem(scoped);
  return raw === null ? fallback : JSON.parse(raw);
}
export function writeTenantStorage(key, value, user = getSessionUser()) {
  const scoped = scopedStorageKey(key, user);
  if (!scoped) return;
  // Do not swallow quota errors and claim durable persistence.
  localStorage.setItem(scoped, JSON.stringify(withoutCredentials(value)));
}

// Bind a store instance to the identity it was mounted for. A session change
// must not redirect pending React effects into the next account's namespace.
export function createTenantStorage(user = getSessionUser()) {
  const identity = user ? { tenantId: user.tenantId, id: user.id } : null;
  return Object.freeze({
    read: (key, fallback) => readTenantStorage(key, fallback, identity),
    write: (key, value) => writeTenantStorage(key, value, identity)
  });
}
export function writeTenantLoginContext(tenant, user, branches = []) {
  prepareAccessScope(user);
  const storage = createTenantStorage(user);
  storage.write('khodar_pos_tenants_v1', [tenant]);
  // Only seed a new local namespace. Existing offline branch records may have
  // unsent financial references and must never be replaced by a login response.
  const previousBranches = storage.read('khodar_pos_branches_v1', null);
  const emptyUnaggregated = Array.isArray(previousBranches) && previousBranches.length === 0 &&
    localStorage.getItem(scopedStorageKey('atomic_v1', user)) === null;
  if (previousBranches === null || emptyUnaggregated) storage.write('khodar_pos_branches_v1', branches);
  if (user.branchId && user.branchId !== 'all') storage.write('khodar_pos_active_branch_id_v1', user.branchId);
  else if (emptyUnaggregated || storage.read('khodar_pos_active_branch_id_v1', null) === null) {
    const main = branches.find(branch => branch.isMain) || branches[0];
    if (main) storage.write('khodar_pos_active_branch_id_v1', main.id);
  }
}
