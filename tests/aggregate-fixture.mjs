import * as initial from '../src/data/initialData.js';
import { scopedStorageKey } from '../src/services/tenantStorage.js';

const defaults = {
  products_v3: initial.INITIAL_PRODUCTS,
  customers_v3: initial.INITIAL_CUSTOMERS,
  invoices_v3: initial.INITIAL_INVOICES,
  expenses_v3: initial.INITIAL_EXPENSES,
  expense_categories_v3: initial.INITIAL_EXPENSE_CATEGORIES,
  settings_v3: initial.INITIAL_SETTINGS,
  damaged_v3: initial.INITIAL_DAMAGED_ITEMS,
  workers_v3: initial.INITIAL_WORKERS,
  worker_transactions_v3: initial.INITIAL_WORKER_TRANSACTIONS,
  customer_payments_v3: initial.INITIAL_CUSTOMER_PAYMENTS,
  purchases_v3: initial.INITIAL_PURCHASES,
  suppliers_v3: initial.INITIAL_SUPPLIERS,
  supplier_payments_v3: initial.INITIAL_SUPPLIER_PAYMENTS,
  partners_v3: initial.INITIAL_PARTNERS,
  partner_drawings_v3: initial.INITIAL_PARTNER_DRAWINGS,
  profit_distributions_v3: initial.INITIAL_PROFIT_DISTRIBUTIONS,
  sales_returns_v3: initial.INITIAL_SALES_RETURNS,
  purchase_returns_v3: initial.INITIAL_PURCHASE_RETURNS,
  tenants_v1: initial.INITIAL_TENANTS,
  users_v1: initial.INITIAL_USERS,
  branches_v1: initial.INITIAL_BRANCHES,
  active_branch_id_v1: 'branch-main',
  stock_transfers_v1: initial.INITIAL_STOCK_TRANSFERS,
  sync_heads_v1: {},
  trial_leads_v1: []
};

export function seedAggregate(target, identity, overrides = {}) {
  const ownedDefaults = { ...defaults, branches_v1: defaults.branches_v1.map(branch => ({ ...branch, tenantId: identity.tenantId })) };
  const state = Object.fromEntries(Object.entries({ ...ownedDefaults, ...overrides })
    .map(([name, value]) => [`khodar_pos_${name}`, structuredClone(value)]));
  // Trial leads use a separate historical key, not khodar_pos_ prefix.
  state.khodar_trial_leads_v1 = state.khodar_pos_trial_leads_v1;
  delete state.khodar_pos_trial_leads_v1;
  const snapshot = { schema: 1, identity: { id: identity.id, tenantId: identity.tenantId },
    revision: 0, state, outbox: [], cursor: 0, applied: {} };
  target.setItem(scopedStorageKey('atomic_v1', identity), JSON.stringify(snapshot));
  return snapshot;
}
