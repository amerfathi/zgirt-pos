# ZGIRT vs Brraka — Comprehensive Gap Audit

**Date:** 2026-10-06  
**Context:** Reality check contrasting the complete, battle-tested Brraka platform against the initial lightweight ZGIRT prototype.

---

## 1. Quantitative Discrepancy Overview

| Dimension | Brraka (`khodar-pos`) | Initial ZGIRT Prototype | Evaluation / Gap |
| :--- | :--- | :--- | :--- |
| **Frontend Components / Views** | **47** full components & modals | **1** monolithic demo file (`App.jsx`) | **-46 components missing** |
| **Business / Domain Services** | **36** services (69KB atomicStore, cash shifts, sync) | **5** small utility files | **-31 services missing** |
| **Backend API Endpoints** | **39** full Cloudflare Functions endpoints | **1** Worker file with 6 basic endpoints | **-33 endpoints missing** |
| **Database Migrations** | **30** production migrations (cash proofs, conflict reviews, auth) | **1** initial migration | **-29 migrations / schemas missing** |
| **Automated Tests** | **68** integration, security, and QA test suites | **3** basic test files | **-65 test suites missing** |

---

## 2. Detailed Breakdown of Missing Brraka Systems in Previous ZGIRT

### A. Authentication, Users & Platform Administration
- **Brraka implements:**
  - `SuperAdminPortal.jsx`: SaaS multi-tenant owner portal, subscription management, trial requests approval.
  - `ChangePasswordModal.jsx`, `ForgotPasswordModal.jsx`: Secure password rotation and recovery tokens.
  - `DesktopLoginView.jsx`: Offline-capable desktop authentication, remembered credentials, secure session caching.
  - Granular RBAC: presets (`ROLE_PERMISSIONS_PRESETS`), user branch-assignment (`branch_ids_json`), permission override matrices.
- **Previous ZGIRT lacked:** All of the above. It only had a mock single-user switch without password resets, trial workflows, or desktop login views.

### B. POS, Invoicing & Returns Workflows
- **Brraka implements:**
  - `SaleScreen.jsx`: Fast keyboard navigation, quick search, dynamic weight/unit calculations, barcode scanning, discount limits.
  - `SalesReturnModal.jsx`: Authoritative sales returns, stock replenishment, refund reconciliation.
  - `PurchaseReturnModal.jsx`: Supplier purchase returns, debit adjustment, inventory removal.
  - `InvoicesHistory.jsx`: Searchable ledger of all historical sales, reprint receipt, reprint A4, invoice voiding with permission check.
  - `InvoiceReceiptModal.jsx`, `A4InvoiceModal.jsx`: Full thermal receipt rendering & ESC/POS printer support, plus official A4 invoice prints.
  - `DamagedItemsView.jsx`: Stock wastage / damaged items tracking with financial write-offs.
  - `WeightTallyModal.jsx`: Unit count tallies.
- **Previous ZGIRT lacked:** Real return workflows, A4/Thermal printing templates, voiding engines, damage tracking, and historical invoice search.

### C. Purchasing, Suppliers & Customer Ledgers
- **Brraka implements:**
  - `PurchasesView.jsx`: Full vendor procurement, cost updates, supplier credit balances.
  - `SuppliersLedgerView.jsx`: Comprehensive supplier statement of accounts, payment vouchers, transaction history.
  - `CustomersView.jsx`: Customer credit limits, payment receipts, statement generation.
- **Previous ZGIRT lacked:** Dedicated supplier ledger view, purchase invoice workflows, and customer statement views.

### D. Treasury, Cash Shifts & Payroll
- **Brraka implements:**
  - `cashDrawerJournal.js`, `cashShiftEngine.js`, `cashMovement.js`: Multi-device signed proofs, cash drawer writer scoping, offline grant tokens.
  - `WorkersPayrollView.jsx`: Staff management, salary calculation, salary advances, deductions, wage disbursement vouchers.
  - `PartnersEquityView.jsx`: Partner capital accounts, profit distribution, partner drawings.
  - `ExpensesView.jsx`: Categorized expense records, receipt notes, branch attribution.
- **Previous ZGIRT lacked:** Payroll system, Partner equity, signed drawer proofs, offline shift grants.

### E. Advanced Causal Sync & Offline Engine
- **Brraka implements:**
  - `sync_events_v2`, `sync_conflict_heads`, `sync_review_resolutions`: Causal conflict review portal (`ConflictReviewPanel.jsx`), interactive merge conflict review, commit grouping (`groupId`), immutable retry safety.
  - `atomicStore.js` (69 KB): Battle-tested state manager handling offline queues, optimistic application, and causal rollback.
- **Previous ZGIRT lacked:** Interactive conflict review, commit groups, and durable offline store.

### F. Desktop & Mobile Integrations
- **Brraka implements:**
  - `electron/main.cjs`, `update-installer.cjs`, `update-security.cjs`, `Braka.UpdateHelper.exe`: Native Windows installer (NSIS), cryptographic update verification, frameless title bar, direct ESC/POS hardware printing.
  - `android/`: Production Capacitor build with deep Android manifest configuration and safe-area adaptations.
  - `DesktopUpdateModal.jsx`, `UpdateNotificationModal.jsx`: Live in-app update notifications.
- **Previous ZGIRT lacked:** Complete Electron packaging, update verification helper, and Capacitor Android project structure.

---

## 3. Mandatory Corrective Action

1. **Adopt Brraka as the Baseline Codebase:** Clone/copy the complete Brraka source tree into `zgirt`.
2. **Purge Brraka Secrets & Git Identity:** Ensure zero remotes, secrets, or IDs point to Brraka.
3. **Isolate and Rebrand to ZGIRT:** Systematic rebranding across desktop, web, android, and database bindings.
4. **Transform Domain to Tobacco:**
   - Replace produce weight (`stock_kg`) with tobacco packaging hierarchy: Carton $\rightarrow$ Pack $\rightarrow$ Piece.
   - Upgrade POS to high-speed cigarette barcode scanning with instant pack/carton toggle.
   - Expand wholesale engine with carton pricing, customer-specific price books, and credit limits.
5. **Verify Full Parity:** Run Brraka's 68 test suites ported to ZGIRT, proving zero capability loss.
