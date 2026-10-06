// Policy only: callers must authenticate the server-issued claims before using it.
// This function is not an offline login or a substitute for server replay checks.
const DAY_MS = 24 * 60 * 60 * 1000;

export function assertOfflineShiftGrant(claims, context, at = new Date().toISOString()) {
  if (!claims) throw new Error('يلزم تحقق سابق عبر الإنترنت لهذا المحاسب على هذا الجهاز');
  if (!context || ![claims.tenantId, claims.cashierId, claims.deviceId].every(value =>
    typeof value === 'string' && value) ||
    claims.tenantId !== context.tenantId || claims.cashierId !== context.cashierId ||
    claims.deviceId !== context.deviceId || !Array.isArray(claims.branchIds) ||
    !claims.branchIds.includes(context.branchId))
    throw new Error('تصريح العمل دون اتصال لا يخص هذا المحاسب أو الجهاز أو الفرع');
  if (context.drawerId !== undefined && (!Array.isArray(claims.drawerIds) || !claims.drawerIds.includes(context.drawerId)))
    throw new Error('تصريح العمل دون اتصال لا يخول هذا الجهاز للعمل على الدرج');
  const verifiedAt = Date.parse(claims.onlineVerifiedAt);
  const now = Date.parse(at);
  if (!Number.isFinite(verifiedAt) || !Number.isFinite(now) || verifiedAt > now)
    throw new Error('وقت تصريح العمل دون اتصال غير صالح');
  if (now - verifiedAt >= DAY_MS)
    throw new Error('انتهت صلاحية تصريح العمل دون اتصال؛ يلزم التحقق عبر الإنترنت');
  return true;
}
