# ACCOUNTING REPAIRS & CODE FIXES REGISTER

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](README.md) و[فهرس الوثائق](docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.

**Project**: Brraka POS (بركة - كاشير ومحاسبة)  
**Version**: v2.6.1  
**Timestamp**: 2026-09-20  
**Status**: REPAIR PHASE COMPLETED (PASSED)

---

## Applied Repairs Log

| Repair ID | Target Files | Finding ID | Description | Resolution Status |
|---|---|---|---|:---:|
| **FIX-01** | `src/store/useAppStore.js`, `src/components/ReportsCenterView.jsx`, `src/components/StoreAuditView.jsx` | **ACC-01** | **Elimination of Worker Advances & Salaries Double Deduction**: Advances are now classified purely as Employee Receivables (Balance Sheet Asset) rather than operating expenses. Salary payouts are tagged with `isWorkerPayment: true` and excluded from `getFinancialPosition()` generic cash/bank expense summing, preventing salaries and advances from deducting twice. | **VERIFIED & PASSED** |
| **FIX-02** | `src/store/useAppStore.js` | **TXN-02** | **Surgical Worker Transaction Reversal**: `deleteWorkerTransaction` now dynamically decrements `currentAdvance` when an advance is deleted, or reinstates `currentAdvance` if a deducted advance in a salary voucher is deleted, while atomically deleting the linked operational expense. | **VERIFIED & PASSED** |
| **FIX-03** | `src/components/PartnersEquityView.jsx` | **REP-01** | **Partner Equity Initial Capital Formula Reconciliation**: Total Equity calculation in `getPartnerStats` now strictly computes $\text{Total Equity} = \text{Initial Capital} + \text{Share of Retained Profit} - \text{Total Drawings}$. | **VERIFIED & PASSED** |
| **FIX-04** | `src/components/SaleScreen.jsx` | **REP-02** | **Historical COGS Cost Locking in Invoices**: Injected `costPerKg` snapshot into each invoice item upon checkout. Eliminates distortion of historical profit margins when wholesale purchase prices fluctuate. | **VERIFIED & PASSED** |
| **FIX-05** | `src/config/appVersion.js`, `src/services/cloudflareSync.js` | **XPL-01** | **Cross-Platform Authoritative API Base URL**: Implemented `getApiBaseUrl()` resolving `https://khodar-pos.pages.dev` whenever running inside Android WebView (`http://localhost`) or Desktop Electron (`file://`). Replaced all relative `/api/*` endpoints. | **VERIFIED & PASSED** |
| **FIX-06** | `src/services/cloudflareSync.js`, `src/store/useAppStore.js` | **SYN-01** | **Inbound Sync Ingestion Engine**: Wired `updateHandler` callback inside `cloudflareSync.startAutoSync()`. Added `handleInboundSyncEvents` in `useAppStore` to ingest remote mutations into local React state with deduplication. | **VERIFIED & PASSED** |
| **FIX-07** | `src/store/useAppStore.js` | **SYN-02** | **Complete Outbound Sync Entity Coverage**: Added `cloudflareSync.recordMutation` triggers for all previously missing accounting mutations: customer payments, expenses, damaged items, supplier payments, purchases, sales returns, purchase returns, and voided invoices. | **VERIFIED & PASSED** |

---

## Detailed Code Adjustments & Mechanics

### 1. FIX-01 (ACC-01) — Worker Advance vs Salary Ledger Correction
- **File**: `src/store/useAppStore.js`
- **Mechanism**:
  ```javascript
  // Advances: update worker balance only (Asset), DO NOT push to expenses
  if (transaction.type === 'advance') {
    return { ...w, currentAdvance: (w.currentAdvance || 0) + amount };
  }
  // Salaries: push to expenses with isolation flag
  if (transaction.type === 'salary_payment') {
    addExpense({
      id: `exp-${newTx.id}`,
      title: `صرف راتب: ${transaction.workerName || 'عامل'}`,
      category: 'رواتب وعمالة',
      amount: amount,
      paymentMethod: paymentMethod,
      isWorkerPayment: true,
      workerTransactionId: newTx.id
    });
  }
  ```
- **Cash Position Protection**:
  ```javascript
  // src/store/useAppStore.js -> getFinancialPosition()
  const cashExpenses = expenses
    .filter(e => e.paymentMethod !== 'bank' && !e.isSupplierPayment && !e.isWorkerPayment)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  ```

### 2. FIX-02 (TXN-02) — Atomic Worker Transaction Deletion Reversal
- **File**: `src/store/useAppStore.js`
- **Mechanism**:
  When a transaction is deleted, `target.type === 'advance'` reverses advance balance: `currentAdvance = Math.max(0, currentAdvance - amount)`. When `salary_payment` is deleted, any advance that was deducted is credited back to `currentAdvance`. Linked expenses in the `expenses` array are purged cleanly.

### 3. FIX-03 (REP-01) — Partner Equity Structural Invariant
- **File**: `src/components/PartnersEquityView.jsx`
- **Mechanism**:
  ```javascript
  const capital = Number(p.initialCapital) || 0;
  const totalEarned = (netProfit * p.equityPercent) / 100;
  const totalDrawn = drawings.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  stats.totalEquity = capital + totalEarned - totalDrawn;
  ```

### 4. FIX-04 (REP-02) — Product Cost Freezing on Sale
- **File**: `src/components/SaleScreen.jsx`
- **Mechanism**:
  ```javascript
  costPerKg: matchingProduct ? (Number(matchingProduct.costPerKg) || 0) : (Number(activeItem.costPerKg) || 0)
  ```
  Every invoice line item now carries an immutable `costPerKg` at creation.

### 5. FIX-05 (XPL-01) — Cross-Platform Base URL Bridge
- **Files**: `src/config/appVersion.js`, `src/services/cloudflareSync.js`
- **Mechanism**:
  Checks `window.location.origin`. If localhost or file protocol, defaults securely to `https://khodar-pos.pages.dev`.

### 6. FIX-06 & FIX-07 (SYN-01 & SYN-02) — Bidirectional D1 Synchronization Loop
- **Files**: `src/services/cloudflareSync.js`, `src/store/useAppStore.js`
- **Mechanism**:
  - `startAutoSync` now accepts `onUpdatesReceived` callback.
  - `handleInboundSyncEvents` maps incoming D1 event types (`invoice`, `expense`, `payment`, `purchase`, `supplier_payment`, `worker_transaction`) into local Zustand/React store.
  - All write actions in `useAppStore` emit `cloudflareSync.recordMutation()`.
