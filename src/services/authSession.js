import {offlineIdentityFromUnlockedGrant} from './offlineUnlock.js';
const TOKEN_KEY = 'khodar_pos_session_token';
const USER_KEY = 'khodar_verified_session_user';
let offlineSession=null;
export const getSessionToken = () => globalThis.sessionStorage?.getItem(TOKEN_KEY) || '';
export function setSessionToken(token) {
  offlineSession=null;
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(USER_KEY); }
}
export function getSessionUser() {
  if(offlineSession) {
    try{return offlineIdentityFromUnlockedGrant(offlineSession.handle,offlineSession.branchId);}
    catch{offlineSession=null;return null;}
  }
  try {
    const user = JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
    // A pre-branch-grants login cannot prove its local visibility scope. Keep
    // its saved data untouched, but require a fresh authenticated login.
    if (user?.storeCode && !Array.isArray(user.branchIds)) return null;
    return getSessionToken() && Date.parse(user?.sessionExpiresAt) > Date.now() ? user : null;
  } catch { return null; }
}
// Memory-only local authorization, never a synthetic cloud session/token.
// A restart requires another password unlock of the durable signed grant.
export function setOfflineSession(handle,branchId) {
  offlineIdentityFromUnlockedGrant(handle,branchId);
  setSessionToken(null);
  offlineSession={handle,branchId};
}
export function setSessionUser(user) { sessionStorage.setItem(USER_KEY, JSON.stringify(user)); }
export async function apiFetch(input, init = {}) {
  const headers = new Headers(init.headers);
  // Never send the password as bearer authentication, including legacy callers.
  headers.delete('Authorization');
  const token = getSessionToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return globalThis.fetch(input, { ...init, headers });
}
