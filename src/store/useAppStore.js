import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  INITIAL_PRODUCTS, 
  INITIAL_CUSTOMERS, 
  INITIAL_SETTINGS, 
  INITIAL_INVOICES, 
  INITIAL_EXPENSES,
  INITIAL_EXPENSE_CATEGORIES,
  INITIAL_DAMAGED_ITEMS,
  INITIAL_WORKERS,
  INITIAL_WORKER_TRANSACTIONS,
  INITIAL_CUSTOMER_PAYMENTS,
  INITIAL_PURCHASES,
  INITIAL_SUPPLIERS,
  INITIAL_SUPPLIER_PAYMENTS,
  INITIAL_PARTNERS,
  INITIAL_PARTNER_DRAWINGS,
  INITIAL_PROFIT_DISTRIBUTIONS,
  INITIAL_SALES_RETURNS,
  INITIAL_PURCHASE_RETURNS,
  INITIAL_TENANTS,
  INITIAL_BRANCHES,
  INITIAL_STOCK_TRANSFERS,
  INITIAL_USERS,
  DEFAULT_PERMISSIONS,
  ROLE_PERMISSIONS_PRESETS
} from '../data/initialData';
import { getCurrentDateFormatted, getCurrentTimeFormatted, setBusinessTimeZone, dateInTimeZone } from '../utils/formatters';
import { adjustBalance, applyPurchaseInventory, applyPurchaseReturnPurchase, applyPurchaseReturnInventory, applyDamageInventory, applyWorkerAdvance, applyStockTransfer, applySalesReturnInventory, applySalesReturnInvoice } from '../services/businessEffects.js';
import { backupToState, validateBackup } from '../services/backupValidation.js';
import { SYNC_HEADS_STATE_KEY } from '../services/syncConflictPolicy.js';
import { scheduleBackup } from '../services/backupScheduler.js';
import { AtomicStore, INBOUND_REVIEW_KEY } from '../services/atomicStore.js';
import { MissingDependencyError } from '../services/missingDependency.js';
import { DurableAggregate } from '../services/durableAggregate.js';
import { branchCreateEvent } from '../services/branchEvents.js';
import { applyInvoiceInventory } from '../services/invoiceInventory.js';
import { cloudflareSync } from '../services/cloudflareSync';
import { apiFetch as fetch, getSessionToken, setSessionToken, getSessionUser, setSessionUser } from '../services/authSession.js';
import { createTenantStorage, writeTenantLoginContext, readAccessScopeTransition, clearAccessScopeTransition } from '../services/tenantStorage.js';
import { acquireWithCheckedLegacyMigration } from '../services/checkedLegacyMigration.js';
import { fetchCloudCheckpointPage, fetchServerBranchManifest } from '../services/cloudMigrationApi.js';
import { buildAccountingSnapshot } from '../services/accountingReconciliation.js';
import { assignedBranchIds, canAccessBranch, visibleBranches, visibleBranchRecords } from '../services/branchAccess.js';
import { cashMovementFromRecord } from '../services/cashMovement.js';
import { openShift as openShiftEngine, postCashEvent, closeShift as closeShiftEngine } from '../services/cashShiftEngine.js';
import { getApiBaseUrl } from '../config/appVersion';
import { commitDrawerFinancialAction, commitDrawerShiftDurable } from '../services/cashDrawerJournal.js';
import { enrollOnline, unlockOffline } from '../services/offlineGrantEnrollment.js';
import { ensureOfflineDeviceIdentity } from '../services/offlineDeviceIdentity.js';

const STORAGE_KEYS = {
  PRODUCTS: 'khodar_pos_products_v3',
  CUSTOMERS: 'khodar_pos_customers_v3',
  INVOICES: 'khodar_pos_invoices_v3',
  EXPENSES: 'khodar_pos_expenses_v3',
  EXPENSE_CATEGORIES: 'khodar_pos_expense_categories_v3',
  SETTINGS: 'khodar_pos_settings_v3',
  DAMAGED: 'khodar_pos_damaged_v3',
  WORKERS: 'khodar_pos_workers_v3',
  WORKER_TRANSACTIONS: 'khodar_pos_worker_transactions_v3',
  CUSTOMER_PAYMENTS: 'khodar_pos_customer_payments_v3',
  PURCHASES: 'khodar_pos_purchases_v3',
  SUPPLIERS: 'khodar_pos_suppliers_v3',
  SUPPLIER_PAYMENTS: 'khodar_pos_supplier_payments_v3',
  PARTNERS: 'khodar_pos_partners_v3',
  PARTNER_DRAWINGS: 'khodar_pos_partner_drawings_v3',
  PROFIT_DISTRIBUTIONS: 'khodar_pos_profit_distributions_v3',
  SALES_RETURNS: 'khodar_pos_sales_returns_v3',
  PURCHASE_RETURNS: 'khodar_pos_purchase_returns_v3',
  TENANTS: 'khodar_pos_tenants_v1',
  USERS: 'khodar_pos_users_v1',
  CURRENT_USER: 'khodar_pos_current_user_v1',
  BRANCHES: 'khodar_pos_branches_v1',
  ACTIVE_BRANCH_ID: 'khodar_pos_active_branch_id_v1',
  CASH_SHIFTS: 'khodar_pos_cash_shifts_v1',
  STOCK_TRANSFERS: 'khodar_pos_stock_transfers_v1',
  TRIAL_REQUESTS: 'khodar_trial_leads_v1'
};


/**
 * Authoritative User Permissions Resolver
 * Eliminates stale permission inheritance and guarantees role preset integrity.
 */
export const resolveUserPermissions = (user) => {
  if (!user) return DEFAULT_PERMISSIONS;
  if (user.role === 'super_admin' || user.role === 'company_owner' || user.role === 'admin') {
    return { ...ROLE_PERMISSIONS_PRESETS.admin.permissions };
  }
  // If a standard preset is assigned (cashier, accountant, inventory_manager),
  // the preset permissions are the authoritative source of truth.
  if (user.role && user.role !== 'custom' && ROLE_PERMISSIONS_PRESETS[user.role]) {
    return { ...ROLE_PERMISSIONS_PRESETS[user.role].permissions };
  }
  // If custom role, use explicit permissions
  return user.permissions ? { ...DEFAULT_PERMISSIONS, ...user.permissions } : { ...DEFAULT_PERMISSIONS };
};

export function useAppStore(options = {}) {
  const [currentUser, setCurrentUser] = useState(() => getSessionUser());
  const [unlockedDrawer, setUnlockedDrawer] = useState(null);
  const unlockGeneration = useRef(0);
  const cashDrawerContext = options.cashDrawerContext || unlockedDrawer;
  const [persistence, setPersistence] = useState({ ready: false, error: null });
  const [, redraw] = useState(0);
  // Keep the repository bound to this mounted identity.
  const [durableRepository] = useState(() => {
    if (Object.hasOwn(options, 'durableRepository')) return options.durableRepository || null;
    return getSessionUser() && globalThis.indexedDB ? new DurableAggregate(globalThis.indexedDB) : null;
  });
  const [local] = useState(() => {
    const storage = createTenantStorage();
    const storedBranches = storage.read(STORAGE_KEYS.BRANCHES, null);
    const storedActiveBranchId = storage.read(STORAGE_KEYS.ACTIVE_BRANCH_ID, null);
    const branchContext = options.serverBranchContext || (durableRepository && Array.isArray(storedBranches) && storedActiveBranchId
      ? { branches: storedBranches, activeBranchId: storedActiveBranchId } : null);
    if (branchContext && (!Array.isArray(branchContext.branches) ||
        branchContext.branches.some(branch => branch?.tenantId !== getSessionUser()?.tenantId) ||
        (!branchContext.branches.some(branch => branch.id === branchContext.activeBranchId) &&
          !(branchContext.activeBranchId === 'all' && canAccessBranch(getSessionUser(), 'all')))))
      throw new Error('بيانات فروع الخادم الأولية غير صالحة');
    const readInitial = (key, fallback) => {
      if (!durableRepository) return storage.read(key, fallback);
      if (key === STORAGE_KEYS.BRANCHES) return branchContext?.branches || fallback;
      if (key === STORAGE_KEYS.ACTIVE_BRANCH_ID) return branchContext?.activeBranchId || fallback;
      return fallback;
    };
    return new AtomicStore(getSessionUser(), {
      [STORAGE_KEYS.PRODUCTS]: readInitial(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS),
      [STORAGE_KEYS.CUSTOMERS]: readInitial(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS),
      [STORAGE_KEYS.INVOICES]: readInitial(STORAGE_KEYS.INVOICES, INITIAL_INVOICES),
      [STORAGE_KEYS.EXPENSES]: readInitial(STORAGE_KEYS.EXPENSES, INITIAL_EXPENSES),
      [STORAGE_KEYS.EXPENSE_CATEGORIES]: readInitial(STORAGE_KEYS.EXPENSE_CATEGORIES, INITIAL_EXPENSE_CATEGORIES),
      [STORAGE_KEYS.SETTINGS]: readInitial(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS),
      [STORAGE_KEYS.DAMAGED]: readInitial(STORAGE_KEYS.DAMAGED, INITIAL_DAMAGED_ITEMS),
      [STORAGE_KEYS.WORKERS]: readInitial(STORAGE_KEYS.WORKERS, INITIAL_WORKERS),
      [STORAGE_KEYS.WORKER_TRANSACTIONS]: readInitial(STORAGE_KEYS.WORKER_TRANSACTIONS, INITIAL_WORKER_TRANSACTIONS),
      [STORAGE_KEYS.CUSTOMER_PAYMENTS]: readInitial(STORAGE_KEYS.CUSTOMER_PAYMENTS, INITIAL_CUSTOMER_PAYMENTS),
      [STORAGE_KEYS.PURCHASES]: readInitial(STORAGE_KEYS.PURCHASES, INITIAL_PURCHASES),
      [STORAGE_KEYS.SUPPLIERS]: readInitial(STORAGE_KEYS.SUPPLIERS, INITIAL_SUPPLIERS),
      [STORAGE_KEYS.SUPPLIER_PAYMENTS]: readInitial(STORAGE_KEYS.SUPPLIER_PAYMENTS, INITIAL_SUPPLIER_PAYMENTS),
      [STORAGE_KEYS.PARTNERS]: readInitial(STORAGE_KEYS.PARTNERS, getSessionUser() ? [] : INITIAL_PARTNERS),
      [STORAGE_KEYS.PARTNER_DRAWINGS]: readInitial(STORAGE_KEYS.PARTNER_DRAWINGS, INITIAL_PARTNER_DRAWINGS),
      [STORAGE_KEYS.PROFIT_DISTRIBUTIONS]: readInitial(STORAGE_KEYS.PROFIT_DISTRIBUTIONS, INITIAL_PROFIT_DISTRIBUTIONS),
      [STORAGE_KEYS.SALES_RETURNS]: readInitial(STORAGE_KEYS.SALES_RETURNS, INITIAL_SALES_RETURNS),
      [STORAGE_KEYS.PURCHASE_RETURNS]: readInitial(STORAGE_KEYS.PURCHASE_RETURNS, INITIAL_PURCHASE_RETURNS),
      [STORAGE_KEYS.TENANTS]: readInitial(STORAGE_KEYS.TENANTS, INITIAL_TENANTS),
      [STORAGE_KEYS.USERS]: readInitial(STORAGE_KEYS.USERS, INITIAL_USERS),
      [STORAGE_KEYS.BRANCHES]: readInitial(STORAGE_KEYS.BRANCHES, getSessionUser() ? [] : INITIAL_BRANCHES),
      [STORAGE_KEYS.ACTIVE_BRANCH_ID]: readInitial(STORAGE_KEYS.ACTIVE_BRANCH_ID, getSessionUser() ? null : 'branch-main'),
      [STORAGE_KEYS.CASH_SHIFTS]: readInitial(STORAGE_KEYS.CASH_SHIFTS, []),
      [STORAGE_KEYS.STOCK_TRANSFERS]: readInitial(STORAGE_KEYS.STOCK_TRANSFERS, INITIAL_STOCK_TRANSFERS),
      [STORAGE_KEYS.TRIAL_REQUESTS]: readInitial(STORAGE_KEYS.TRIAL_REQUESTS, []),
      [SYNC_HEADS_STATE_KEY]: {},
    }, globalThis.localStorage, { durableFirst: Boolean(durableRepository) });
  });
  const archiveConflictingCache = async () => {
    if (!['company_owner', 'admin', 'super_admin'].includes(currentUser?.role))
      throw new Error('استرداد السجل متاح لمالك الشركة أو المسؤول فقط');
    const archiveKey = await local.archiveConflictingCache(durableRepository);
    window.location.reload();
    return archiveKey;
  };
  let products = local.read(STORAGE_KEYS.PRODUCTS);
  const setProducts = update => local.set(STORAGE_KEYS.PRODUCTS, update);
  let customers = local.read(STORAGE_KEYS.CUSTOMERS);
  const setCustomers = update => local.set(STORAGE_KEYS.CUSTOMERS, update);
  let invoices = local.read(STORAGE_KEYS.INVOICES);
  const setInvoices = update => local.set(STORAGE_KEYS.INVOICES, update);
  let expenses = local.read(STORAGE_KEYS.EXPENSES);
  const setExpenses = update => local.set(STORAGE_KEYS.EXPENSES, update);
  let expenseCategories = local.read(STORAGE_KEYS.EXPENSE_CATEGORIES);
  const setExpenseCategories = update => local.set(STORAGE_KEYS.EXPENSE_CATEGORIES, update);
  let settings = local.read(STORAGE_KEYS.SETTINGS);
  const setSettings = update => local.set(STORAGE_KEYS.SETTINGS, update);
  if (settings?.timeZone) setBusinessTimeZone(settings.timeZone);
  let damagedItems = local.read(STORAGE_KEYS.DAMAGED);
  const setDamagedItems = update => local.set(STORAGE_KEYS.DAMAGED, update);
  let workers = local.read(STORAGE_KEYS.WORKERS);
  const setWorkers = update => local.set(STORAGE_KEYS.WORKERS, update);
  let workerTransactions = local.read(STORAGE_KEYS.WORKER_TRANSACTIONS);
  const setWorkerTransactions = update => local.set(STORAGE_KEYS.WORKER_TRANSACTIONS, update);
  let customerPayments = local.read(STORAGE_KEYS.CUSTOMER_PAYMENTS);
  const setCustomerPayments = update => local.set(STORAGE_KEYS.CUSTOMER_PAYMENTS, update);
  let purchases = local.read(STORAGE_KEYS.PURCHASES);
  const setPurchases = update => local.set(STORAGE_KEYS.PURCHASES, update);
  let suppliers = local.read(STORAGE_KEYS.SUPPLIERS);
  const setSuppliers = update => local.set(STORAGE_KEYS.SUPPLIERS, update);
  let supplierPayments = local.read(STORAGE_KEYS.SUPPLIER_PAYMENTS);
  const setSupplierPayments = update => local.set(STORAGE_KEYS.SUPPLIER_PAYMENTS, update);
  let partners = local.read(STORAGE_KEYS.PARTNERS);
  const setPartners = update => local.set(STORAGE_KEYS.PARTNERS, update);
  let partnerDrawings = local.read(STORAGE_KEYS.PARTNER_DRAWINGS);
  const setPartnerDrawings = update => local.set(STORAGE_KEYS.PARTNER_DRAWINGS, update);
  let profitDistributions = local.read(STORAGE_KEYS.PROFIT_DISTRIBUTIONS);
  const setProfitDistributions = update => local.set(STORAGE_KEYS.PROFIT_DISTRIBUTIONS, update);
  let salesReturns = local.read(STORAGE_KEYS.SALES_RETURNS);
  const setSalesReturns = update => local.set(STORAGE_KEYS.SALES_RETURNS, update);
  let purchaseReturns = local.read(STORAGE_KEYS.PURCHASE_RETURNS);
  const setPurchaseReturns = update => local.set(STORAGE_KEYS.PURCHASE_RETURNS, update);
  let tenants = local.read(STORAGE_KEYS.TENANTS);
  const setTenants = update => local.set(STORAGE_KEYS.TENANTS, update);
  let users = local.read(STORAGE_KEYS.USERS);
  const setUsers = update => local.set(STORAGE_KEYS.USERS, update);
  let branches = visibleBranches(currentUser, local.read(STORAGE_KEYS.BRANCHES));
  const setBranches = update => local.set(STORAGE_KEYS.BRANCHES, update);
  let activeBranchId = local.read(STORAGE_KEYS.ACTIVE_BRANCH_ID);
  const setActiveBranchId = update => local.set(STORAGE_KEYS.ACTIVE_BRANCH_ID, update);
  const requireWorkingBranch = () => {
    if (!Array.isArray(currentUser?.branchIds)) return null;
    if (!activeBranchId || !branches.some(branch => branch.id === activeBranchId) ||
        !canAccessBranch(currentUser, activeBranchId))
      throw new Error('اختر فرعًا مصرحًا به قبل تسجيل الحركة');
    return activeBranchId;
  };
  const requireSameBranch = row => {
    const branchId = requireWorkingBranch();
    if (branchId && row?.branchId !== branchId)
      throw new Error('السجل لا ينتمي إلى الفرع النشط');
    return branchId;
  };
  let stockTransfers = local.read(STORAGE_KEYS.STOCK_TRANSFERS);
  const setStockTransfers = update => local.set(STORAGE_KEYS.STOCK_TRANSFERS, update);
  let cashShifts = local.read(STORAGE_KEYS.CASH_SHIFTS);
  const setCashShifts = update => local.set(STORAGE_KEYS.CASH_SHIFTS, update);
  let trialRequests = local.read(STORAGE_KEYS.TRIAL_REQUESTS);
  const setTrialRequests = update => local.set(STORAGE_KEYS.TRIAL_REQUESTS, update);

  useEffect(() => {
    let disposed = false;
    const unsubscribe = local.subscribe(() => {
      if (!disposed) {
        redraw(value => value + 1);
        if (local.failure) setPersistence(previous => ({ ...previous, error: local.failure }));
        // The repository notifies only after its transaction completes. Send
        // newly committed outbox entries immediately, never an uncommitted draft.
        if (cloudflareSync.repository === local && cloudflareSync.currentTenantId === currentUser?.tenantId &&
            local.current.outbox.some(event => event.tenantId === currentUser.tenantId)) {
          cloudflareSync.notifyListeners('queued');
          queueMicrotask(() => { if (!disposed) void cloudflareSync.flushQueue(); });
        }
      }
    });
    if (currentUser) {
      const transition = readAccessScopeTransition(currentUser);
      const cachedPrevious = transition ? globalThis.localStorage?.getItem(transition.oldKey) : null;
      const previous = cachedPrevious ? JSON.parse(cachedPrevious) : null;
      if (previous?.outbox?.length) {
        setPersistence({ ready: false, error:
          `تغيّر نطاق صلاحيات هذا المستخدم وتوجد ${previous.outbox.length} حركة محلية معلّقة في النطاق السابق. حُفظت دون حذف، وأُوقفت العمليات حتى يستردها المدير.` });
      } else acquireWithCheckedLegacyMigration({
        store: local,
        durable: durableRepository,
        createLegacyStore: () => new AtomicStore(currentUser, local.value.state, globalThis.localStorage),
        fetchPage: fetchCloudCheckpointPage,
        fetchBranches: fetchServerBranchManifest
      }).then(async ready => {
        if (disposed) return;
        if (ready) {
          const hasValidBranchContext = () => {
            const ownedBranches = local.read(STORAGE_KEYS.BRANCHES);
            const selected = local.read(STORAGE_KEYS.ACTIVE_BRANCH_ID);
            return Array.isArray(ownedBranches) && ownedBranches.length > 0 &&
              ownedBranches.every(branch => branch?.tenantId === currentUser.tenantId) &&
              (ownedBranches.some(branch => branch.id === selected) ||
                (selected === 'all' && canAccessBranch(currentUser, 'all')));
          };
          const canReadCompleteManifest = ['company_owner','admin','super_admin'].includes(currentUser.role) &&
            (!currentUser.branchId || currentUser.branchId === 'all');
          let manifest = null;
          let branchError = null;
          if (!hasValidBranchContext() && canReadCompleteManifest) {
            try {
              manifest = await fetchServerBranchManifest({tenantId:currentUser.tenantId});
              if (disposed) return;
              await local.repairBranchContextFromManifest(STORAGE_KEYS.BRANCHES, STORAGE_KEYS.ACTIVE_BRANCH_ID, manifest);
            } catch (error) { branchError = error; }
          }
          if (!hasValidBranchContext()) {
            await local.close();
            if (!disposed) setPersistence({ ready: false, error: `تعذر التحقق من فروع الشركة أو الفرع النشط؛ لم تُفتح العمليات المالية. ${branchError?.message || 'يلزم مراجعة بيانات الفروع.'}` });
            return;
          }
          if (canReadCompleteManifest) {
            manifest ||= await fetchServerBranchManifest({tenantId:currentUser.tenantId});
            if (!manifest?.fullTenantVisibility) throw new Error('تعذر تهيئة سياسة تعارض الأجهزة دون رؤية كاملة للشركة');
            if (!Object.hasOwn(local.value.state,SYNC_HEADS_STATE_KEY))
              await local.initializeConflictPolicy(manifest.conflictHeads,manifest.latestSequence);
          }
          if (ready && manifest)
            await (local.durable ? local.bootstrapBranchesDurable(STORAGE_KEYS.BRANCHES, manifest.conflictHeads) :
              local.bootstrapBranches(STORAGE_KEYS.BRANCHES, manifest.conflictHeads));
        }
        if (disposed) return;
        if (ready) clearAccessScopeTransition(currentUser);
        setPersistence({ ready, error: ready ? null : 'هذا الحساب مفتوح في نافذة أخرى. أغلقها ثم أعد فتح هذه النافذة للحفظ.' });
      }).catch(error => { if (!disposed) setPersistence({ ready: false, error: error.message }); });
    }
    return () => { disposed = true; unsubscribe(); void local.close(); };
  }, [local, durableRepository, currentUser]);

  const refreshBindings = () => {
    products = local.read(STORAGE_KEYS.PRODUCTS);
    customers = local.read(STORAGE_KEYS.CUSTOMERS);
    invoices = local.read(STORAGE_KEYS.INVOICES);
    expenses = local.read(STORAGE_KEYS.EXPENSES);
    expenseCategories = local.read(STORAGE_KEYS.EXPENSE_CATEGORIES);
    settings = local.read(STORAGE_KEYS.SETTINGS);
    if (settings?.timeZone) setBusinessTimeZone(settings.timeZone);
    damagedItems = local.read(STORAGE_KEYS.DAMAGED);
    workers = local.read(STORAGE_KEYS.WORKERS);
    workerTransactions = local.read(STORAGE_KEYS.WORKER_TRANSACTIONS);
    customerPayments = local.read(STORAGE_KEYS.CUSTOMER_PAYMENTS);
    purchases = local.read(STORAGE_KEYS.PURCHASES);
    suppliers = local.read(STORAGE_KEYS.SUPPLIERS);
    supplierPayments = local.read(STORAGE_KEYS.SUPPLIER_PAYMENTS);
    partners = local.read(STORAGE_KEYS.PARTNERS);
    partnerDrawings = local.read(STORAGE_KEYS.PARTNER_DRAWINGS);
    profitDistributions = local.read(STORAGE_KEYS.PROFIT_DISTRIBUTIONS);
    salesReturns = local.read(STORAGE_KEYS.SALES_RETURNS);
    purchaseReturns = local.read(STORAGE_KEYS.PURCHASE_RETURNS);
    tenants = local.read(STORAGE_KEYS.TENANTS);
    users = local.read(STORAGE_KEYS.USERS);
    branches = visibleBranches(currentUser, local.read(STORAGE_KEYS.BRANCHES));
    activeBranchId = local.read(STORAGE_KEYS.ACTIVE_BRANCH_ID);
    cashShifts = local.read(STORAGE_KEYS.CASH_SHIFTS);
    stockTransfers = local.read(STORAGE_KEYS.STOCK_TRANSFERS);
    trialRequests = local.read(STORAGE_KEYS.TRIAL_REQUESTS);
    refreshInboundRecords();
  };
  const atomicAction = (action, withDrawer = false) => (...args) => {
    if (local.read(INBOUND_REVIEW_KEY)?.length && action.name !== 'changeActiveBranch')
      throw new Error('توجد سجلات مستلمة تحتاج مراجعة؛ لم يُعدّل السجل غير المكتمل');
    if (activeBranchId === 'all' && !new Set([
      'changeActiveBranch', 'addBranch', 'updateBranch', 'deleteBranch', 'setMainBranch',
      'transferStockBetweenBranches', 'importBackupJSON', 'addTrialRequest',
      'updateTrialRequest', 'deleteTrialRequest'
    ]).has(action.name))
      throw new Error('عرض كل الفروع للقراءة فقط؛ اختر فرعًا قبل تسجيل حركة');
    if (currentUser?.tenantId && currentUser.tenantId !== 'tenant-demo' &&
        !Object.hasOwn(local.value.state,SYNC_HEADS_STATE_KEY))
      throw new Error('انتظر اكتمال مزامنة سياسة تعارض الأجهزة قبل تسجيل حركة جديدة');
    const invoke = () => { refreshBindings(); return action(...args); };
    const drawerTransition = (options.cashGrantStore || cashDrawerContext) && (action === openShift || action === closeShift);
    const commitDrawerTransition = async () => {
      refreshBindings();
      const context = cashDrawerContext, input = args[0];
      if (!context) throw new Error('افتح تصريح المحاسب قبل فتح أو إقفال الدرج');
      const opening = action === openShift;
      const ownShift = opening ? null : cashShifts?.find(row=>row.id===input?.shiftId);
      const branchId = requireWorkingBranch();
      if (!branchId || input?.actorId !== currentUser?.id ||
          context.shiftId !== (opening ? input?.id : input?.shiftId) ||
          (opening ? input?.tenantId !== currentUser?.tenantId || input?.branchId !== branchId ||
            input?.offlineDeviceId !== context.deviceId :
            ownShift?.branchId !== branchId || input?.deviceId !== context.deviceId))
        throw new Error('الدرج أو المحاسب أو الجهاز أو الفرع لا يطابق تصريح الوردية');
      return commitDrawerShiftDurable(local,local.durable,globalThis.navigator?.locks,
        opening ? 'open' : 'close',input,context.verifiedClaims,{signSources:true});
    };
    if (drawerTransition && !local.durable) throw new Error('الورديات تتطلب الحفظ الدائم المشترك');
    if (local.durable) return (drawerTransition ? commitDrawerTransition() : withDrawer && cashDrawerContext
      ? commitDrawerFinancialAction(local,local.durable,globalThis.navigator?.locks,cashDrawerContext,invoke)
      : local.transactDurable(invoke))
      .catch(error => {
        setPersistence(previous => ({ ...previous, error: error.message }));
        throw error;
      }).finally(refreshBindings);
    try {
      return local.transact(invoke);
    } catch (error) {
      setPersistence(previous => ({ ...previous, error: error.message }));
      throw error;
    } finally { refreshBindings(); }
  };
  const financialAction = action => (...args) => {
    const commit = () => {
      if (local.read(INBOUND_REVIEW_KEY)?.length)
        throw new Error('توجد سجلات مستلمة تحتاج مراجعة؛ الأرصدة غير مكتملة، ولم تُسجّل حركة مالية جديدة');
      if (options.cashGrantStore && !cashDrawerContext) throw new Error('افتح تصريح المحاسب قبل تسجيل حركة');
      if (cashDrawerContext && !local.durable) throw new Error('حركات الدرج تتطلب الحفظ الدائم المشترك');
      return atomicAction(action,true)(...args);
    };
    if (!currentUser || !getSessionToken() || !cloudflareSync.isOnline || !persistence.ready) return commit();
    return cloudflareSync.prepareFinancialMutation(currentUser.tenantId, handleInboundSyncEvents)
      .then(result => {
        if (!result.success) throw new Error(('error' in result && result.error) || 'تعذر تحديث البيانات المالية قبل العملية');
        return commit();
      });
  };

  // When a shift is open for the record's branch, attribute the cash movement to
  // that shift and append it to the shift journal in the same store transaction.
  const attributeCashToOpenShift = (record, type, reverse = false) => {
    const shifts = Array.isArray(cashShifts) ? cashShifts : [];
    let delta;
    try { delta = cashMovementFromRecord(type, record); } catch { return record; }
    if(reverse)delta=-delta;
    if (!Number.isFinite(delta) || delta === 0) return record;
    const candidates = shifts.filter(row => row.tenantId === currentUser?.tenantId &&
      row.branchId === record.branchId && row.actorId === currentUser?.id && row.status === 'open');
    if (candidates.length > 1) throw new Error('يوجد أكثر من درج مفتوح لهذا المحاسب؛ يلزم تحديد الدرج قبل تسجيل الحركة');
    const shift = candidates[0];
    if (!shift) return record;
    const movementId=`cash:${reverse?'void:':''}${record.clientTransactionId || record.id}`;
    const nextShifts = postCashEvent(shifts, {
      shiftId: shift.id, id: movementId,
      actorId: currentUser?.id, deviceId: shift.offlineDeviceId, amount: delta, at: new Date().toISOString()
    });
    setCashShifts(nextShifts);
    const updatedShift = nextShifts.find(row => row.id === shift.id);
    local.enqueue({ id: `cash-shift:${shift.id}:${movementId}`,
      tenantId: shift.tenantId, branchId: shift.branchId, entityType: 'cash_shift', entityId: shift.id,
      action: 'update', payload: updatedShift, timestamp: Date.now() });
    return { ...record, cashShiftId: shift.id };
  };

  // Open/close a cashier shift in the same store transaction as its sync event.
  const openShift = (input) => {
    if (input?.actorId !== currentUser?.id) throw new Error('هوية المحاسب لا تطابق مالك السجل المحلي');
    if (input?.tenantId && input.tenantId !== currentUser?.tenantId) throw new Error('الوردية لا تخص هذا السجل');
    const after = openShiftEngine(Array.isArray(cashShifts) ? cashShifts : [], input);
    setCashShifts(after);
    const shift = after.find(row => row.id === input.id);
    local.enqueue({ id: `cash-shift:${shift.id}:open`, tenantId: shift.tenantId, branchId: shift.branchId,
      entityType: 'cash_shift', entityId: shift.id, action: 'create', payload: shift, timestamp: Date.parse(input.at) });
    return shift;
  };

  const closeShift = (input) => {
    const after = closeShiftEngine(Array.isArray(cashShifts) ? cashShifts : [], {
      ...input, mode: 'local', pendingEventCount: local.current.outbox.length
    });
    setCashShifts(after);
    const shift = after.find(row => row.id === input.shiftId);
    local.enqueue({ id: `cash-shift:${shift.id}:close`, tenantId: shift.tenantId, branchId: shift.branchId,
      entityType: 'cash_shift', entityId: shift.id, action: 'update', payload: shift, timestamp: Date.parse(input.at) });
    return shift;
  };

  // Server account changes are authoritative. A failed local cache commit must
  // remain visible, but must not turn a successful server mutation into a
  // misleading "request failed" result that invites a duplicate retry.
  const commitRemoteCache = useCallback(async (update) => {
    try {
      if (local.durable) await local.transactDurable(update);
      else local.transact(update);
      return true;
    } catch (error) {
      setPersistence(previous => ({ ...previous, error: `تعذر تحديث النسخة المحلية بعد نجاح الخادم: ${error.message}` }));
      console.warn('Remote account cache update failed:', error);
      return false;
    }
  }, [local]);

  // Central Cloud Tenants Synchronization (Super Admin Only, Cloud-First & Offline-First)
  const syncCloudTenants = useCallback(async () => {
    if (typeof window === 'undefined' || !local.writable) return;
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/tenants`, {
        headers: {
          'Authorization': `Bearer ${getSessionToken()}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.tenants)) {
          await commitRemoteCache(() => setTenants(prev => {
            const map = new Map();
            prev.forEach(t => map.set(t.id, t));
            data.tenants.forEach(t => map.set(t.id, { ...map.get(t.id), ...t }));
            return Array.from(map.values());
          }));
        }
      }
    } catch (e) {
      console.warn('Sync cloud tenants warning:', e);
    }
  }, [local, commitRemoteCache]);

  useEffect(() => {
    if (currentUser?.role === 'super_admin') {
      syncCloudTenants();
    }
  }, [currentUser?.role, syncCloudTenants, persistence.ready]);

  // Central Cloud Users Synchronization (Cloud-First & Offline-First)
  const syncCloudUsers = useCallback(async (targetTenantId) => {
    if (typeof window === 'undefined') return;
    const tid = targetTenantId || currentUser?.tenantId;
    if (!local.writable || !tid || (typeof navigator !== 'undefined' && !navigator.onLine)) return;

    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/users?tenantId=${encodeURIComponent(tid)}`, {
        headers: { 'Authorization': `Bearer ${getSessionToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.users)) {
          await commitRemoteCache(() => setUsers(prev => {
            const map = new Map();
            prev.forEach(u => map.set(u.id, u));
            data.users.forEach(u => {
              const local = map.get(u.id);
              map.set(u.id, { ...local, ...u });
            });
            return Array.from(map.values());
          }));
        }
      }
    } catch (e) {
      console.warn('Sync cloud users warning:', e);
    }
  }, [currentUser?.tenantId, local, commitRemoteCache]);

  useEffect(() => {
    if (currentUser?.tenantId) {
      syncCloudUsers(currentUser.tenantId);
    }
  }, [currentUser?.tenantId, syncCloudUsers, persistence.ready]);

  // Local caches and broadcast messages are hints, never a source of role
  // or membership authority. Revalidate with the server on focus and periodically.
  useEffect(() => {
    if (!currentUser?.id) return;
    let disposed = false;
    let localExpiryClosing = false;
    const token = getSessionToken();
    const revalidate = async () => {
      if (disposed || token !== getSessionToken()) return;
      // A password-unlocked 24h grant is local authorization, not a cloud
      // bearer. Reconnecting must not convert the expected cloud 401 into
      // revocation of that still-valid local shift. A real login is required
      // before uploads resume; never synthesize/extend a server session.
      if (!token) {
        if (currentUser.isOfflineSession && !getSessionUser() && !localExpiryClosing) {
          localExpiryClosing = true;
          unlockGeneration.current++;
          setUnlockedDrawer(null);
          cloudflareSync.stopAutoSync();
          cloudflareSync.currentTenantId = null;
          cloudflareSync.setUpdateHandler(null);
          await local.close();
          if (disposed) return;
          setSessionToken(null);
          setCurrentUser(null);
          window.location.reload();
        }
        return;
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/auth/me`, { signal: AbortSignal.timeout(10000) });
        if (disposed || token !== getSessionToken()) return;
        if (response.status === 401) {
          cloudflareSync.stopAutoSync();
          cloudflareSync.currentTenantId = null;
          cloudflareSync.setUpdateHandler(null);
          setSessionToken(null);
          setCurrentUser(null);
          window.location.reload();
          return;
        }
        if (!response.ok) return; // Network failure does not destroy offline work.
        const result = await response.json();
        if (disposed || token !== getSessionToken() || !result.success) return;
        const verified = { ...result.user, permissions: resolveUserPermissions(result.user) };
        setSessionUser({ ...getSessionUser(), ...verified });
        setCurrentUser(previous => previous ? { ...previous, ...verified } : null);
      } catch { /* Offline: retain saved work; server still authorizes every API request. */ }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void revalidate(); };
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('khodar_auth_sync_channel') : null;
    if (channel) channel.onmessage = () => { void revalidate(); };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(revalidate, 15000);
    void revalidate();
    return () => {
      disposed = true;
      clearInterval(timer);
      channel?.close();
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [currentUser?.id]);

  // Track record identity before scheduling React updates. Deduplicating only
  // the invoice array does not deduplicate its inventory/debt side effects.
  const indexRows = rows => new Map(rows.map(row => [row.id, row]));
  const inboundRecords = useRef({
    invoice: new Map(), product: new Map(), customer: new Map(), supplier: new Map(),
    purchase: new Map(), expense: new Map(), customer_payment: new Map(),
    supplier_payment: new Map(), sales_return: new Map(), purchase_return: new Map(),
    damaged_item: new Map(), worker: new Map(), worker_transaction: new Map(),
    partner: new Map(), partner_drawing: new Map(), profit_distribution: new Map(),
    stock_transfer: new Map(), branch: new Map()
  });
  const refreshInboundRecords = () => { inboundRecords.current = {
    invoice:indexRows(invoices), product:indexRows(products), customer:indexRows(customers), supplier:indexRows(suppliers),
    purchase:indexRows(purchases), expense:indexRows(expenses), customer_payment:indexRows(customerPayments),
    supplier_payment:indexRows(supplierPayments), sales_return:indexRows(salesReturns), purchase_return:indexRows(purchaseReturns),
    damaged_item:indexRows(damagedItems), worker:indexRows(workers), worker_transaction:indexRows(workerTransactions),
    partner:indexRows(partners), partner_drawing:indexRows(partnerDrawings), profit_distribution:indexRows(profitDistributions),
    stock_transfer:indexRows(stockTransfers), branch:indexRows(branches)
  }; };
  refreshInboundRecords();

  // Inbound Cloud Synchronization Ingestion Handler
  // Merges transactions and changes received from other cashiers and mobile devices in real time
  const applyInboundSyncEvents = (events) => {
    if (!Array.isArray(events) || events.length === 0) return;

    events.forEach(evt => {
      const { entityType, entityId, action, payload } = evt;
      if (entityType === 'restore_snapshot') {
        if (action !== 'create' || payload?.id !== entityId)
          throw new Error('حدث استعادة غير صالح؛ لم يتقدم مؤشر الاستقبال');
        const restored = validateBackup(payload.snapshot, currentUser?.tenantId);
        for (const [key,value] of Object.entries(backupToState(restored))) local.set(key,value);
        inboundRecords.current = {
          invoice:indexRows(restored.invoices),product:indexRows(restored.products),customer:indexRows(restored.customers),supplier:indexRows(restored.suppliers),
          purchase:indexRows(restored.purchases),expense:indexRows(restored.expenses),customer_payment:indexRows(restored.customerPayments),
          supplier_payment:indexRows(restored.supplierPayments),sales_return:indexRows(restored.salesReturns),purchase_return:indexRows(restored.purchaseReturns),
          damaged_item:indexRows(restored.damagedItems),worker:indexRows(restored.workers),worker_transaction:indexRows(restored.workerTransactions),
          partner:indexRows(restored.partners),partner_drawing:indexRows(restored.partnerDrawings),profit_distribution:indexRows(restored.profitDistributions),
          stock_transfer:indexRows(restored.stockTransfers),branch:indexRows(restored.branches)
        };
        return;
      }
      const records = inboundRecords.current[entityType];
      const mutableTypes = ['invoice','customer','product','supplier','worker','partner','branch'];
      const allowed = entityType === 'settings' ? ['update'] : entityType === 'stock_transfer' ? ['create'] :
        ['create','delete', ...(mutableTypes.includes(entityType) ? ['update'] : []), ...(entityType === 'invoice' ? ['void'] : [])];
      if ((!records && entityType !== 'settings') || !allowed.includes(action) || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('حركة مزامنة غير مدعومة؛ لم يتقدم مؤشر الاستقبال');
      }
      const existing = records?.get(entityId);
      if (action === 'create' && existing) return;
      if (action === 'create') records?.set(entityId, payload);
      else if (action === 'delete') records?.delete(entityId);
      else if (existing) records?.set(entityId, { ...existing, ...payload });

      if (entityType === 'invoice') {
        if (action === 'create') {
          setInvoices(prev => prev.some(i => i.id === entityId) ? prev : [payload, ...prev]);
          setProducts(prev => applyInvoiceInventory(prev, payload, -1));
          if (payload.customerId && Number(payload.remainingDebt) > 0) {
            setCustomers(prev => prev.map(c => c.id === payload.customerId 
              ? { ...c, balance: Math.round(((Number(c.balance) || 0) + Number(payload.remainingDebt)) * 100) / 100 }
              : c
            ));
          }
        } else if (action === 'update' || action === 'void') {
          if(action === 'void' && [...inboundRecords.current.sales_return.values()].some(row=>row.invoiceId===entityId)) throw new Error('لا يمكن إلغاء فاتورة لها مردود قائم');
          if (action === 'void' && existing && existing.status !== 'voided') {
            setProducts(prev => applyInvoiceInventory(prev, existing, 1));
            if (existing.customerId && Number(existing.remainingDebt) > 0) {
              setCustomers(prev => prev.map(c => c.id === existing.customerId
                ? { ...c, balance: Math.round(((Number(c.balance) || 0) - Number(existing.remainingDebt)) * 100) / 100 } : c));
            }
          }
          setInvoices(prev => prev.map(i => i.id === entityId ? { ...i, ...payload } : i));
        } else if (action === 'delete') {
          if([...inboundRecords.current.sales_return.values()].some(row=>row.invoiceId===entityId)) throw new Error('لا يمكن حذف فاتورة لها مردود قائم');
          if (existing && existing.status !== 'voided') {
            setProducts(prev => applyInvoiceInventory(prev, existing, 1));
            if (existing.customerId && Number(existing.remainingDebt) > 0) {
              setCustomers(prev => prev.map(c => c.id === existing.customerId
                ? { ...c, balance: Math.round(((Number(c.balance) || 0) - Number(existing.remainingDebt)) * 100) / 100 } : c));
            }
          }
          setInvoices(prev => prev.filter(i => i.id !== entityId));
        }
      } else if (entityType === 'customer') {
        if (action === 'create') {
          setCustomers(prev => prev.some(c => c.id === entityId) ? prev : [payload, ...prev]);
        } else if (action === 'update') {
          setCustomers(prev => prev.map(c => c.id === entityId ? { ...c, ...payload } : c));
        } else if (action === 'delete') {
          setCustomers(prev => prev.filter(c => c.id !== entityId));
        }
      } else if (entityType === 'product') {
        if (action === 'create') {
          setProducts(prev => prev.some(p => p.id === entityId) ? prev : [payload, ...prev]);
        } else if (action === 'update') {
          setProducts(prev => prev.map(p => p.id === entityId ? { ...p, ...payload } : p));
        } else if (action === 'delete') {
          setProducts(prev => prev.filter(p => p.id !== entityId));
        }
      } else if (entityType === 'expense') {
        if (action === 'create') {
          setExpenses(prev => prev.some(e => e.id === entityId) ? prev : [payload, ...prev]);
        } else if (action === 'delete') {
          setExpenses(prev => prev.filter(e => e.id !== entityId));
        }
      } else if (entityType === 'purchase') {
        if (action === 'create') {
          setPurchases(prev => prev.some(p => p.id === entityId) ? prev : [payload, ...prev]);
          setProducts(prev => applyPurchaseInventory(prev, payload, 1));
          if (payload.supplierId && Number(payload.creditAmount) > 0) {
            setSuppliers(prev => prev.map(s => s.id === payload.supplierId
              ? { ...s, balance: Math.round(((Number(s.balance) || 0) + Number(payload.creditAmount)) * 100) / 100 }
              : s
            ));
          }
        } else if (action === 'delete') {
          if([...inboundRecords.current.purchase_return.values()].some(row=>row.purchaseId===entityId)) throw new Error('لا يمكن حذف شحنة لها مردود قائم');
          if (existing) {
            setProducts(prev => applyPurchaseInventory(prev, existing, -1));
            if (existing.supplierId && Number(existing.creditAmount) > 0) setSuppliers(prev => adjustBalance(prev, existing.supplierId, -Number(existing.creditAmount)));
          }
          setPurchases(prev => prev.filter(p => p.id !== entityId));
        }
      } else if (entityType === 'customer_payment') {
        if (action === 'create') {
          setCustomerPayments(prev => prev.some(p => p.id === entityId) ? prev : [payload, ...prev]);
          if (payload.customerId && Number(payload.amount) > 0) {
            setCustomers(prev => prev.map(c => c.id === payload.customerId
              ? { ...c, balance: Math.round(((Number(c.balance) || 0) - Number(payload.amount)) * 100) / 100 }
              : c
            ));
          }
        } else if (action === 'delete') {
          if (existing) setCustomers(prev => adjustBalance(prev, existing.customerId, Number(existing.amount)));
          setCustomerPayments(prev => prev.filter(p => p.id !== entityId));
        }
      } else if (entityType === 'supplier_payment') {
        if (action === 'create') {
          setSupplierPayments(prev => prev.some(p => p.id === entityId) ? prev : [payload, ...prev]);
          if (payload.supplierId && Number(payload.amount) > 0) {
            setSuppliers(prev => prev.map(s => s.id === payload.supplierId
              ? { ...s, balance: Math.round(((Number(s.balance) || 0) - Number(payload.amount)) * 100) / 100 }
              : s
            ));
          }
        } else if (action === 'delete') {
          if (existing) setSuppliers(prev => adjustBalance(prev, existing.supplierId, Number(existing.amount)));
          setExpenses(prev => prev.filter(expense => expense.supplierPaymentId !== entityId));
          setSupplierPayments(prev => prev.filter(p => p.id !== entityId));
        }
      } else if (entityType === 'supplier') {
        if (action === 'create') {
          setSuppliers(prev => prev.some(s => s.id === entityId) ? prev : [payload, ...prev]);
        } else if (action === 'update') {
          setSuppliers(prev => prev.map(s => s.id === entityId ? { ...s, ...payload } : s));
        } else if (action === 'delete') {
          setSuppliers(prev => prev.filter(s => s.id !== entityId));
        }
      } else if (entityType === 'sales_return') {
        if (action === 'create') {
          const invoice = inboundRecords.current.invoice.get(payload.invoiceId);
          if (!invoice || invoice.status === 'voided') throw new Error('الفاتورة الأصلية للمردود غير صالحة');
          setInvoices(prev => applySalesReturnInvoice(prev, payload, 1));
          setProducts(prev => applySalesReturnInventory(prev, invoice, payload, 1));
          if (payload.refundMethod === 'credit_deduction' && payload.customerId && payload.customerId !== 'walk_in') {
            setCustomers(prev => adjustBalance(prev, payload.customerId, -Number(payload.totalRefundAmount)));
          }
          setSalesReturns(prev => prev.some(r => r.id === entityId) ? prev : [payload, ...prev]);
        } else if (action === 'delete') {
          if (!existing) throw new MissingDependencyError('مردود المبيعات المراد عكسه غير موجود');
          const invoice = inboundRecords.current.invoice.get(existing.invoiceId);
          if (!invoice) throw new MissingDependencyError('الفاتورة الأصلية للمردود غير موجودة');
          setInvoices(prev => applySalesReturnInvoice(prev, existing, -1));
          setProducts(prev => applySalesReturnInventory(prev, invoice, existing, -1));
          if (existing.refundMethod === 'credit_deduction' && existing.customerId && existing.customerId !== 'walk_in') {
            setCustomers(prev => adjustBalance(prev, existing.customerId, Number(existing.totalRefundAmount)));
          }
          setSalesReturns(prev => prev.filter(r => r.id !== entityId));
        }
      } else if (entityType === 'purchase_return') {
        if (action === 'create') {
          const purchase=inboundRecords.current.purchase.get(payload.purchaseId);
          if (!purchase) throw new MissingDependencyError('شحنة المشتريات الأصلية للمردود غير موجودة');
          setPurchases(prev=>applyPurchaseReturnPurchase(prev,payload,1));
          setProducts(prev=>applyPurchaseReturnInventory(prev,purchase,payload,1));
          if(payload.refundMethod==='supplier_debt_deduction') setSuppliers(prev=>adjustBalance(prev,purchase.supplierId,-Number(payload.totalRefundAmount)));
          setPurchaseReturns(prev => prev.some(r => r.id === entityId) ? prev : [payload, ...prev]);
        } else if (action === 'delete') {
          if(!existing) throw new MissingDependencyError('مردود المشتريات المراد عكسه غير موجود');
          const purchase=inboundRecords.current.purchase.get(existing.purchaseId);
          if(!purchase) throw new MissingDependencyError('شحنة المشتريات الأصلية للمردود غير موجودة');
          setPurchases(prev=>applyPurchaseReturnPurchase(prev,existing,-1));
          setProducts(prev=>applyPurchaseReturnInventory(prev,purchase,existing,-1));
          if(existing.refundMethod==='supplier_debt_deduction') setSuppliers(prev=>adjustBalance(prev,purchase.supplierId,Number(existing.totalRefundAmount)));
          setPurchaseReturns(prev => prev.filter(r => r.id !== entityId));
        }
      } else if (entityType === 'damaged_item') {
        if (action === 'create') {
          if(!branches.some(branch=>branch.id===payload.branchId)) throw new MissingDependencyError('فرع قيد الهالك غير موجود');
          setProducts(prev=>applyDamageInventory(prev,payload,1));
          setDamagedItems(prev => prev.some(d => d.id === entityId) ? prev : [payload, ...prev]);
        } else if (action === 'delete') {
          if(!existing) throw new MissingDependencyError('قيد الهالك المراد عكسه غير موجود');
          setProducts(prev=>applyDamageInventory(prev,existing,-1));
          setDamagedItems(prev => prev.filter(d => d.id !== entityId));
        }
      } else if (entityType === 'worker') {
        if (action === 'create') {
          setWorkers(prev => prev.some(w => w.id === entityId) ? prev : [payload, ...prev]);
        } else if (action === 'update') {
          setWorkers(prev => prev.map(w => w.id === entityId ? { ...w, ...payload } : w));
        } else if (action === 'delete') {
          setWorkers(prev => prev.filter(w => w.id !== entityId));
        }
      } else if (entityType === 'worker_transaction') {
        if (action === 'create') {
          setWorkers(prev => applyWorkerAdvance(prev, payload, 1));
          setWorkerTransactions(prev => prev.some(t => t.id === entityId) ? prev : [payload, ...prev]);
        } else if (action === 'delete') {
          if (existing) setWorkers(prev => applyWorkerAdvance(prev, existing, -1));
          setExpenses(prev => prev.filter(expense => expense.workerTransactionId !== entityId));
          setWorkerTransactions(prev => prev.filter(t => t.id !== entityId));
        }
      } else if (entityType === 'partner') {
        if (action === 'create') {
          setPartners(prev => prev.some(p => p.id === entityId) ? prev : [payload, ...prev]);
        } else if (action === 'update') {
          setPartners(prev => prev.map(p => p.id === entityId ? { ...p, ...payload } : p));
        } else if (action === 'delete') {
          if ([...inboundRecords.current.partner_drawing.values()].some(row=>row.partnerId===entityId) ||
              [...inboundRecords.current.profit_distribution.values()].some(row=>(row.shares||[]).some(share=>share.partnerId===entityId)))
            throw new Error('لا يمكن حذف شريك له مسحوبات أو توزيعات قائمة');
          setPartners(prev => prev.filter(p => p.id !== entityId));
        }
      } else if (entityType === 'partner_drawing') {
        if (action === 'create') {
          setPartnerDrawings(prev => prev.some(d => d.id === entityId) ? prev : [payload, ...prev]);
        } else if (action === 'delete') {
          setPartnerDrawings(prev => prev.filter(d => d.id !== entityId));
        }
      } else if (entityType === 'profit_distribution') {
        if (action === 'create') {
          setProfitDistributions(prev => prev.some(d => d.id === entityId) ? prev : [payload, ...prev]);
        } else if (action === 'delete') {
          setProfitDistributions(prev => prev.filter(d => d.id !== entityId));
        }
      } else if (entityType === 'branch') {
        if (action === 'create') setBranches(prev => prev.some(b => b.id === entityId) ? prev : [...prev, payload]);
        else if (action === 'update') setBranches(prev => prev.map(b => b.id === entityId ? { ...b, ...payload } : b));
        else if (action === 'delete') setBranches(prev => prev.filter(b => b.id !== entityId));
      } else if (entityType === 'stock_transfer') {
        if (action !== 'create') throw new Error('المناقلة حركة مثبتة؛ عكسها يتطلب مناقلة مقابلة');
        setProducts(prev => applyStockTransfer(prev, branches, payload));
        setStockTransfers(prev => [payload, ...prev]);
      } else if (entityType === 'settings') {
        if (action === 'update') {
          setSettings(prev => ({ ...prev, ...payload,
            ...(payload.openingCashDrawerFloatByBranch ? { openingCashDrawerFloatByBranch: {
              ...prev.openingCashDrawerFloatByBranch, ...payload.openingCashDrawerFloatByBranch
            } } : {}) }));
        }
      }
    });
  };

  const inboundRef = useRef(null);
  inboundRef.current = (events, cursor, serverHeads, partialVisibility = false, proposal = null) => {
    if(['owner-reviewed-ledger-v1','owner-reviewed-checkpoint-v2'].includes(proposal?.protocol))return local.installReviewedResolution(proposal).finally(refreshBindings);
    const apply = batch => {
      refreshBindings();
      applyInboundSyncEvents(batch);
    };
    if(proposal?.protocol==='legacy-product-references-v1'){
      try{
        const result=local.recoverLegacyProducts(proposal.proofs,apply);
        return result?.then?result.finally(refreshBindings):result;
      }finally{refreshBindings();}
    }
    if (local.durable) return (proposal
      ? local.reconcileSalesDurable(events, cursor, apply, serverHeads, proposal)
      : local.receiveResilientDurable(events, cursor, apply, serverHeads, partialVisibility)).finally(refreshBindings);
    try {
      return proposal ? local.reconcileSales(events, cursor, apply, serverHeads, proposal)
        : local.receiveResilient(events, cursor, apply, serverHeads, partialVisibility);
    } finally { refreshBindings(); }
  };
  const handleInboundSyncEvents = useCallback((...args) => inboundRef.current(...args), []);

  // Immediate outbound sync, activity-driven inbound refresh, rare recovery fallback.
  useEffect(() => {
    if (!currentUser || !getSessionToken() || !persistence.ready) return;
    cloudflareSync.repository = local;
    const tenantId = currentUser.tenantId;
    
    cloudflareSync.startAutoSync(tenantId, handleInboundSyncEvents, undefined,
      options.cashGrantStore ? {scope:null,locks:globalThis.navigator?.locks,deviceProof:null} : null);
    return () => { cloudflareSync.stopAutoSync(); if (cloudflareSync.repository === local) cloudflareSync.repository = null; };
  }, [currentUser?.tenantId, handleInboundSyncEvents, persistence.ready, local, options.cashGrantStore]);

  const drawerSyncShift = cashShifts?.find(shift=>shift.id===cashDrawerContext?.shiftId &&
    shift.actorId===currentUser?.id && shift.tenantId===currentUser?.tenantId);
  const drawerSyncBranch = local.read(STORAGE_KEYS.ACTIVE_BRANCH_ID);
  useEffect(()=>{
    if(!options.cashGrantStore || !persistence.ready || cloudflareSync.repository!==local)return;
    let disposed=false;
    const blocked={scope:null,locks:globalThis.navigator?.locks,deviceProof:null};
    cloudflareSync.drawerReplay=blocked;
    if(cashDrawerContext && drawerSyncShift && drawerSyncBranch===drawerSyncShift.branchId) {
      const scope={tenantId:currentUser.tenantId,branchId:drawerSyncShift.branchId,
        drawerId:drawerSyncShift.drawerId,deviceId:cashDrawerContext.deviceId};
      void ensureOfflineDeviceIdentity(options.cashGrantStore).then(identity=>{
        if(disposed || cloudflareSync.repository!==local || cloudflareSync.drawerReplay!==blocked)return;
        const session=getSessionUser();
        if(identity.deviceId!==scope.deviceId || session?.id!==currentUser.id ||
            session?.tenantId!==scope.tenantId || local.read(STORAGE_KEYS.ACTIVE_BRANCH_ID)!==scope.branchId)return;
        cloudflareSync.drawerReplay={scope,locks:globalThis.navigator?.locks,deviceProof:identity.deviceProof};
        if(cloudflareSync.isOnline)void cloudflareSync.flushQueue();
      }).catch(()=>{/* Fail closed; do not enable unsigned fallback. */});
    }
    return ()=>{disposed=true;if(cloudflareSync.repository===local)cloudflareSync.drawerReplay=blocked;};
  },[options.cashGrantStore,persistence.ready,local,currentUser?.id,currentUser?.tenantId,
    cashDrawerContext,drawerSyncShift?.drawerId,drawerSyncShift?.branchId,drawerSyncBranch]);

  // Live Sync Status subscription
  const [syncStatus, setSyncStatus] = useState(() => ({
    status: 'idle',
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    queueLength: cloudflareSync.getQueueLength(),
    lastSyncTime: Date.now()
  }));

  useEffect(() => {
    return cloudflareSync.subscribe((state) => {
      setSyncStatus(prev => ({ ...prev, ...state }));
    });
  }, []);

  // Manual Instant Sync Trigger
  const syncNow = useCallback(async () => {
    const tenantId = currentUser?.tenantId || 'tenant-demo';
    return await cloudflareSync.syncNow(tenantId, handleInboundSyncEvents);
  }, [currentUser?.tenantId, handleInboundSyncEvents]);

  const [backupStatus, setBackupStatus] = useState({ status: 'idle', error: null });
  useEffect(() => {
    const activeTenantId = currentUser?.tenantId;
    // Branch-scoped replicas must not publish tenant-wide snapshots.
    if (!persistence.ready || !getSessionToken() || !activeTenantId ||
        activeTenantId === 'tenant-demo' || currentUser?.role !== 'company_owner' ||
        (currentUser?.branchId && currentUser.branchId !== 'all')) return;
    return scheduleBackup({
      snapshot: () => getBackupSnapshot(),
      upload: snapshot => cloudflareSync.uploadBackupSnapshot(activeTenantId, snapshot),
      onStatus: setBackupStatus
    });
  }, [
    products, customers, suppliers, invoices, expenses, expenseCategories, purchases,
    workers, workerTransactions, customerPayments, supplierPayments,
    partners, partnerDrawings, profitDistributions, salesReturns,
    purchaseReturns, damagedItems, settings, branches, stockTransfers,
    currentUser?.tenantId, currentUser?.role, currentUser?.branchId, persistence.ready
  ]);

  // Product Actions (with real-time cloud mutation broadcasting)
  const addProduct = (prod) => {
    const activeTenantId = currentUser?.tenantId || 'tenant-demo';
    const branchId = requireWorkingBranch();
    if (branchId && prod.branchId && prod.branchId !== branchId) throw new Error('الصنف لا ينتمي إلى الفرع النشط');
    const newProd = {
      ...prod,
      ...(branchId ? { branchId } : {}),
      id: prod.id || `prod-${crypto.randomUUID()}`
    };
    setProducts(prev => [newProd, ...prev]);
    try {
      cloudflareSync.recordMutation(activeTenantId, branchId, 'product', newProd.id, 'create', newProd);
    } catch (e) { throw e; }
    return newProd;
  };

  const updateProduct = (id, updates) => {
    const activeTenantId = currentUser?.tenantId || 'tenant-demo';
    const branchId = requireSameBranch(products.find(p => p.id === id));
    if (branchId && updates.branchId && updates.branchId !== branchId) throw new Error('لا يمكن نقل الصنف إلى فرع آخر بالتعديل');
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    try {
      cloudflareSync.recordMutation(activeTenantId, branchId, 'product', id, 'update', updates);
    } catch (e) { throw e; }
  };

  const updateProductPrice = (id, newPrice) => {
    const activeTenantId = currentUser?.tenantId || 'tenant-demo';
    const branchId = requireSameBranch(products.find(p => p.id === id));
    const priceNum = Number(newPrice);
    setProducts(prev => prev.map(p => p.id === id ? { ...p, defaultPricePerKg: priceNum } : p));
    try {
      cloudflareSync.recordMutation(activeTenantId, branchId, 'product', id, 'update', { defaultPricePerKg: priceNum });
    } catch (e) { throw e; }
  };

  const deleteProduct = (id) => {
    const activeTenantId = currentUser?.tenantId || 'tenant-demo';
    const branchId = requireSameBranch(products.find(p => p.id === id));
    setProducts(prev => prev.filter(p => p.id !== id));
    try {
      cloudflareSync.recordMutation(activeTenantId, branchId, 'product', id, 'delete', { id });
    } catch (e) { throw e; }
  };

  // Customer Actions (with real-time cloud mutation broadcasting)
  const addCustomer = (cust) => {
    const activeTenantId = currentUser?.tenantId || 'tenant-demo';
    const branchId = requireWorkingBranch();
    const newCust = {
      id: `cust-${crypto.randomUUID()}`,
      tenantId: activeTenantId,
      ...(branchId ? { branchId } : {}),
      name: cust.name,
      phone: cust.phone || '',
      balance: Number(cust.initialBalance || 0),
      address: cust.address || '',
      notes: cust.notes || ''
    };
    setCustomers(prev => [newCust, ...prev]);
    try {
      cloudflareSync.recordMutation(activeTenantId, branchId, 'customer', newCust.id, 'create', newCust);
    } catch (e) { throw e; }
    return newCust;
  };

  const updateCustomer = (id, updates) => {
    const activeTenantId = currentUser?.tenantId || 'tenant-demo';
    const branchId = requireSameBranch(customers.find(c => c.id === id));
    if (branchId && updates.branchId && updates.branchId !== branchId) throw new Error('لا يمكن نقل العميل إلى فرع آخر بالتعديل');
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    try {
      cloudflareSync.recordMutation(activeTenantId, branchId, 'customer', id, 'update', updates);
    } catch (e) { throw e; }
  };

  const deleteCustomer = (id) => {
    const activeTenantId = currentUser?.tenantId || 'tenant-demo';
    const branchId = requireSameBranch(customers.find(c => c.id === id));
    setCustomers(prev => prev.filter(c => c.id !== id));
    try {
      cloudflareSync.recordMutation(activeTenantId, branchId, 'customer', id, 'delete', { id });
    } catch (e) { throw e; }
  };

  const recordCustomerPayment = (customerId, amount, note = 'سداد دفعة نقدية', paymentMethod = 'cash', paymentId = null, clientTransactionId = null) => {
    const numAmount = Math.round(Number(amount) * 100) / 100;
    if (!numAmount || numAmount <= 0) return null;

    const clientTxId = clientTransactionId || paymentId;
    if (clientTxId) {
      const existing = customerPayments.find(p => 
        (p.clientTransactionId && p.clientTransactionId === clientTxId) ||
        (p.id && p.id === clientTxId)
      );
      if (existing) {
        console.warn('Idempotent duplicate customer payment prevented:', existing.id);
        return existing;
      }
    }

    const targetCustomer = customers.find(c => c.id === customerId);
    const branchId = requireSameBranch(targetCustomer);
    const customerName = targetCustomer ? targetCustomer.name : 'عميل';
    const activeTenantId = currentUser?.tenantId || targetCustomer?.tenantId || 'tenant-demo';

    setCustomers(prev => prev.map(c => {
      if (c.id === customerId) {
        return {
          ...c,
          balance: Math.round(((c.balance || 0) - numAmount) * 100) / 100
        };
      }
      return c;
    }));

    const newPayment = {
      id: paymentId || `pay-${crypto.randomUUID()}`,
      clientTransactionId: clientTxId || `tx_${crypto.randomUUID()}`,
      tenantId: activeTenantId,
      ...(branchId ? { branchId } : {}),
      customerId,
      customerName,
      amount: numAmount,
      method: paymentMethod || 'cash', // 'cash' (في الدرج) | 'bank' (تحويل بنكي)
      date: getCurrentDateFormatted(),
      time: getCurrentTimeFormatted(),
      notes: note || 'سداد دفعة نقدية'
    };

    const attributedPayment = attributeCashToOpenShift(newPayment, 'customer_payment');
    setCustomerPayments(prev => [attributedPayment, ...prev]);

    try {
      cloudflareSync.recordMutation(activeTenantId, branchId, 'customer_payment', attributedPayment.id, 'create', attributedPayment);
    } catch (e) { throw e; }

    return attributedPayment;
  };

  const deleteCustomerPayment = (paymentId) => {
    const target = customerPayments.find(p => p.id === paymentId);
    if (target) {
      const branchId = requireSameBranch(target);
      setCustomers(prev => prev.map(c => {
        if (c.id === target.customerId) {
          return {
            ...c,
            balance: Math.round(((c.balance || 0) + target.amount) * 100) / 100
          };
        }
        return c;
      }));
      setCustomerPayments(prev => prev.filter(p => p.id !== paymentId));
      try {
        const activeTenantId = currentUser?.tenantId || target.tenantId || 'tenant-demo';
        cloudflareSync.recordMutation(activeTenantId, branchId, 'customer_payment', paymentId, 'delete', { id: paymentId });
      } catch (e) { throw e; }
    }
  };

  // Invoice Actions
  const saveInvoice = (invoiceData) => {
    const scopedBranchId = requireWorkingBranch();
    if (scopedBranchId && invoiceData.branchId && invoiceData.branchId !== scopedBranchId)
      throw new Error('لا يمكن تسجيل فاتورة في فرع غير نشط');
    if (scopedBranchId) {
      for (const item of invoiceData.items || []) if (item.productId)
        requireSameBranch(products.find(product => product.id === item.productId));
      if (invoiceData.customerId && invoiceData.customerId !== 'walk_in')
        requireSameBranch(customers.find(customer => customer.id === invoiceData.customerId));
    }
    // 0. Idempotency Guard: prevent duplicate invoice creation and duplicate stock deductions
    const clientTxId = invoiceData.clientTransactionId || invoiceData.idempotencyKey || invoiceData.id;
    if (clientTxId) {
      const existing = [...inboundRecords.current.invoice.values()].find(inv =>
        (inv.clientTransactionId && inv.clientTransactionId === clientTxId) ||
        (inv.idempotencyKey && inv.idempotencyKey === clientTxId) ||
        (inv.id && inv.id === clientTxId)
      );
      if (existing) {
        console.warn('Idempotent duplicate sale invoice prevented:', existing.id);
        return existing;
      }
    }

    const newInvoiceNumber = settings.nextInvoiceNumber || (invoices.length + 126);
    const invoiceId = invoiceData.id || `${String(newInvoiceNumber).padStart(6, '0')}-${crypto.randomUUID()}`;

    // Credit / remaining debt calculation for credit or split payments
    let creditDebt = 0;
    if (invoiceData.paymentMethod === 'credit') {
      creditDebt = Number(invoiceData.finalTotal) || 0;
    } else if (invoiceData.paymentMethod === 'split') {
      creditDebt = Number(invoiceData.creditAmount) || 0;
    } else {
      creditDebt = Number(invoiceData.remainingDebt) || 0;
    }

    const activeB = branches.find(b => b.id === (invoiceData.branchId || activeBranchId)) || branches[0];
    const targetBranchId = activeB?.id || 'branch-main';
    const targetBranchName = activeB?.name || 'الفرع الرئيسي';

    const activeTenantId = invoiceData.tenantId || currentUser?.tenantId || 'tenant-demo';
    const newInvoice = {
      ...invoiceData,
      id: invoiceId,
      invoiceNumber: newInvoiceNumber,
      date: invoiceData.date || getCurrentDateFormatted(),
      time: invoiceData.time || getCurrentTimeFormatted(),
      clientTransactionId: clientTxId || `tx_${crypto.randomUUID()}`,
      idempotencyKey: clientTxId || `tx_${crypto.randomUUID()}`,
      tenantId: activeTenantId,
      branchId: targetBranchId,
      branchName: targetBranchName,
      remainingDebt: Math.round(creditDebt * 100) / 100,
      timestamp: invoiceData.timestamp || Date.now(),
      status: 'active'
    };

    inboundRecords.current.invoice.set(newInvoice.id, newInvoice);

    // If there is debt remaining and a known customer, update balance
    if (newInvoice.customerId && newInvoice.customerId !== 'walk_in' && creditDebt > 0) {
      setCustomers(prev => prev.map(c => {
        if (c.id === newInvoice.customerId) {
          return {
            ...c,
            balance: Math.round(((c.balance || 0) + creditDebt) * 100) / 100
          };
        }
        return c;
      }));
    }

    setProducts(prev => applyInvoiceInventory(prev, newInvoice, -1));

    const attributedInvoice = attributeCashToOpenShift(newInvoice, 'invoice');
    setInvoices(prev => [attributedInvoice, ...prev]);

    // Queue mutation for Cloudflare background sync
    try {
      const activeTenantId = currentUser?.tenantId || 'tenant-demo';
      cloudflareSync.recordMutation(activeTenantId, targetBranchId, 'invoice', invoiceId, 'create', attributedInvoice);
    } catch (e) {
      throw e;
    }

    setSettings(prev => ({
      ...prev,
      nextInvoiceNumber: newInvoiceNumber + 1
    }));

    return newInvoice;
  };

  const updateInvoiceNotes = (invoiceId, notes) => {
    const target = invoices.find(inv => inv.id === invoiceId);
    if (!target) throw new Error('الفاتورة غير موجودة');
    requireSameBranch(target);
    if (typeof notes !== 'string') throw new Error('ملاحظات الفاتورة غير صالحة');
    setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, notes } : inv));
    cloudflareSync.recordMutation(currentUser?.tenantId || 'tenant-demo', target.branchId || null,
      'invoice', invoiceId, 'update', { id: invoiceId, notes });
  };

  const voidInvoice = (invoiceId) => {
    const target = inboundRecords.current.invoice.get(invoiceId);
    if (!target || target.status === 'voided') return;
    requireSameBranch(target);
    if (salesReturns.some(row=>row.invoiceId===invoiceId)) throw new Error('لا يمكن إلغاء فاتورة لها مردود قائم');
    const reversal=cashDrawerContext?attributeCashToOpenShift(target,'invoice',true):null;
    inboundRecords.current.invoice.set(invoiceId, { ...target, status: 'voided' });

    // Reverse customer debt if applicable
    if (target.customerId && target.remainingDebt > 0) {
      setCustomers(prev => prev.map(c => {
        if (c.id === target.customerId) {
          return {
            ...c,
            balance: Math.round(((c.balance || 0) - target.remainingDebt) * 100) / 100
          };
        }
        return c;
      }));
    }

    const targetBranchId = target.branchId || 'branch-main';
    setProducts(prev => applyInvoiceInventory(prev, target, 1));

    setInvoices(prev => prev.map(i => i.id === invoiceId ? { ...i, status: 'voided' } : i));

    try {
      const activeTenantId = currentUser?.tenantId || 'tenant-demo';
      cloudflareSync.recordMutation(activeTenantId, targetBranchId, 'invoice', invoiceId, 'void', { id: invoiceId, status: 'voided',
        ...(reversal?.cashShiftId?{cashShiftId:reversal.cashShiftId}:{}) });
    } catch (e) { throw e; }
  };

  const deleteInvoice = (invoiceId) => {
    const target = invoices.find(i => i.id === invoiceId);
    requireSameBranch(target);
    if (salesReturns.some(row=>row.invoiceId===invoiceId)) throw new Error('لا يمكن حذف فاتورة لها مردود قائم');
    if (target && target.status !== 'voided') {
      if (target.customerId && target.remainingDebt > 0) {
        setCustomers(prev => prev.map(c => {
          if (c.id === target.customerId) {
            return {
              ...c,
              balance: Math.round(((c.balance || 0) - target.remainingDebt) * 100) / 100
            };
          }
          return c;
        }));
      }

      // Use the same ID-first inventory effect as posting and inbound reversal.
      // Name fallback is only valid when the sale line has no product ID.
      setProducts(prev => applyInvoiceInventory(prev, target, 1));
    }
    setInvoices(prev => prev.filter(i => i.id !== invoiceId));
    try {
      const activeTenantId = currentUser?.tenantId || target?.tenantId || 'tenant-demo';
      cloudflareSync.recordMutation(activeTenantId, target?.branchId || null, 'invoice', invoiceId, 'delete', { id: invoiceId });
    } catch (e) { throw e; }
  };

  // Sales Return Actions (مردودات المبيعات - بالسعر الفعلي التاريخي المحمي المسجل في الفاتورة)
  const recordSalesReturn = ({
    invoiceId,
    returnedItems = [], // Array of { productId, name, unit, returnedWeight, originalPricePerKg, reason }
    refundMethod = 'cash', // 'cash' | 'bank' | 'credit_deduction'
    inventoryAction = 'restock', // 'restock' (إعادة للمخزن) | 'damaged' (تحويل لتوالف وهالك)
    notes = ''
  }) => {
    const originalInvoice = invoices.find(inv => inv.id === invoiceId);
    if (!originalInvoice) throw new Error('الفاتورة الأصلية غير موجودة');
    requireSameBranch(originalInvoice);

    let totalRefund = 0;
    const processedItems = returnedItems.map(retItem => {
      // Find matching item in original invoice
      const sourceLineIndex = originalInvoice.items.findIndex(i =>
        (retItem.productId && i.productId === retItem.productId) || 
        (i.name && retItem.name && i.name.trim() === retItem.name.trim())
      );
      const origItem = originalInvoice.items[sourceLineIndex];

      // CRITICAL: Strictly use the historical price that was actually sold on this invoice!
      // Any subsequent changes to product catalog price are ignored.
      const historicalPrice = origItem ? Number(origItem.pricePerKg || 0) : Number(retItem.originalPricePerKg || 0);
      const retWeight = Number(retItem.returnedWeight || 0);
      const subtotal = Math.round(retWeight * historicalPrice * 100) / 100;
      totalRefund += subtotal;

      // Inventory effects are posted after the return record is complete.

      return {
        ...retItem,
        sourceLineIndex,
        originalPricePerKg: historicalPrice,
        returnedWeight: retWeight,
        subtotal
      };
    });

    totalRefund = Math.round(totalRefund * 100) / 100;

    // Handle financial refund deduction:
    // If credit_deduction: decrease customer debt
    if (originalInvoice.status === 'voided') throw new Error('لا يمكن رد فاتورة ملغاة');
    if (refundMethod === 'credit_deduction' && originalInvoice.customerId && originalInvoice.customerId !== 'walk_in') {
      setCustomers(prev => adjustBalance(prev, originalInvoice.customerId, -totalRefund));
    }

    const returnId = `ret-sale-${crypto.randomUUID()}`;
    const newReturn = {
      id: returnId,
      branchId: originalInvoice.branchId,
      invoiceId,
      customerId: originalInvoice.customerId,
      customerName: originalInvoice.customerName || 'عميل نقدي',
      customerPhone: originalInvoice.customerPhone || '',
      date: getCurrentDateFormatted(),
      time: getCurrentTimeFormatted(),
      items: processedItems,
      totalRefundAmount: totalRefund,
      refundMethod,
      inventoryAction,
      notes,
      createdAt: new Date().toISOString()
    };

    const attributedReturn = attributeCashToOpenShift(newReturn, 'sales_return');
    setSalesReturns(prev => [attributedReturn, ...prev]);
    setProducts(prev => applySalesReturnInventory(prev, originalInvoice, newReturn, 1));
    setInvoices(prev => applySalesReturnInvoice(prev, newReturn, 1));

    try {
      const activeTenantId = currentUser?.tenantId || 'tenant-demo';
      cloudflareSync.recordMutation(activeTenantId, originalInvoice.branchId || null, 'sales_return', attributedReturn.id, 'create', attributedReturn);
    } catch (e) { throw e; }

    return attributedReturn;
  };

  const deleteSalesReturn = (returnId) => {
    const target = salesReturns.find(r => r.id === returnId);
    if (!target) return;
    const branchId = requireSameBranch(target);

    // Reverse customer balance if credit_deduction
    if (target.refundMethod === 'credit_deduction' && target.customerId && target.customerId !== 'walk_in') {
      setCustomers(prev => adjustBalance(prev, target.customerId, Number(target.totalRefundAmount)));
    }

    const sourceInvoice = invoices.find(invoice => invoice.id === target.invoiceId);
    if (!sourceInvoice) throw new Error('الفاتورة الأصلية للمردود غير موجودة');
    setProducts(prev => applySalesReturnInventory(prev, sourceInvoice, target, -1));

    setInvoices(prev => applySalesReturnInvoice(prev, target, -1));

    setSalesReturns(prev => prev.filter(r => r.id !== returnId));
    try {
      const activeTenantId = currentUser?.tenantId || 'tenant-demo';
      cloudflareSync.recordMutation(activeTenantId, branchId, 'sales_return', returnId, 'delete', { id: returnId });
    } catch (e) { throw e; }
  };

  // Expense Categories Actions
  const addExpenseCategory = (catName) => {
    const trimmed = (catName || '').trim();
    if (!trimmed) return;
    setExpenseCategories(prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
  };

  const deleteExpenseCategory = (catName) => {
    setExpenseCategories(prev => prev.filter(c => c !== catName));
  };

  // Expenses Actions
  const addExpense = (exp) => {
    const scopedBranchId = requireWorkingBranch();
    if (scopedBranchId && exp.branchId && exp.branchId !== scopedBranchId)
      throw new Error('لا يمكن تسجيل مصروف في فرع غير نشط');
    const clientTxId = exp.clientTransactionId || exp.idempotencyKey || exp.id;
    if (clientTxId) {
      const existing = expenses.find(e => 
        (e.clientTransactionId && e.clientTransactionId === clientTxId) ||
        (e.idempotencyKey && e.idempotencyKey === clientTxId) ||
        (e.id && e.id === clientTxId)
      );
      if (existing) {
        console.warn('Idempotent duplicate expense prevented:', existing.id);
        return existing;
      }
    }

    const trimmedCat = (exp.category || 'نثريات وصيانة').trim();
    if (trimmedCat) {
      addExpenseCategory(trimmedCat);
    }
    const activeB = branches.find(b => b.id === (exp.branchId || activeBranchId)) || branches[0];
    const activeTenantId = exp.tenantId || currentUser?.tenantId || 'tenant-demo';
    const newExp = {
      ...exp,
      id: exp.id || `exp-${crypto.randomUUID()}`,
      clientTransactionId: clientTxId || `tx_${crypto.randomUUID()}`,
      idempotencyKey: clientTxId || `tx_${crypto.randomUUID()}`,
      tenantId: activeTenantId,
      branchId: activeB?.id || 'branch-main',
      branchName: activeB?.name || 'الفرع الرئيسي',
      category: trimmedCat,
      date: exp.date || getCurrentDateFormatted(),
      amount: Number(exp.amount) || 0
    };
    const attributedExp = attributeCashToOpenShift(newExp, 'expense');
    setExpenses(prev => [attributedExp, ...prev]);

    try {
      cloudflareSync.recordMutation(activeTenantId, attributedExp.branchId, 'expense', attributedExp.id, 'create', attributedExp);
    } catch (e) { throw e; }

    return attributedExp;
  };

  const deleteExpense = (id) => {
    const target = expenses.find(e => e.id === id);
    requireSameBranch(target);
    setExpenses(prev => prev.filter(e => e.id !== id));
    try {
      const activeTenantId = currentUser?.tenantId || target?.tenantId || 'tenant-demo';
      cloudflareSync.recordMutation(activeTenantId, target?.branchId || null, 'expense', id, 'delete', { id });
    } catch (e) { throw e; }
  };

  // Damaged / Spoiled Items Actions (التوالف والإعدامات)
  const addDamagedItem = (item) => {
    const scopedBranchId = requireWorkingBranch();
    if (scopedBranchId && item.branchId && item.branchId !== scopedBranchId)
      throw new Error('لا يمكن تسجيل هالك في فرع غير نشط');
    if (scopedBranchId && item.productId)
      requireSameBranch(products.find(product => product.id === item.productId));
    const qtyKg = Number(item.quantityKg);
    const costPerKg = Number(item.costPerKg);
    if (!Number.isFinite(costPerKg) || costPerKg < 0) throw new Error('تكلفة الهالك غير صالحة');
    if (item.branchId && !branches.some(branch=>branch.id===item.branchId)) throw new Error('فرع قيد الهالك غير موجود');
    const activeB = branches.find(b => b.id === (item.branchId || activeBranchId)) || branches[0];
    const targetBranchId = activeB?.id || 'branch-main';

    const newItem = {
      ...item,
      id: `dmg-${crypto.randomUUID()}`,
      branchId: targetBranchId,
      branchName: activeB?.name || 'الفرع الرئيسي',
      date: item.date || getCurrentDateFormatted(),
      quantityKg: qtyKg,
      costPerKg,
      totalLoss: Math.round(qtyKg * costPerKg * 100) / 100
    };

    setProducts(prev=>applyDamageInventory(prev,newItem,1));
    setDamagedItems(prev => [newItem, ...prev]);

    try {
      const activeTenantId = currentUser?.tenantId || 'tenant-demo';
      cloudflareSync.recordMutation(activeTenantId, targetBranchId, 'damaged_item', newItem.id, 'create', newItem);
    } catch (e) { throw e; }

    return newItem;
  };

  const deleteDamagedItem = (id) => {
    const target = damagedItems.find(d => d.id === id);
    if (!target) return;
    const branchId = requireSameBranch(target);
    setProducts(prev=>applyDamageInventory(prev,target,-1));
    setDamagedItems(prev => prev.filter(d => d.id !== id));
    try {
      const activeTenantId = currentUser?.tenantId || 'tenant-demo';
      cloudflareSync.recordMutation(activeTenantId, branchId, 'damaged_item', id, 'delete', { id });
    } catch (e) { throw e; }
  };

  // Workers & Payroll Actions (العمال والرواتب مع المزامنة السحابية اللحظية)
  const addWorker = (worker) => {
    const activeTenantId = currentUser?.tenantId || 'tenant-demo';
    const branchId = requireWorkingBranch();
    const newWorker = {
      ...worker,
      ...(branchId ? { branchId } : {}),
      id: `work-${crypto.randomUUID()}`,
      baseSalary: Number(worker.baseSalary) || 0,
      currentAdvance: 0,
      startDate: worker.startDate || getCurrentDateFormatted()
    };
    setWorkers(prev => [newWorker, ...prev]);
    try {
      cloudflareSync.recordMutation(activeTenantId, branchId, 'worker', newWorker.id, 'create', newWorker);
    } catch (e) { throw e; }
    return newWorker;
  };

  const updateWorker = (id, updates) => {
    const activeTenantId = currentUser?.tenantId || 'tenant-demo';
    const branchId = requireSameBranch(workers.find(worker => worker.id === id));
    if (branchId && updates.branchId && updates.branchId !== branchId) throw new Error('لا يمكن نقل العامل إلى فرع آخر بالتعديل');
    setWorkers(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
    try {
      cloudflareSync.recordMutation(activeTenantId, branchId, 'worker', id, 'update', updates);
    } catch (e) { throw e; }
  };

  const deleteWorker = (id) => {
    const activeTenantId = currentUser?.tenantId || 'tenant-demo';
    const branchId = requireSameBranch(workers.find(worker => worker.id === id));
    setWorkers(prev => prev.filter(w => w.id !== id));
    try {
      cloudflareSync.recordMutation(activeTenantId, branchId, 'worker', id, 'delete', { id });
    } catch (e) { throw e; }
  };

  // Worker Transactions (سلفيات ورواتب)
  const addWorkerTransaction = (transaction) => {
    const branchId = requireSameBranch(workers.find(worker => worker.id === transaction.workerId));
    const amount = Number(transaction.amount) || 0;
    const paymentMethod = transaction.paymentMethod || 'cash';
    const newTx = {
      ...transaction,
      ...(branchId ? { branchId } : {}),
      id: transaction.id || `wt-${crypto.randomUUID()}`,
      amount,
      paymentMethod,
      date: transaction.date || getCurrentDateFormatted()
    };

    setWorkers(prev => applyWorkerAdvance(prev, newTx, 1));

    const attributedTx = attributeCashToOpenShift(newTx, 'worker_transaction');
    setWorkerTransactions(prev => [attributedTx, ...prev]);

    // ONLY salaries are operational expenses. Advances are Balance Sheet assets (Employee Receivables), not P&L expenses.
    // Tag with isWorkerPayment: true to prevent double deduction in cash calculations.
    if (transaction.type === 'salary_payment') {
      addExpense({
        id: `exp-${newTx.id}`,
        clientTransactionId: `tx-exp-${newTx.id}`,
        title: `صرف راتب: ${transaction.workerName || 'عامل'}`,
        category: 'رواتب وعمالة',
        amount: amount,
        paymentMethod: paymentMethod,
        date: newTx.date,
        time: newTx.time || '',
        notes: transaction.notes || '',
        isWorkerPayment: true,
        workerTransactionId: newTx.id
      });
    }

    // Cloudflare sync
    try {
      const activeTenantId = currentUser?.tenantId || 'tenant-demo';
      cloudflareSync.recordMutation(activeTenantId, branchId, 'worker_transaction', attributedTx.id, 'create', attributedTx);
    } catch (e) { throw e; }

    return attributedTx;
  };

  const recordWorkerTransactionWithUpdate = (workerId, updates, transaction, updateBefore = false) => {
    if (!workers.some(worker => worker.id === workerId) || transaction.workerId !== workerId)
      throw new Error('العامل المرتبط بالحركة غير صالح');
    requireSameBranch(workers.find(worker => worker.id === workerId));
    if (updateBefore) updateWorker(workerId, updates);
    const saved = addWorkerTransaction(transaction);
    if (!updateBefore) updateWorker(workerId, updates);
    return saved;
  };

  const deleteWorkerTransaction = (id) => {
    const target = workerTransactions.find(t => t.id === id);
    if (target) {
      const branchId = requireSameBranch(target);
      if (target.type === 'absence_record') {
        const field = target.absenceType === 'medical' ? 'medicalAbsenceDays' :
          target.absenceType === 'unexcused' ? 'unexcusedAbsenceDays' : null;
        const days = Number(target.daysCount);
        const worker = workers.find(item => item.id === target.workerId);
        if (!field || !Number.isSafeInteger(days) || days <= 0 || !worker || Number(worker[field] || 0) < days)
          throw new Error('لا يمكن حذف غياب تمت تسويته أو لا يمكن التحقق من أيامه');
        updateWorker(worker.id, { [field]: Number(worker[field] || 0) - days });
      }
      setWorkers(prev => applyWorkerAdvance(prev, target, -1));
      // Remove linked expense if it was a salary payment
      setExpenses(prev => prev.filter(e => e.workerTransactionId !== id && e.id !== `exp-${id}`));
      try {
        const activeTenantId = currentUser?.tenantId || 'tenant-demo';
        cloudflareSync.recordMutation(activeTenantId, branchId, 'worker_transaction', id, 'delete', { id });
      } catch (e) { throw e; }
    }
    setWorkerTransactions(prev => prev.filter(t => t.id !== id));
  };

  // Settings Actions (مع المزامنة السحابية اللحظية)
  const updateSettings = (updates) => {
    if (updates?.timeZone !== undefined) dateInTimeZone(new Date(), updates.timeZone);
    const activeTenantId = currentUser?.tenantId || 'tenant-demo';
    const branchId = Array.isArray(currentUser?.branchIds) ? requireWorkingBranch() : null;
    setSettings(prev => {
      if (!branchId) {
        const nextSettings = { ...prev, ...updates };
        cloudflareSync.recordMutation(activeTenantId, null, 'settings', 'settings', 'update', nextSettings);
        return nextSettings;
      }
      const { openingCashDrawerFloat, openingCashDrawerFloatByBranch: _ignored, ...globalUpdates } = updates;
      if (currentUser?.isStaff && Object.entries(globalUpdates).some(([key, value]) =>
        JSON.stringify(value) !== JSON.stringify(prev[key])))
        throw new Error('إعدادات الشركة العامة يغيرها مالك الشركة فقط');
      const nextSettings = { ...prev, ...globalUpdates,
        openingCashDrawerFloatByBranch: { ...prev.openingCashDrawerFloatByBranch,
          [branchId]: openingCashDrawerFloat === undefined
            ? Number(prev.openingCashDrawerFloatByBranch?.[branchId]) || 0
            : Number(openingCashDrawerFloat) || 0 } };
      try {
        if (!currentUser?.isStaff && Object.keys(globalUpdates).length)
          cloudflareSync.recordMutation(activeTenantId, null, 'settings', 'settings', 'update', globalUpdates);
        if (openingCashDrawerFloat !== undefined)
          cloudflareSync.recordMutation(activeTenantId, branchId, 'settings', `settings:${branchId}`, 'update', {
            branchId, openingCashDrawerFloatByBranch: { [branchId]: nextSettings.openingCashDrawerFloatByBranch[branchId] }
          });
      } catch (e) { throw e; }
      return nextSettings;
    });
  };

  // Supplier Actions (الموردون وحسابات الديون والأرصدة مع المزامنة السحابية)
  const addSupplier = (sup) => {
    const initialAmt = Number(sup.initialBalance) || 0;
    // initialBalanceType: 'due_to_supplier' (له فلوس / دائن) -> positive balance
    //                     'advance_paid' (عليه فلوس / مدين) -> negative balance
    let computedBalance = 0;
    if (sup.balance !== undefined) {
      computedBalance = Number(sup.balance) || 0;
    } else if (sup.initialBalanceType === 'advance_paid') {
      computedBalance = -Math.abs(initialAmt);
    } else {
      computedBalance = Math.abs(initialAmt);
    }

    const activeTenantId = sup.tenantId || currentUser?.tenantId || 'tenant-demo';
    const branchId = requireWorkingBranch();
    const newSup = {
      id: `sup-${crypto.randomUUID()}`,
      tenantId: activeTenantId,
      ...(branchId ? { branchId } : {}),
      name: (sup.name || '').trim(),
      phone: (sup.phone || '').trim(),
      marketOrFarm: (sup.marketOrFarm || '').trim(),
      balance: Math.round(computedBalance * 100) / 100,
      notes: (sup.notes || '').trim()
    };
    setSuppliers(prev => [newSup, ...prev]);
    try {
      cloudflareSync.recordMutation(activeTenantId, branchId, 'supplier', newSup.id, 'create', newSup);
    } catch (e) { throw e; }
    return newSup;
  };

  const updateSupplier = (id, updates) => {
    const activeTenantId = currentUser?.tenantId || 'tenant-demo';
    const branchId = requireSameBranch(suppliers.find(s => s.id === id));
    if (branchId && updates.branchId && updates.branchId !== branchId) throw new Error('لا يمكن نقل المورد إلى فرع آخر بالتعديل');
    setSuppliers(prev => prev.map(s => s.id === id ? { 
      ...s, 
      ...updates,
      balance: updates.balance !== undefined ? Math.round(Number(updates.balance) * 100) / 100 : s.balance
    } : s));
    try {
      cloudflareSync.recordMutation(activeTenantId, branchId, 'supplier', id, 'update', updates);
    } catch (e) { throw e; }
  };

  const deleteSupplier = (id) => {
    const activeTenantId = currentUser?.tenantId || 'tenant-demo';
    const branchId = requireSameBranch(suppliers.find(s => s.id === id));
    setSuppliers(prev => prev.filter(s => s.id !== id));
    try {
      cloudflareSync.recordMutation(activeTenantId, branchId, 'supplier', id, 'delete', { id });
    } catch (e) { throw e; }
  };

  const recordSupplierPayment = ({ supplierId, amount, paymentMethod = 'cash', notes = '', date = null, time = null, id = null, clientTransactionId = null, idempotencyKey = null }) => {
    const numAmount = Math.round(Number(amount) * 100) / 100;
    if (!numAmount || numAmount <= 0) return null;

    const clientTxId = clientTransactionId || idempotencyKey || id;
    if (clientTxId) {
      const existing = supplierPayments.find(p => 
        (p.clientTransactionId && p.clientTransactionId === clientTxId) ||
        (p.idempotencyKey && p.idempotencyKey === clientTxId) ||
        (p.id && p.id === clientTxId)
      );
      if (existing) {
        console.warn('Idempotent duplicate supplier payment prevented:', existing.id);
        return existing;
      }
    }

    const targetSupplier = suppliers.find(s => s.id === supplierId);
    const branchId = requireSameBranch(targetSupplier);
    const supplierName = targetSupplier ? targetSupplier.name : 'مورد';

    // Deduct payment from supplier balance:
    // If balance was +1000 (we owed him) and we pay 1000 -> 0
    // If balance was +1000 and we pay 1200 -> -200 (he owes us / advance)
    // If balance was 0 and we pay 500 -> -500 (advance)
    setSuppliers(prev => prev.map(s => {
      if (s.id === supplierId) {
        return {
          ...s,
          balance: Math.round(((s.balance || 0) - numAmount) * 100) / 100
        };
      }
      return s;
    }));

    const newPayment = {
      id: id || `supp-pay-${crypto.randomUUID()}`,
      clientTransactionId: clientTxId || `tx_${crypto.randomUUID()}`,
      idempotencyKey: clientTxId || `tx_${crypto.randomUUID()}`,
      supplierId,
      ...(branchId ? { branchId } : {}),
      supplierName,
      amount: numAmount,
      paymentMethod, // 'cash' (من درج المحل) | 'bank' (تحويل بنكي)
      date: date || getCurrentDateFormatted(),
      time: time || getCurrentTimeFormatted(),
      notes: notes || (paymentMethod === 'cash' ? 'سداد دفعة نقدية من الخزينة' : 'حوالة بنكية للمورد')
    };

    const attributedPayment = attributeCashToOpenShift(newPayment, 'supplier_payment');
    setSupplierPayments(prev => [attributedPayment, ...prev]);

    // If paid cash from drawer, log as expense for visibility, tagged to prevent double counting
    if (paymentMethod === 'cash') {
      addExpense({
        id: `exp-${newPayment.id}`,
        clientTransactionId: `tx-exp-${newPayment.id}`,
        title: `سداد دفعة لمورد: ${supplierName}`,
        category: 'مشتريات وتوريد',
        amount: numAmount,
        date: newPayment.date,
        time: newPayment.time,
        notes: notes ? `سند صرف لمورد (${notes})` : 'سداد دفعة نقدية لمورد من الخزينة/الدرج',
        isSupplierPayment: true,
        supplierPaymentId: newPayment.id
      });
    }

    try {
      const activeTenantId = currentUser?.tenantId || targetSupplier?.tenantId || 'tenant-demo';
      cloudflareSync.recordMutation(activeTenantId, branchId, 'supplier_payment', attributedPayment.id, 'create', attributedPayment);
    } catch (e) { throw e; }

    return attributedPayment;
  };

  const deleteSupplierPayment = (paymentId) => {
    const target = supplierPayments.find(p => p.id === paymentId);
    if (target) {
      const branchId = requireSameBranch(target);
      // Re-add the amount back to the supplier balance
      setSuppliers(prev => prev.map(s => {
        if (s.id === target.supplierId) {
          return {
            ...s,
            balance: Math.round(((s.balance || 0) + target.amount) * 100) / 100
          };
        }
        return s;
      }));
      setSupplierPayments(prev => prev.filter(p => p.id !== paymentId));
      // Remove the linked expense if it was created
      setExpenses(prev => prev.filter(e => e.supplierPaymentId !== paymentId));
      try {
        const activeTenantId = currentUser?.tenantId || 'tenant-demo';
        cloudflareSync.recordMutation(activeTenantId, branchId, 'supplier_payment', paymentId, 'delete', { id: paymentId });
      } catch (e) { throw e; }
    }
  };

  // Purchases Actions (المشتريات وتوريد البضاعة من الموردين)
  const addPurchase = (purData) => {
    const scopedBranchId = requireWorkingBranch();
    if (scopedBranchId && purData.branchId && purData.branchId !== scopedBranchId)
      throw new Error('لا يمكن تسجيل شراء في فرع غير نشط');
    if (scopedBranchId && purData.supplierId)
      requireSameBranch(suppliers.find(supplier => supplier.id === purData.supplierId));
    if (scopedBranchId && purData.productId)
      requireSameBranch(products.find(product => product.id === purData.productId));
    // 0. Idempotency Guard: prevent duplicate purchase creation, double stock additions & double supplier balances
    const clientTxId = purData.clientTransactionId || purData.idempotencyKey || purData.id;
    if (clientTxId) {
      const existing = [...inboundRecords.current.purchase.values()].find(p =>
        (p.clientTransactionId && p.clientTransactionId === clientTxId) ||
        (p.idempotencyKey && p.idempotencyKey === clientTxId) ||
        (p.id && p.id === clientTxId)
      );
      if (existing) {
        console.warn('Idempotent duplicate purchase prevented:', existing.id);
        return existing;
      }
    }

    const total = Number(purData.totalCost) || (Number(purData.quantityKg || 0) * Number(purData.costPerKg || 0));
    const roundTotal = Math.round(total * 100) / 100;

    let creditAmount = 0;
    if (purData.paymentMethod === 'credit') {
      creditAmount = roundTotal;
    } else if (purData.paymentMethod === 'split') {
      creditAmount = Number(purData.creditAmount) || 0;
    }

    const method = purData.paymentMethod || 'cash';
    let paidCashAmount = 0;
    let paidBankAmount = 0;
    if (method === 'cash') {
      paidCashAmount = Math.max(0, roundTotal - creditAmount);
    } else if (method === 'bank') {
      paidBankAmount = Math.max(0, roundTotal - creditAmount);
    } else if (method === 'split') {
      paidCashAmount = Number(purData.cashAmount) || 0;
      paidBankAmount = Number(purData.bankAmount) || 0;
    }
    const paidAmount = paidCashAmount + paidBankAmount;

    const activeB = branches.find(b => b.id === (purData.branchId || activeBranchId)) || branches[0];
    const targetBranchId = activeB?.id || 'branch-main';
    const targetBranchName = activeB?.name || 'الفرع الرئيسي';

    const newPurchase = {
      ...purData,
      id: purData.id || `pur-${crypto.randomUUID()}`,
      clientTransactionId: clientTxId || `tx_${crypto.randomUUID()}`,
      idempotencyKey: clientTxId || `tx_${crypto.randomUUID()}`,
      branchId: targetBranchId,
      branchName: targetBranchName,
      date: purData.date || getCurrentDateFormatted(),
      time: purData.time || getCurrentTimeFormatted(),
      totalCost: roundTotal,
      quantityKg: Number(purData.quantityKg) || 0,
      packagesCount: Number(purData.packagesCount) || 0,
      costPerKg: Number(purData.costPerKg) || 0,
      supplierId: purData.supplierId || null,
      supplierName: purData.supplierName || 'سوق الجملة المركزي',
      paymentMethod: method,
      paymentType: method,
      paidAmount,
      paidCashAmount,
      paidBankAmount,
      creditAmount: creditAmount,
      bankName: purData.bankName || '',
      bankAccountNumber: purData.bankAccountNumber || '',
      notes: purData.notes || ''
    };

    inboundRecords.current.purchase.set(newPurchase.id, newPurchase);

    // If purchase has debt (credit) and is linked to a supplier, increase supplier's balance (له فلوس علينا)
    if (creditAmount > 0) {
      if (newPurchase.supplierId) {
        setSuppliers(prev => prev.map(s => {
          if (s.id === newPurchase.supplierId) {
            return {
              ...s,
              balance: Math.round(((s.balance || 0) + creditAmount) * 100) / 100
            };
          }
          return s;
        }));
      } else if (newPurchase.supplierName && newPurchase.supplierName !== 'سوق الجملة المركزي') {
        // The supplier's opening event must precede the purchase. Its opening
        // balance is zero: the purchase event applies the debt on every replica.
        const match = suppliers.find(s => (!scopedBranchId || s.branchId === scopedBranchId) &&
          s.name.trim() === newPurchase.supplierName.trim());
        const supplier = match || addSupplier({
          name: newPurchase.supplierName.trim(), balance: 0,
          notes: 'تم إنشاؤه تلقائياً من فاتورة توريد آجل'
        });
        newPurchase.supplierId = supplier.id;
        setSuppliers(prev => adjustBalance(prev, supplier.id, creditAmount));
      }
    }

    // Synchronize product inventory stock and update cost / weighted average cost
    const purQty = Math.round((Number(purData.quantityKg) || 0) * 100) / 100;
    const purCost = Math.round((Number(purData.costPerKg) || 0) * 100) / 100;
    const prodName = (purData.productName || '').trim();

    if (purData.isNewProduct && prodName) {
      const existing = products.find(p => (!scopedBranchId || p.branchId === scopedBranchId) && p.name.trim() === prodName);
      if (!existing) {
        const createdProduct = addProduct({
          name: prodName,
          category: purData.category || 'خضروات',
          icon: purData.icon || '📦',
          defaultPricePerKg: purData.sellingPricePerKg ? Number(purData.sellingPricePerKg) : Math.round((purCost * 1.3) * 100) / 100,
          costPerKg: purCost,
          lastPurchasePrice: purCost,
          tareWeightKg: purData.tareWeightPerPackage ? Number(purData.tareWeightPerPackage) : 1.2,
          defaultPackageType: purData.packageType || 'صندوق بلاستيك',
          currentStockKg: purQty,
          branchStock: { [targetBranchId]: purQty }
        });
        newPurchase.productId = createdProduct.id;
        newPurchase.inventorySeededWithPurchase = true;
      } else {
        // If already exists, update existing product stock and average cost
        setProducts(prev => prev.map(p => {
          if ((!scopedBranchId || p.branchId === scopedBranchId) && p.name.trim() === prodName) {
            const oldStock = Math.max(0, Number(p.currentStockKg) || 0);
            const newStock = Math.round((oldStock + purQty) * 100) / 100;
            const oldCost = Number(p.costPerKg) || 0;
            const avgCost = newStock > 0 
              ? Math.round(((oldStock * oldCost + purQty * purCost) / newStock) * 100) / 100
              : purCost;
            const curBStock = p.branchStock || {};
            const branchOldStock = Number(curBStock[targetBranchId] !== undefined ? curBStock[targetBranchId] : oldStock);
            const branchNewStock = Math.round((branchOldStock + purQty) * 100) / 100;
            return {
              ...p,
              currentStockKg: newStock,
              branchStock: {
                ...curBStock,
                [targetBranchId]: branchNewStock
              },
              costPerKg: avgCost > 0 ? avgCost : purCost,
              lastPurchasePrice: purCost,
              ...(purData.sellingPricePerKg ? { defaultPricePerKg: Number(purData.sellingPricePerKg) } : {})
            };
          }
          return p;
        }));
      }
    } else if (purQty > 0) {
      // Existing product selected from list or entered
      setProducts(prev => prev.map(p => {
        const isMatch = (!scopedBranchId || p.branchId === scopedBranchId) &&
          ((purData.productId && p.id === purData.productId) || (prodName && p.name.trim() === prodName));
        if (isMatch) {
          const oldStock = Math.max(0, Number(p.currentStockKg) || 0);
          const newStock = Math.round((oldStock + purQty) * 100) / 100;
          const oldCost = Number(p.costPerKg) || 0;
          const avgCost = newStock > 0 
            ? Math.round(((oldStock * oldCost + purQty * purCost) / newStock) * 100) / 100
            : purCost;
          const curBStock = p.branchStock || {};
          const branchOldStock = Number(curBStock[targetBranchId] !== undefined ? curBStock[targetBranchId] : oldStock);
          const branchNewStock = Math.round((branchOldStock + purQty) * 100) / 100;
          return {
            ...p,
            currentStockKg: newStock,
            branchStock: {
              ...curBStock,
              [targetBranchId]: branchNewStock
            },
            costPerKg: avgCost > 0 ? avgCost : purCost,
            lastPurchasePrice: purCost,
            ...(purData.sellingPricePerKg ? { defaultPricePerKg: Number(purData.sellingPricePerKg) } : {})
          };
        }
        return p;
      }));
    }

    const attributedPurchase = attributeCashToOpenShift(newPurchase, 'purchase');
    setPurchases(prev => [attributedPurchase, ...prev]);

    try {
      const activeTenantId = currentUser?.tenantId || 'tenant-demo';
      cloudflareSync.recordMutation(activeTenantId, targetBranchId, 'purchase', attributedPurchase.id, 'create', attributedPurchase);
    } catch (e) { throw e; }

    return newPurchase;
  };

  const deletePurchase = (id) => {
    const target = purchases.find(p => p.id === id);
    if (purchaseReturns.some(row=>row.purchaseId===id)) throw new Error('لا يمكن حذف شحنة لها مردود قائم');
    if (target) {
      if (target.creditAmount > 0 && target.supplierId) {
        setSuppliers(prev => prev.map(s => {
          if (s.id === target.supplierId) {
            return {
              ...s,
              balance: Math.round(((s.balance || 0) - target.creditAmount) * 100) / 100
            };
          }
          return s;
        }));
      }

      setProducts(prev => applyPurchaseInventory(prev, target, -1));
      try {
        const activeTenantId = currentUser?.tenantId || 'tenant-demo';
        cloudflareSync.recordMutation(activeTenantId, target.branchId || null, 'purchase', id, 'delete', { id });
      } catch (e) { throw e; }
    }
    setPurchases(prev => prev.filter(p => p.id !== id));
  };

  // Purchase Return Actions (مردودات المشتريات للموردين - بتكلفة الشراء الفعلية التاريخية المسجلة بالفاتورة)
  const recordPurchaseReturn = ({
    purchaseId,
    returnedKg,
    refundMethod = 'supplier_debt_deduction', // 'supplier_debt_deduction' | 'cash' | 'bank'
    reason = '',
    notes = ''
  }) => {
    const originalPurchase = (purchases || []).find(p => p.id === purchaseId);
    if (!originalPurchase) throw new Error('شحنة المشتريات الأصلية غير موجودة');
    requireSameBranch(originalPurchase);

    const retKg = Number(returnedKg) || 0;
    // CRITICAL: Strictly lock to historical costPerKg from that purchase bill!
    const historicalCostPerKg = Number(originalPurchase.costPerKg) || 0;
    const totalRefund = Math.round(retKg * historicalCostPerKg * 100) / 100;

    const returnId = `ret-pur-${crypto.randomUUID()}`;
    const newReturn = {
      id: returnId,
      branchId: originalPurchase.branchId,
      purchaseId,
      productId: originalPurchase.productId,
      productName: originalPurchase.productName,
      supplierId: originalPurchase.supplierId,
      supplierName: originalPurchase.supplierName,
      date: getCurrentDateFormatted(),
      time: getCurrentTimeFormatted(),
      returnedKg: retKg,
      originalCostPerKg: historicalCostPerKg,
      totalRefundAmount: totalRefund,
      refundMethod,
      reason,
      notes,
      createdAt: new Date().toISOString()
    };

    const attributedReturn = attributeCashToOpenShift(newReturn, 'purchase_return');
    setPurchaseReturns(prev => [attributedReturn, ...prev]);
    setPurchases(prev=>applyPurchaseReturnPurchase(prev,newReturn,1));
    setProducts(prev=>applyPurchaseReturnInventory(prev,originalPurchase,newReturn,1));
    if (refundMethod === 'supplier_debt_deduction') setSuppliers(prev=>adjustBalance(prev,originalPurchase.supplierId,-totalRefund));

    try {
      const activeTenantId = currentUser?.tenantId || 'tenant-demo';
      cloudflareSync.recordMutation(activeTenantId, originalPurchase.branchId || null, 'purchase_return', attributedReturn.id, 'create', attributedReturn);
    } catch (e) { throw e; }

    return attributedReturn;
  };

  const deletePurchaseReturn = (returnId) => {
    const target = purchaseReturns.find(r => r.id === returnId);
    if (!target) return;
    const branchId = requireSameBranch(target);

    const originalPurchase=purchases.find(p=>p.id===target.purchaseId);
    if(!originalPurchase) throw new Error('شحنة المشتريات الأصلية للمردود غير موجودة');
    setPurchases(prev=>applyPurchaseReturnPurchase(prev,target,-1));
    setProducts(prev=>applyPurchaseReturnInventory(prev,originalPurchase,target,-1));
    if(target.refundMethod==='supplier_debt_deduction') setSuppliers(prev=>adjustBalance(prev,originalPurchase.supplierId,Number(target.totalRefundAmount)));

    setPurchaseReturns(prev => prev.filter(r => r.id !== returnId));
    try {
      const activeTenantId = currentUser?.tenantId || 'tenant-demo';
      cloudflareSync.recordMutation(activeTenantId, branchId, 'purchase_return', returnId, 'delete', { id: returnId });
    } catch (e) { throw e; }
  };

  // Reset or Export/Import
  const resetToSampleData = () => {
    if (currentUser?.tenantId && currentUser.tenantId !== 'tenant-demo')
      throw new Error('لا يمكن استبدال بيانات شركة فعّالة ببيانات تجريبية دون استعادة معتمدة من الخادم');
    setProducts(INITIAL_PRODUCTS);
    setCustomers(INITIAL_CUSTOMERS);
    setInvoices(INITIAL_INVOICES);
    setExpenses(INITIAL_EXPENSES);
    setExpenseCategories(INITIAL_EXPENSE_CATEGORIES);
    setSettings(INITIAL_SETTINGS);
    setDamagedItems(INITIAL_DAMAGED_ITEMS);
    setWorkers(INITIAL_WORKERS);
    setWorkerTransactions(INITIAL_WORKER_TRANSACTIONS);
    setCustomerPayments(INITIAL_CUSTOMER_PAYMENTS);
    setPurchases(INITIAL_PURCHASES);
    setSuppliers(INITIAL_SUPPLIERS);
    setSupplierPayments(INITIAL_SUPPLIER_PAYMENTS);
    setSalesReturns(INITIAL_SALES_RETURNS);
    setPurchaseReturns(INITIAL_PURCHASE_RETURNS);
  };

  const getBackupSnapshot = () => {
    refreshBindings();
    if (local.read(INBOUND_REVIEW_KEY)?.length)
      throw new Error('السجل المالي غير مكتمل؛ احفظ ملف الاسترداد للسجلات المتعثرة بدل اعتماد نسخة احتياطية ناقصة');
    return {
      version: 4,
      tenantId: currentUser?.tenantId || 'tenant-demo',
      exportDate: new Date().toISOString(),
      syncCursor: local.value.cursor,
      products,
      customers,
      invoices,
      expenses,
      expenseCategories,
      settings,
      damagedItems,
      workers,
      workerTransactions,
      customerPayments,
      purchases,
      suppliers,
      supplierPayments,
      salesReturns,
      purchaseReturns,
      partners,
      partnerDrawings,
      profitDistributions,
      branches,
      activeBranchId: activeBranchId === 'all' ? branches[0]?.id : activeBranchId,
      stockTransfers
    };
  };

  const exportBackupJSON = () => {
    const data = getBackupSnapshot();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `khodar-full-backup-${getCurrentDateFormatted()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const exportInboundRecoveryJSON = () => {
    const data = { format: 'braka-inbound-recovery-v1', exportedAt: new Date().toISOString(), aggregate: local.value };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)], { type:'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `braka-inbound-recovery-${getCurrentDateFormatted()}.json`;
    anchor.click(); URL.revokeObjectURL(url);
  };

  // Partner Actions (مع المزامنة السحابية اللحظية)
  const addPartner = (partnerData) => {
    const activeTenantId = currentUser?.tenantId || 'tenant-demo';
    const branchId = requireWorkingBranch();
    const newPartner = {
      ...partnerData,
      ...(branchId ? { branchId } : {}),
      id: partnerData.id || `partner-${crypto.randomUUID()}`,
      sharePercentage: Number(partnerData.sharePercentage) || 0,
      initialCapital: Number(partnerData.initialCapital) || 0,
      createdAt: partnerData.createdAt || getCurrentDateFormatted()
    };
    setPartners(prev => [...prev, newPartner]);
    try {
      cloudflareSync.recordMutation(activeTenantId, branchId, 'partner', newPartner.id, 'create', newPartner);
    } catch (e) { throw e; }
    return newPartner;
  };

  const updatePartner = (id, updates) => {
    const activeTenantId = currentUser?.tenantId || 'tenant-demo';
    const branchId = requireSameBranch(partners.find(partner => partner.id === id));
    if (branchId && updates.branchId && updates.branchId !== branchId) throw new Error('لا يمكن نقل الشريك إلى فرع آخر بالتعديل');
    setPartners(prev => prev.map(p => p.id === id ? {
      ...p,
      ...updates,
      sharePercentage: updates.sharePercentage !== undefined ? Number(updates.sharePercentage) : p.sharePercentage,
      initialCapital: updates.initialCapital !== undefined ? Number(updates.initialCapital) : p.initialCapital
    } : p));
    try {
      cloudflareSync.recordMutation(activeTenantId, branchId, 'partner', id, 'update', updates);
    } catch (e) { throw e; }
  };

  const deletePartner = (id) => {
    const activeTenantId = currentUser?.tenantId || 'tenant-demo';
    const branchId = requireSameBranch(partners.find(partner => partner.id === id));
    if (partnerDrawings.some(row=>row.partnerId===id) ||
        profitDistributions.some(row=>(row.shares||[]).some(share=>share.partnerId===id)))
      throw new Error('لا يمكن حذف شريك له مسحوبات أو توزيعات قائمة');
    setPartners(prev => prev.filter(p => p.id !== id));
    try {
      cloudflareSync.recordMutation(activeTenantId, branchId, 'partner', id, 'delete', { id });
    } catch (e) { throw e; }
  };

  // Partner Drawings (سحب الشركاء مع المزامنة السحابية)
  const recordPartnerDrawing = (drawingData) => {
    const activeTenantId = currentUser?.tenantId || 'tenant-demo';
    const branchId = requireSameBranch(partners.find(partner => partner.id === drawingData.partnerId));
    const newDrawing = {
      ...drawingData,
      ...(branchId ? { branchId } : {}),
      id: drawingData.id || `draw-${crypto.randomUUID()}`,
      amount: Number(drawingData.amount) || 0,
      method: drawingData.method || 'cash', // 'cash' | 'bank'
      date: drawingData.date || getCurrentDateFormatted(),
      time: drawingData.time || getCurrentTimeFormatted(),
      notes: drawingData.notes || '',
      createdAt: new Date().toISOString()
    };
    const attributedDrawing = attributeCashToOpenShift(newDrawing, 'partner_drawing');
    setPartnerDrawings(prev => [attributedDrawing, ...prev]);
    try {
      cloudflareSync.recordMutation(activeTenantId, branchId, 'partner_drawing', attributedDrawing.id, 'create', attributedDrawing);
    } catch (e) { throw e; }
    return attributedDrawing;
  };

  const deletePartnerDrawing = (id) => {
    const activeTenantId = currentUser?.tenantId || 'tenant-demo';
    const branchId = requireSameBranch(partnerDrawings.find(drawing => drawing.id === id));
    setPartnerDrawings(prev => prev.filter(d => d.id !== id));
    try {
      cloudflareSync.recordMutation(activeTenantId, branchId, 'partner_drawing', id, 'delete', { id });
    } catch (e) { throw e; }
  };

  // Profit Distributions (توزيعات الأرباح مع المزامنة السحابية)
  const recordProfitDistribution = (distData) => {
    const activeTenantId = currentUser?.tenantId || 'tenant-demo';
    const branchId = requireWorkingBranch();
    if (branchId) for (const share of distData.shares || [])
      requireSameBranch(partners.find(partner => partner.id === share.partnerId));
    const newDist = {
      ...distData,
      ...(branchId ? { branchId } : {}),
      id: distData.id || `dist-${crypto.randomUUID()}`,
      totalDistributedAmount: Number(distData.totalDistributedAmount) || 0,
      date: distData.date || getCurrentDateFormatted(),
      time: distData.time || getCurrentTimeFormatted(),
      periodLabel: distData.periodLabel || 'توزيع أرباح عام',
      shares: distData.shares || [],
      notes: distData.notes || '',
      createdAt: new Date().toISOString()
    };
    const attributedDist = attributeCashToOpenShift(newDist, 'profit_distribution');
    setProfitDistributions(prev => [attributedDist, ...prev]);
    try {
      cloudflareSync.recordMutation(activeTenantId, branchId, 'profit_distribution', attributedDist.id, 'create', attributedDist);
    } catch (e) { throw e; }
    return attributedDist;
  };

  const deleteProfitDistribution = (id) => {
    const activeTenantId = currentUser?.tenantId || 'tenant-demo';
    const branchId = requireSameBranch(profitDistributions.find(distribution => distribution.id === id));
    setProfitDistributions(prev => prev.filter(d => d.id !== id));
    try {
      cloudflareSync.recordMutation(activeTenantId, branchId, 'profit_distribution', id, 'delete', { id });
    } catch (e) { throw e; }
  };

  // --------------------------------------------------------------------------
  // Financial Position Engine ("أين الفلوس الآن؟")
  // --------------------------------------------------------------------------
  const getFinancialPosition = () => {
    const scope = rows => visibleBranchRecords(currentUser, activeBranchId, rows);
    const calculate = ({ invoices, customerPayments, expenses, purchases, supplierPayments,
      workerTransactions, partnerDrawings, profitDistributions, salesReturns, purchaseReturns,
      customers, suppliers }, openingCashFloatValue) => {
    // 0. Opening Cash Float (العهدة الافتتاحية للصندوق)
    const openingCashFloat = Number(openingCashFloatValue) || 0;

    // 1. Cash Inflows
    const validInvoices = invoices.filter(i => i.status !== 'voided');
    const cashFromSales = validInvoices.reduce((sum, inv) => {
      if (inv.saleType === 'split') return sum + (Number(inv.cashAmount) || 0);
      if (inv.saleType === 'cash') return sum + (Number(inv.paidAmount) || 0);
      return sum;
    }, 0);

    // If method is missing, default to 'cash' for backwards compatibility
    const cashFromCustomerPayments = customerPayments
      .filter(p => !p.method || p.method === 'cash')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    // 2. Cash Outflows
    // Exclude supplier payments and worker payments from general expenses to prevent double deduction
    const cashExpenses = expenses
      .filter(e => e.paymentMethod !== 'bank' && !e.isSupplierPayment && !e.isWorkerPayment)
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const cashPurchases = (purchases || []).reduce((sum, p) => {
      if (p.paidCashAmount !== undefined) return sum + (Number(p.paidCashAmount) || 0);
      if (p.paymentMethod === 'cash') return sum + Math.max(0, (Number(p.totalCost) || 0) - (Number(p.creditAmount) || 0));
      if (p.paymentType === 'cash') return sum + (Number(p.paidAmount) || 0);
      return sum;
    }, 0);

    const cashSupplierPayments = (supplierPayments || [])
      .filter(sp => sp.paymentMethod !== 'bank')
      .reduce((sum, sp) => sum + (Number(sp.amount) || 0), 0);

    const cashWorkerAdvances = (workerTransactions || [])
      .filter(t => t.type === 'advance' && t.paymentMethod !== 'bank')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const cashWorkerSalaries = (workerTransactions || [])
      .filter(t => t.type === 'salary_payment' && t.paymentMethod !== 'bank')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const cashPartnerDrawings = (partnerDrawings || [])
      .filter(d => d.method !== 'bank')
      .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

    const cashProfitDistributions = (profitDistributions || [])
      .reduce((sum, dist) => {
        const sharesCash = (dist.shares || [])
          .filter(s => s.method !== 'bank')
          .reduce((sSum, s) => sSum + (Number(s.netPayout) || 0), 0);
        return sum + sharesCash;
      }, 0);

    // Sales returns cash refunds
    const cashSalesReturns = (salesReturns || [])
      .filter(r => r.refundMethod === 'cash')
      .reduce((sum, r) => sum + (Number(r.totalRefundAmount) || 0), 0);

    // Purchase returns cash received back into drawer
    const cashPurchaseReturns = (purchaseReturns || [])
      .filter(r => r.refundMethod === 'cash')
      .reduce((sum, r) => sum + (Number(r.totalRefundAmount) || 0), 0);

    // Net Cash in Drawer / Safe
    const totalCashInflow = openingCashFloat + cashFromSales + cashFromCustomerPayments + cashPurchaseReturns;
    const totalCashOutflow = cashExpenses + cashPurchases + cashSupplierPayments + cashWorkerAdvances + cashWorkerSalaries + cashPartnerDrawings + cashProfitDistributions + cashSalesReturns;
    const cashBalance = Math.round((totalCashInflow - totalCashOutflow) * 100) / 100;

    // 3. Bank Inflows
    const bankFromSales = validInvoices.reduce((sum, inv) => {
      if (inv.saleType === 'split') return sum + (Number(inv.bankAmount) || 0);
      if (inv.saleType === 'bank') return sum + (Number(inv.paidAmount) || 0);
      return sum;
    }, 0);

    const bankFromCustomerPayments = customerPayments
      .filter(p => p.method === 'bank')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    // Bank purchase returns received back into bank
    const bankPurchaseReturns = (purchaseReturns || [])
      .filter(r => r.refundMethod === 'bank')
      .reduce((sum, r) => sum + (Number(r.totalRefundAmount) || 0), 0);

    // 4. Bank Outflows
    const bankExpenses = expenses
      .filter(e => e.paymentMethod === 'bank' && !e.isSupplierPayment && !e.isWorkerPayment)
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const bankPurchases = (purchases || []).reduce((sum, p) => {
      if (p.paidBankAmount !== undefined) return sum + (Number(p.paidBankAmount) || 0);
      if (p.paymentMethod === 'bank') return sum + Math.max(0, (Number(p.totalCost) || 0) - (Number(p.creditAmount) || 0));
      if (p.paymentType === 'bank') return sum + (Number(p.paidAmount) || 0);
      return sum;
    }, 0);

    const bankSupplierPayments = (supplierPayments || [])
      .filter(sp => sp.paymentMethod === 'bank')
      .reduce((sum, sp) => sum + (Number(sp.amount) || 0), 0);

    const bankWorkerAdvances = (workerTransactions || [])
      .filter(t => t.type === 'advance' && t.paymentMethod === 'bank')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const bankWorkerSalaries = (workerTransactions || [])
      .filter(t => t.type === 'salary_payment' && t.paymentMethod === 'bank')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const bankPartnerDrawings = (partnerDrawings || [])
      .filter(d => d.method === 'bank')
      .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

    // Corrected filter to s.method === 'bank'
    const bankProfitDistributions = (profitDistributions || [])
      .reduce((sum, dist) => {
        const sharesBank = (dist.shares || [])
          .filter(s => s.method === 'bank')
          .reduce((sSum, s) => sSum + (Number(s.netPayout) || 0), 0);
        return sum + sharesBank;
      }, 0);

    // Bank sales returns refunded via bank
    const bankSalesReturns = (salesReturns || [])
      .filter(r => r.refundMethod === 'bank')
      .reduce((sum, r) => sum + (Number(r.totalRefundAmount) || 0), 0);

    // Net Bank Balance
    const totalBankInflow = bankFromSales + bankFromCustomerPayments + bankPurchaseReturns;
    const totalBankOutflow = bankExpenses + bankPurchases + bankSupplierPayments + bankWorkerAdvances + bankWorkerSalaries + bankPartnerDrawings + bankProfitDistributions + bankSalesReturns;
    const bankBalance = Math.round((totalBankInflow - totalBankOutflow) * 100) / 100;

    // 5. Debt Positions
    const totalCustomersDebt = customers.reduce((sum, c) => sum + Math.max(0, Number(c.balance) || 0), 0);
    const totalSuppliersDebt = (suppliers || []).reduce((sum, s) => sum + Math.max(0, Number(s.balance) || 0), 0);
    const totalSupplierAdvances = (suppliers || []).reduce((sum, s) => sum + Math.max(0, -(Number(s.balance) || 0)), 0);

    // 6. Total Liquidity & Net Working Capital
    const totalLiquidCash = cashBalance + bankBalance;
    const netMarketPosition = totalCustomersDebt - totalSuppliersDebt;
    const totalWorkingCapital = totalLiquidCash + totalCustomersDebt + totalSupplierAdvances - totalSuppliersDebt;

    const totalSalesReturnsAmount = (salesReturns || []).reduce((sum, r) => sum + (Number(r.totalRefundAmount) || 0), 0);
    const totalPurchaseReturnsAmount = (purchaseReturns || []).reduce((sum, r) => sum + (Number(r.totalRefundAmount) || 0), 0);

    return {
      openingCashFloat,
      cashBalance,
      bankBalance,
      totalLiquidCash,
      totalCustomersDebt,
      totalSuppliersDebt,
      totalSupplierAdvances,
      netMarketPosition,
      totalWorkingCapital,
      cashFromSales,
      cashFromCustomerPayments,
      cashExpenses,
      cashPurchases,
      cashSupplierPayments,
      cashWorkerAdvances,
      cashWorkerSalaries,
      cashPartnerDrawings,
      cashProfitDistributions,
      cashSalesReturns,
      cashPurchaseReturns,
      bankFromSales,
      bankFromCustomerPayments,
      bankExpenses,
      bankPurchases,
      bankSupplierPayments,
      bankWorkerAdvances,
      bankWorkerSalaries,
      bankPartnerDrawings,
      bankProfitDistributions,
      bankSalesReturns,
      bankPurchaseReturns,
      totalSalesReturnsAmount,
      totalPurchaseReturnsAmount
    };
    };
    return calculate({
      invoices: scope(invoices), customerPayments: scope(customerPayments), expenses: scope(expenses),
      purchases: scope(purchases), supplierPayments: scope(supplierPayments),
      workerTransactions: scope(workerTransactions), partnerDrawings: scope(partnerDrawings),
      profitDistributions: scope(profitDistributions), salesReturns: scope(salesReturns),
      purchaseReturns: scope(purchaseReturns), customers: scope(customers), suppliers: scope(suppliers)
    }, Array.isArray(currentUser?.branchIds)
      ? activeBranchId === 'all'
        ? branches.reduce((sum, branch) => sum + (Number(settings?.openingCashDrawerFloatByBranch?.[branch.id]) || 0), 0)
        : settings?.openingCashDrawerFloatByBranch?.[activeBranchId]
      : settings?.openingCashDrawerFloat);
  };

  const getAccountingSnapshot = () => buildAccountingSnapshot({
    products: visibleBranchRecords(currentUser, activeBranchId, products),
    customers: visibleBranchRecords(currentUser, activeBranchId, customers),
    invoices: visibleBranchRecords(currentUser, activeBranchId, invoices),
    expenses: visibleBranchRecords(currentUser, activeBranchId, expenses),
    damagedItems: visibleBranchRecords(currentUser, activeBranchId, damagedItems),
    workers: visibleBranchRecords(currentUser, activeBranchId, workers),
    workerTransactions: visibleBranchRecords(currentUser, activeBranchId, workerTransactions),
    purchases: visibleBranchRecords(currentUser, activeBranchId, purchases),
    suppliers: visibleBranchRecords(currentUser, activeBranchId, suppliers),
    partnerDrawings: visibleBranchRecords(currentUser, activeBranchId, partnerDrawings),
    profitDistributions: visibleBranchRecords(currentUser, activeBranchId, profitDistributions),
    salesReturns: visibleBranchRecords(currentUser, activeBranchId, salesReturns),
    purchaseReturns: visibleBranchRecords(currentUser, activeBranchId, purchaseReturns),
    partners: visibleBranchRecords(currentUser, activeBranchId, partners)
  }, getFinancialPosition());

  const importBackupJSON = (jsonString) => {
    try {
      const data = validateBackup(JSON.parse(jsonString), currentUser?.tenantId);
      if (!['company_owner','admin','super_admin'].includes(currentUser?.role) ||
          !assignedBranchIds(currentUser).includes('all'))
        throw new Error('الاستعادة تتطلب صلاحية مدير على الشركة كاملة');
      const id=`restore-${crypto.randomUUID()}`;
      for (const [key,value] of Object.entries(backupToState(data))) local.set(key,value);
      local.replaceOutboxWithRestore({id,tenantId:currentUser.tenantId,entityType:'restore_snapshot',entityId:id,
        action:'create',payload:{id,snapshot:data},timestamp:Date.now()});
      return { success: true, restoreEventId: id,
        policy: 'authoritative replacement; prior local outbox superseded; later server events apply after restore' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Authentication & Multi-Tenant Actions (with Store Code support)
  const unlockCashDrawer = async (password,shiftId) => {
    const generation = ++unlockGeneration.current;
    setUnlockedDrawer(null);
    if (!options.cashGrantStore || !currentUser || !local.durable || !persistence.ready ||
        typeof shiftId !== 'string' || !shiftId)
      throw new Error('الدخول أو الحفظ الدائم أو تصريح المحاسب غير جاهز');
    const branchId = requireWorkingBranch();
    const verifiedClaims = await unlockOffline({store:options.cashGrantStore,user:currentUser,password,branchId,
      ...(options.offlineGrantPublicJwk ? {pinnedPublicJwk:options.offlineGrantPublicJwk} : {})});
    const {deviceId} = await ensureOfflineDeviceIdentity(options.cashGrantStore);
    const session = getSessionUser();
    if (generation !== unlockGeneration.current || session?.id !== currentUser.id ||
        session?.tenantId !== currentUser.tenantId || local.read(STORAGE_KEYS.ACTIVE_BRANCH_ID) !== branchId || !local.writable)
      throw new Error('تغير الحساب أو الفرع أثناء فتح التصريح؛ أعد المحاولة');
    setUnlockedDrawer({shiftId,deviceId,verifiedClaims});
    return {shiftId,deviceId};
  };
  const login = async (username, password, explicitStoreCode = '') => {
    const cleanUser = String(username || '').trim().toLowerCase();
    const storeCode = explicitStoreCode.trim() || localStorage.getItem('khodar_remembered_store_code') || '';
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/tenants/lookup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, password, storeCode }),
        signal: AbortSignal.timeout(15000)
      });
      const result = await response.json();
      if (!response.ok || !result.session?.token) return { success: false, error: result.error || 'تعذر تسجيل الدخول' };
      setSessionToken(result.session.token);
      const user = { ...result.user, isStaff: result.userType === 'staff', status: 'active', sessionExpiresAt: result.session.expiresAt };
      user.permissions = resolveUserPermissions(user);
      let offlineGrantStatus = 'disabled';
      if (options.cashGrantStore) {
        try {
          await enrollOnline({store:options.cashGrantStore,apiBaseUrl:getApiBaseUrl(),token:result.session.token,
            user,password,fetchFn:fetch,
            ...(options.offlineGrantPublicJwk ? {pinnedPublicJwk:options.offlineGrantPublicJwk} : {})});
          offlineGrantStatus = 'enrolled';
        } catch { offlineGrantStatus = 'unavailable'; }
      }
      setSessionUser(user);
      setBusinessTimeZone(result.tenant?.timeZone);
      // The old store must not receive the new identity before the remount.
      writeTenantLoginContext(result.tenant, user, result.branches);
      localStorage.setItem('khodar_remembered_store_code', result.tenant.storeCode || storeCode);
      localStorage.setItem('khodar_remembered_username', cleanUser);
      window.location.reload(); // Remount every store slice under the authenticated tenant/user namespace.
      return { success: true, user, offlineGrantStatus };
    } catch {
      return { success: false, error: 'تعذر الاتصال بخدمة تسجيل الدخول. العمليات المحلية المحفوظة لم تُحذف.' };
    }
  };

  const logout = () => {
    unlockGeneration.current++;
    setUnlockedDrawer(null);
    // Preserve unsent transactions and caches. Erasing business storage on logout
    // can destroy the only copy of offline financial records.
    const token = getSessionToken();
    if (token) void fetch(`${getApiBaseUrl()}/api/auth/logout`, {
      method: 'POST', keepalive: true, headers: { Authorization: `Bearer ${token}` }
    }).catch(() => {});
    cloudflareSync.stopAutoSync();
    cloudflareSync.currentTenantId = null;
    cloudflareSync.setUpdateHandler(null);
    setSessionToken(null);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    setCurrentUser(null);
    window.location.reload();
  };

  const requestAccountChange = async (path, method, body) => {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method, headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'تعذر حفظ التغيير في الخادم');
    return result;
  };
  const changePassword = async (newPassword, currentPassword) => {
    if (currentUser?.role === 'super_admin') {
      await requestAccountChange('/api/auth/platform-owner', 'PATCH', {
        currentPassword, newPassword, confirmPassword: newPassword
      });
    } else {
      await requestAccountChange('/api/auth/password', 'POST', { currentPassword, newPassword });
    }
    logout();
    return true;
  };
  const createTenantAccount = async (data) => {
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + Number(data.durationMonths || 12));
    const result = await requestAccountChange('/api/tenants', 'POST', {
      ...data, id: crypto.randomUUID(), expiresAt: expiry.toISOString().slice(0, 10)
    });
    await commitRemoteCache(() => setTenants(prev => [result.tenant, ...prev]));
    return result.tenant;
  };
  const updateTenantAccount = async (tenantId, updates) => {
    const clean = { ...updates };
    if (!clean.password) delete clean.password;
    await requestAccountChange('/api/tenants', 'PATCH', { id: tenantId, ...clean });
    delete clean.password;
    await commitRemoteCache(() => setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, ...clean } : t)));
    return true;
  };
  const deleteTenantAccount = async (tenantId) => {
    await requestAccountChange(`/api/tenants?id=${encodeURIComponent(tenantId)}`, 'DELETE');
    await commitRemoteCache(() => setTenants(prev => prev.filter(t => t.id !== tenantId)));
  };
  const resetPassword = async (resetToken, newPassword) => {
    return requestAccountChange('/api/auth/reset', 'POST', { resetToken, newPassword });
  };
  const adminResetTenantPassword = (tenantId, newPassword) =>
    updateTenantAccount(tenantId, { password: newPassword });

  const broadcastAuthEvent = (type, payload) => {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('khodar_auth_sync_channel');
        channel.postMessage({ type, payload });
        channel.close();
      }
    } catch (e) {
      console.warn('broadcastAuthEvent warning:', e);
    }
  };

  // Staff Users & Permissions Management (إدارة المستخدمين والموظفين والصلاحيات)
  const hasPermission = (permissionKey) => {
    if (!currentUser) return false;
    if (currentUser.role === 'super_admin' || currentUser.role === 'company_owner' || currentUser.role === 'admin') {
      return true;
    }
    const perms = resolveUserPermissions(currentUser);
    return Boolean(perms?.[permissionKey]);
  };

  const addUser = async (data) => {
    const result = await requestAccountChange('/api/users', 'POST', {
      ...data, id: crypto.randomUUID(), tenantId: currentUser.tenantId
    });
    await commitRemoteCache(() => setUsers(prev => [result.user, ...prev]));
    broadcastAuthEvent('USER_UPDATED', result.user);
    return result.user;
  };
  const updateUser = async (userId, updates) => {
    const clean = { ...updates };
    if (!clean.password) delete clean.password;
    const result = await requestAccountChange('/api/users', 'PATCH', { ...clean, id: userId, tenantId: currentUser.tenantId });
    await commitRemoteCache(() => setUsers(prev => prev.map(u => u.id === userId ? result.user : u)));
    broadcastAuthEvent('USER_UPDATED', result.user);
    return result.user;
  };
  const deleteUser = async (userId) => {
    await requestAccountChange(`/api/users?id=${encodeURIComponent(userId)}&tenantId=${encodeURIComponent(currentUser.tenantId)}`, 'DELETE');
    await commitRemoteCache(() => setUsers(prev => prev.filter(u => u.id !== userId)));
    broadcastAuthEvent('USER_DELETED', { id: userId });
  };

  const activeBranch = activeBranchId === 'all' ? {
    id: 'all', name: 'كل الفروع — عرض فقط', code: 'ALL', isMain: false
  } : branches.find(b => b.id === activeBranchId) || branches[0] || {
    id: 'branch-main',
    name: 'الفرع الرئيسي (السوق المركزي)',
    code: 'BR-01',
    isMain: true
  };

  const changeActiveBranch = (branchId) => {
    if (!canAccessBranch(currentUser, branchId) ||
        (branchId !== 'all' && !branches.some(b => b.id === branchId)))
      throw new Error('لا تملك صلاحية عرض هذا الفرع');
    setActiveBranchId(branchId);
  };

  const addBranch = (branchData) => {
    if (!['company_owner','admin','super_admin'].includes(currentUser?.role) || (currentUser?.branchId && currentUser.branchId !== 'all')) throw new Error('لا تملك صلاحية إدارة الفروع');
    // Check allowed branches limit for tenant
    let allowed = 1;
    if (currentUser?.role === 'super_admin') {
      allowed = 999;
    } else {
      const parentTenant = tenants.find(t => t.id === currentUser?.tenantId || t.id === currentUser?.id);
      allowed = Number(parentTenant?.allowedBranches || currentUser?.allowedBranches || 1);
    }

    if (branches.length >= allowed) {
      throw new Error(`لقد وصلت للحد الأقصى المسموح لخطة اشتراك متجرك (${allowed} ${allowed > 1 ? 'فروع' : 'فرع'}). يرجى التواصل مع إدارة المنظومة لترقية الخطة وإضافة فروع أخرى.`);
    }

    const newBranch = {
      id: `branch-${crypto.randomUUID()}`,
      tenantId: currentUser?.tenantId || 'tenant-demo',
      name: (branchData.name || '').trim() || `فرع ${branches.length + 1}`,
      code: (branchData.code || '').trim() || `BR-${String(branches.length + 1).padStart(2, '0')}`,
      phone: (branchData.phone || '').trim(),
      address: (branchData.address || '').trim(),
      managerName: (branchData.managerName || '').trim(),
      isMain: branches.length === 0,
      status: 'active',
      createdAt: getCurrentDateFormatted()
    };

    setBranches(prev => [...prev, newBranch]);
    local.enqueue(branchCreateEvent(newBranch.tenantId, newBranch));
    return newBranch;
  };

  const updateBranch = (branchId, updates) => {
    if (!['company_owner','admin','super_admin'].includes(currentUser?.role) || (currentUser?.branchId && currentUser.branchId !== 'all')) throw new Error('لا تملك صلاحية إدارة الفروع');
    const target = branches.find(b => b.id === branchId);
    if (!target) throw new Error('الفرع غير موجود');
    const next = { ...target, ...updates, id: target.id, tenantId: currentUser.tenantId };
    setBranches(prev => prev.map(b => b.id === branchId ? next : b));
    cloudflareSync.recordMutation(currentUser.tenantId, null, 'branch', branchId, 'update', next);
  };

  const deleteBranch = (branchId) => {
    if (!['company_owner','admin','super_admin'].includes(currentUser?.role) || (currentUser?.branchId && currentUser.branchId !== 'all')) throw new Error('لا تملك صلاحية إدارة الفروع');
    const target = branches.find(b => b.id === branchId);
    if (!target) return;
    if (target.isMain) {
      alert('لا يمكن حذف الفرع الرئيسي. يمكنك تعيين فرع آخر كرئيسي أولاً.');
      return;
    }
    const hasInvoices = invoices.some(i => i.branchId === branchId);
    if (hasInvoices) {
      const confirmDeact = window.confirm('هذا الفرع مسجل عليه فواتير ومبيعات سابقة. هل ترغب في تعطيل الفرع بدلاً من حذفه نهائياً للحفاظ على السجلات المالية والتقارير؟');
      if (confirmDeact) {
        updateBranch(branchId, { status: 'inactive' });
      }
      return;
    }
    // Keep the branch identity for historic invoices, stock and transfers.
    updateBranch(branchId, { status: 'inactive' });
    if (activeBranchId === branchId) {
      const mainB = branches.find(b => b.isMain) || branches[0];
      setActiveBranchId(mainB?.id || 'branch-main');
    }
  };

  const setMainBranch = (branchId) => {
    if (!branches.some(b => b.id === branchId)) throw new Error('الفرع الرئيسي غير موجود');
    for (const branch of branches) if (branch.isMain !== (branch.id === branchId))
      updateBranch(branch.id, { isMain: branch.id === branchId });
  };

  const transferStockBetweenBranches = ({ fromBranchId, toBranchId, productId, productName, quantityKg, notes = '' }) => {
    if (!['company_owner','admin','super_admin'].includes(currentUser?.role) || (currentUser?.branchId && currentUser.branchId !== 'all')) throw new Error('لا تملك صلاحية المناقلة بين الفروع');
    const numQty = Math.round(Number(quantityKg) * 100) / 100;
    if (!numQty || numQty <= 0) throw new Error('يرجى إدخال وزن صحيح للمناقلة');
    if (fromBranchId === toBranchId) throw new Error('لا يمكن مناقلة المخزون لنفس الفرع');

    const fromB = branches.find(b => b.id === fromBranchId);
    const toB = branches.find(b => b.id === toBranchId);
    if (!fromB || !toB) throw new Error('الفرع المصدر أو المستلم غير موجود');

    const matches = products.filter(p => (!p.branchId || p.branchId === fromBranchId) &&
      (productId ? p.id === productId : p.name.trim() === (productName || '').trim()));
    if (matches.length !== 1) throw new Error('صنف المناقلة غير موجود أو غير محدد');
    productId = matches[0].id;
    productName = matches[0].name;
    const sourceProduct = matches[0];
    const scopedProducts = Boolean(sourceProduct.branchId);
    let destinationProduct = null;
    if (scopedProducts) {
      const available = Number(sourceProduct.branchStock?.[fromBranchId] ?? sourceProduct.currentStockKg);
      if (!Number.isFinite(available) || available < numQty || Number(sourceProduct.currentStockKg) < numQty)
        throw new Error('رصيد الفرع المصدر لا يكفي للمناقلة');
      const destinationMatches = products.filter(p => p.branchId === toBranchId && p.name.trim() === productName.trim());
      if (destinationMatches.length > 1) throw new Error('الصنف المستلم غير محدد في الفرع الآخر');
      destinationProduct = destinationMatches[0] || null;
    }

    const transferRecord = {
      id: `trans-${crypto.randomUUID()}`,
      fromBranchId,
      fromBranchName: fromB.name,
      toBranchId,
      toBranchName: toB.name,
      productId,
      productName,
      ...(scopedProducts ? { scopedProducts: true, sourceProductId: productId,
        destinationProductId: destinationProduct?.id || `prod-${crypto.randomUUID()}` } : {}),
      quantityKg: numQty,
      notes,
      date: getCurrentDateFormatted(),
      time: getCurrentTimeFormatted(),
      timestamp: Date.now()
    };

    if (scopedProducts) {
      const roundStock = value => Math.round((value + Number.EPSILON) * 100) / 100;
      const sourceStock = roundStock(Number(sourceProduct.currentStockKg) - numQty);
      const sourceBranchStock = roundStock(Number(sourceProduct.branchStock?.[fromBranchId] ?? sourceProduct.currentStockKg) - numQty);
      const sourceUpdate = { currentStockKg: sourceStock,
        branchStock: { ...sourceProduct.branchStock, [fromBranchId]: sourceBranchStock } };
      const destinationStock = Number(destinationProduct?.currentStockKg || 0);
      const destinationCost = Number(destinationProduct?.costPerKg || 0);
      const sourceCost = Number(sourceProduct.costPerKg || 0);
      const newDestinationStock = roundStock(destinationStock + numQty);
      const destinationUpdate = { currentStockKg: newDestinationStock,
        branchStock: { ...destinationProduct?.branchStock, [toBranchId]: newDestinationStock },
        costPerKg: newDestinationStock > 0
          ? roundStock((destinationStock * destinationCost + numQty * sourceCost) / newDestinationStock) : sourceCost };
      const createdDestination = destinationProduct ? null : { ...sourceProduct,
        id: transferRecord.destinationProductId, branchId: toBranchId,
        ...destinationUpdate };
      setProducts(prev => createdDestination
        ? [createdDestination, ...prev.map(p => p.id === sourceProduct.id ? { ...p, ...sourceUpdate } : p)]
        : prev.map(p => p.id === sourceProduct.id ? { ...p, ...sourceUpdate }
          : p.id === destinationProduct.id ? { ...p, ...destinationUpdate } : p));
      cloudflareSync.recordMutation(currentUser.tenantId, fromBranchId, 'product', sourceProduct.id, 'update', sourceUpdate);
      cloudflareSync.recordMutation(currentUser.tenantId, toBranchId, 'product', transferRecord.destinationProductId,
        createdDestination ? 'create' : 'update', createdDestination || destinationUpdate);
    } else setProducts(prev => applyStockTransfer(prev, branches, transferRecord));
    setStockTransfers(prev => [transferRecord, ...prev]);
    cloudflareSync.recordMutation(currentUser.tenantId, null, 'stock_transfer', transferRecord.id, 'create', transferRecord);
    return transferRecord;
  };

  // 1-Month Trial Requests Management (طلبات التجربة المجانية)
  const addTrialRequest = (req) => {
    const newReq = {
      id: `trial-${Date.now()}`,
      name: (req.name || '').trim(),
      shopName: (req.shopName || '').trim(),
      phone: (req.phone || '').trim(),
      city: (req.city || '').trim(),
      notes: (req.notes || '').trim(),
      status: 'pending', // 'pending' | 'activated' | 'rejected'
      createdAt: getCurrentDateFormatted(),
      timestamp: Date.now()
    };
    setTrialRequests(prev => [newReq, ...prev]);
    return newReq;
  };

  const updateTrialRequest = (id, patch) => {
    setTrialRequests(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const deleteTrialRequest = (id) => {
    setTrialRequests(prev => prev.filter(r => r.id !== id));
  };

  const visibleSettings = useMemo(() => Array.isArray(currentUser?.branchIds)
    ? { ...settings, openingCashDrawerFloat: activeBranchId === 'all'
      ? branches.reduce((sum, branch) => sum + (Number(settings?.openingCashDrawerFloatByBranch?.[branch.id]) || 0), 0)
      : Number(settings?.openingCashDrawerFloatByBranch?.[activeBranchId]) || 0 }
    : settings, [settings, activeBranchId, currentUser?.branchIds, branches]);

  return {
    persistence,
    archiveConflictingCache,
    trialRequests,
    addTrialRequest: atomicAction(addTrialRequest),
    updateTrialRequest: atomicAction(updateTrialRequest),
    deleteTrialRequest: atomicAction(deleteTrialRequest),
    tenants,
    setTenants,
    syncCloudTenants,
    syncCloudUsers,
    currentUser,
    canViewAllBranches: canAccessBranch(currentUser, 'all'),
    branches,
    activeBranchId,
    activeBranch,
    cashShifts,
    openShift: atomicAction(openShift),
    closeShift: atomicAction(closeShift),
    stockTransfers,
    changeActiveBranch: atomicAction(changeActiveBranch),
    addBranch: atomicAction(addBranch),
    updateBranch: atomicAction(updateBranch),
    deleteBranch: atomicAction(deleteBranch),
    setMainBranch: atomicAction(setMainBranch),
    transferStockBetweenBranches: financialAction(transferStockBetweenBranches),
    login,
    logout,
    unlockCashDrawer,
    changePassword,
    resetPassword,
    adminResetTenantPassword,
    createTenantAccount,
    updateTenantAccount,
    deleteTenantAccount,
    users,
    addUser,
    updateUser,
    deleteUser,
    hasPermission,
    products: visibleBranchRecords(currentUser, activeBranchId, products),
    customers: visibleBranchRecords(currentUser, activeBranchId, customers),
    invoices: visibleBranchRecords(currentUser, activeBranchId, invoices),
    expenses: visibleBranchRecords(currentUser, activeBranchId, expenses),
    expenseCategories,
    settings: visibleSettings,
    damagedItems: visibleBranchRecords(currentUser, activeBranchId, damagedItems),
    workers: visibleBranchRecords(currentUser, activeBranchId, workers),
    workerTransactions: visibleBranchRecords(currentUser, activeBranchId, workerTransactions),
    customerPayments: visibleBranchRecords(currentUser, activeBranchId, customerPayments),
    purchases: visibleBranchRecords(currentUser, activeBranchId, purchases),
    suppliers: visibleBranchRecords(currentUser, activeBranchId, suppliers),
    supplierPayments: visibleBranchRecords(currentUser, activeBranchId, supplierPayments),
    salesReturns: visibleBranchRecords(currentUser, activeBranchId, salesReturns),
    purchaseReturns: visibleBranchRecords(currentUser, activeBranchId, purchaseReturns),
    partners: visibleBranchRecords(currentUser, activeBranchId, partners),
    partnerDrawings: visibleBranchRecords(currentUser, activeBranchId, partnerDrawings),
    profitDistributions: visibleBranchRecords(currentUser, activeBranchId, profitDistributions),
    addProduct: financialAction(addProduct),
    updateProduct: financialAction(updateProduct),
    updateProductPrice: financialAction(updateProductPrice),
    deleteProduct: financialAction(deleteProduct),
    addCustomer: financialAction(addCustomer),
    updateCustomer: financialAction(updateCustomer),
    deleteCustomer: financialAction(deleteCustomer),
    recordCustomerPayment: financialAction(recordCustomerPayment),
    deleteCustomerPayment: financialAction(deleteCustomerPayment),
    saveInvoice: financialAction(saveInvoice),
    updateInvoiceNotes: financialAction(updateInvoiceNotes),
    voidInvoice: financialAction(voidInvoice),
    deleteInvoice: financialAction(deleteInvoice),
    recordSalesReturn: financialAction(recordSalesReturn),
    deleteSalesReturn: financialAction(deleteSalesReturn),
    addExpense: financialAction(addExpense),
    deleteExpense: financialAction(deleteExpense),
    addExpenseCategory: atomicAction(addExpenseCategory),
    deleteExpenseCategory: atomicAction(deleteExpenseCategory),
    addDamagedItem: financialAction(addDamagedItem),
    deleteDamagedItem: financialAction(deleteDamagedItem),
    addWorker: financialAction(addWorker),
    updateWorker: financialAction(updateWorker),
    deleteWorker: financialAction(deleteWorker),
    addWorkerTransaction: financialAction(addWorkerTransaction),
    recordWorkerTransactionWithUpdate: financialAction(recordWorkerTransactionWithUpdate),
    deleteWorkerTransaction: financialAction(deleteWorkerTransaction),
    addPurchase: financialAction(addPurchase),
    deletePurchase: financialAction(deletePurchase),
    recordPurchaseReturn: financialAction(recordPurchaseReturn),
    deletePurchaseReturn: financialAction(deletePurchaseReturn),
    addSupplier: financialAction(addSupplier),
    updateSupplier: financialAction(updateSupplier),
    deleteSupplier: financialAction(deleteSupplier),
    recordSupplierPayment: financialAction(recordSupplierPayment),
    deleteSupplierPayment: financialAction(deleteSupplierPayment),
    addPartner: financialAction(addPartner),
    updatePartner: financialAction(updatePartner),
    deletePartner: financialAction(deletePartner),
    recordPartnerDrawing: financialAction(recordPartnerDrawing),
    deletePartnerDrawing: financialAction(deletePartnerDrawing),
    recordProfitDistribution: financialAction(recordProfitDistribution),
    deleteProfitDistribution: financialAction(deleteProfitDistribution),
    getFinancialPosition, getAccountingSnapshot,
    updateSettings: atomicAction(updateSettings),
    resetToSampleData: atomicAction(resetToSampleData),
    syncStatus,
    inboundReview: local.read(INBOUND_REVIEW_KEY) || [],
    exportInboundRecoveryJSON,
    backupStatus,
    syncNow,
    syncService: cloudflareSync,
    getBackupSnapshot,
    exportBackupJSON,
    importBackupJSON: atomicAction(importBackupJSON),
  };
}
