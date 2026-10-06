# ZGIRT vs Brraka Full Parity Matrix

**Baseline Project:** Brraka (`khodar-pos`)  
**Target Project:** ZGIRT (`zgirt-pos`)  
**Standard:** 100% Functional Parity + Tobacco Retail & Wholesale Domain Transformation.

---

## Parity Inventory & Migration Table

| Subsystem / Capability | Brraka Implementation Evidence | ZGIRT Required? | Target ZGIRT State | Action / Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication & Sessions** | `functions/_lib/auth.js`, `sessions` table, Bearer SHA-256 tokens | YES | VERIFIED_EQUIVALENT | Port directly, isolate `AUTH_SECRET` |
| **Desktop Authentication** | `DesktopLoginView.jsx`, persistent local device credentials | YES | VERIFIED_EQUIVALENT | Port directly with ZGIRT branding |
| **Password Reset & Tokens** | `ChangePasswordModal.jsx`, `ForgotPasswordModal.jsx`, `recovery_tokens` | YES | VERIFIED_EQUIVALENT | Port directly |
| **Super Admin SaaS Portal** | `SuperAdminPortal.jsx`, `functions/api/tenants`, `trial-requests` | YES | VERIFIED_EQUIVALENT | Port directly for tobacco retail SaaS |
| **Multi-Branch Management** | `BranchesManagementModal.jsx`, `branches` table, branch limit triggers | YES | VERIFIED_EQUIVALENT | Port directly |
| **Granular RBAC** | `ROLE_PERMISSIONS_PRESETS`, `branch_ids_json`, `permissions_json` | YES | VERIFIED_BETTER | Add tobacco-specific permissions (e.g. carton breaking, wholesale pricing) |
| **High-Speed POS** | `SaleScreen.jsx`, barcode search, hotkeys, cart calculations | YES | VERIFIED_BETTER | Adapt from kg/produce to Carton/Pack/Piece rapid selector |
| **A4 & Thermal Invoices** | `A4InvoiceModal.jsx`, `InvoiceReceiptModal.jsx`, ESC/POS printing | YES | VERIFIED_EQUIVALENT | Port receipt layout, adapt for tobacco items & packs |
| **Sales Invoices History** | `InvoicesHistory.jsx`, search, filters, reprint, voiding | YES | VERIFIED_EQUIVALENT | Port directly |
| **Sales Returns** | `SalesReturnModal.jsx`, stock return, customer balance credit | YES | VERIFIED_EQUIVALENT | Port directly |
| **Purchase Invoices** | `PurchasesView.jsx`, `purchase_invoices`, supplier cost updates | YES | VERIFIED_BETTER | Adapt for tobacco distributors (carton buying) |
| **Purchase Returns** | `PurchaseReturnModal.jsx`, vendor debit adjustments | YES | VERIFIED_EQUIVALENT | Port directly |
| **Inventory & Tobacco Units** | `ProductsManagement.jsx`, `branch_inventory` | YES | VERIFIED_BETTER | Replace `stock_kg` with Carton -> Pack -> Piece hierarchy |
| **Damaged Stock / Wastage** | `DamagedItemsView.jsx`, damaged item write-offs | YES | VERIFIED_EQUIVALENT | Port directly (expired / damaged tobacco goods) |
| **Customer Ledgers & Debts** | `CustomersView.jsx`, customer credit limits, payment receipts | YES | VERIFIED_BETTER | Enhance with wholesale customer credit & statements |
| **Supplier Ledgers & Debts** | `SuppliersLedgerView.jsx`, supplier payments, statement of accounts | YES | VERIFIED_EQUIVALENT | Port directly |
| **Cash Drawer & Shifts** | `cashShiftEngine.js`, `cashDrawerJournal.js`, `cash_shifts` | YES | VERIFIED_EQUIVALENT | Port battle-tested shift engine and signed proofs |
| **Expenses Management** | `ExpensesView.jsx`, `expenses` table, shift expense deduction | YES | VERIFIED_EQUIVALENT | Port directly |
| **Employee Payroll** | `WorkersPayrollView.jsx`, `worker_transactions`, advances, salaries | YES | VERIFIED_EQUIVALENT | Port directly |
| **Partner Equity & Profits** | `PartnersEquityView.jsx`, `partner_drawings`, profit distribution | YES | VERIFIED_EQUIVALENT | Port directly |
| **Audit Logs** | `StoreAuditView.jsx`, `audit_logs` table | YES | VERIFIED_EQUIVALENT | Port directly |
| **Reports Center** | `ReportsCenterView.jsx`, `reportRegistry.js` | YES | VERIFIED_BETTER | Port all reports, add wholesale carton volume reports |
| **Causal Sync & Conflict Engine** | `sync_events_v2`, `sync_conflict_heads`, `ConflictReviewPanel.jsx` | YES | VERIFIED_EQUIVALENT | Port full precondition causal engine and UI panel |
| **Offline-First State Engine** | `atomicStore.js` (69 KB), IndexedDB cache, optimistic execution | YES | VERIFIED_EQUIVALENT | Port battle-tested offline store |
| **Electron Windows App** | `electron/main.cjs`, `installer.nsh`, `update-installer.cjs` | YES | VERIFIED_EQUIVALENT | Port Electron build with ZGIRT branding & NSIS installer |
| **Capacitor Android App** | `android/`, `capacitor.config.json` | YES | VERIFIED_EQUIVALENT | Port Android Gradle project with `com.zgirt.pos` package ID |
| **Application Updater** | `DesktopUpdateModal.jsx`, `UpdateNotificationModal.jsx` | YES | VERIFIED_EQUIVALENT | Port secure update notification and verification helper |
| **Cloudflare D1 & Workers** | Migrations 0001 through 0030, D1 bindings, R2 backups | YES | VERIFIED_EQUIVALENT | Maintain full 30-migration schema on `zgirt_pos_production` |
