import { ROLE_PERMISSIONS_PRESETS } from '../../src/data/initialData.js';

const permissions = {
  invoice: 'canSell', product: 'canManageInventory', customer: 'canManageCustomers',
  expense: 'canManageExpenses', purchase: 'canManagePurchases', supplier: 'canManagePurchases',
  customer_payment: 'canManageCustomers', supplier_payment: 'canManagePurchases',
  worker: 'canManagePayroll', worker_transaction: 'canManagePayroll', partner: 'canViewFinance',
  partner_drawing: 'canViewFinance', profit_distribution: 'canViewFinance',
  stock_transfer: 'canManageInventory', sales_return: 'canVoidInvoices',
  branch: 'canAccessSettings',
  purchase_return: 'canManagePurchases', damaged_item: 'canManageInventory', settings: 'canAccessSettings',
  restore_snapshot: 'canAccessSettings'
};
export function canSync(principal, type, action = 'read') {
  if (!Object.hasOwn(permissions, type)) return false;
  if (type === 'restore_snapshot') return principal.branchId === 'all' &&
    ['company_owner', 'admin', 'super_admin'].includes(principal.role) && ['read','create'].includes(action);
  if (type === 'branch') return principal.branchId === 'all' &&
    ['company_owner', 'admin', 'super_admin'].includes(principal.role);
  if (type === 'stock_transfer') return principal.branchId === 'all' &&
    ['company_owner', 'admin', 'super_admin'].includes(principal.role);
  const effective = ['company_owner', 'super_admin', 'admin'].includes(principal.role)
    ? ROLE_PERMISSIONS_PRESETS.admin.permissions
    : principal.role === 'custom' ? principal.permissions : ROLE_PERMISSIONS_PRESETS[principal.role]?.permissions || {};
  let permission = permissions[type];
  if (type === 'invoice') permission = action === 'read' ? 'canViewInvoices' : action === 'create' ? 'canSell' : 'canVoidInvoices';
  if (type === 'product' && action === 'read') return effective.canSell === true || effective.canManageInventory === true || effective.canManagePurchases === true;
  if (type === 'settings' && action === 'read') return effective.canAccessSettings === true || effective.canViewFinance === true;
  return effective[permission] === true;
}
export const SYNC_TYPES = Object.keys(permissions);

export function validateTenantPayload(value, tenantId, depth = 0) {
  if (depth > 30) throw new Error('Payload too deeply nested');
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (['tenantId', 'tenant_id'].includes(key) && item !== tenantId) throw new Error('Payload tenant mismatch');
    if (['password', 'password_hash', 'token', 'sessionToken', '__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Forbidden payload field');
    validateTenantPayload(item, tenantId, depth + 1);
  }
}
