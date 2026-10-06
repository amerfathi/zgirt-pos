# QA SYSTEM INVENTORY — BRRAKA POS v2.6.1

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](README.md) و[فهرس الوثائق](docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.

**Generated Date**: 2026-09-20  
**Target**: Comprehensive enumeration of all UI surfaces, Backend APIs, Database Schemas, and Platform Integrations.

---

## 1. UI Surfaces & Navigation Topology

### 1.1 Primary Screens & Tabs (`App.jsx` + `DesktopSidebar.jsx` + `BottomNav.jsx`)

| Tab ID | Component | Arabic Label | Category | Required Permission | Key Interactive Features |
|---|---|---|---|---|---|
| `home` | `MobileHomeHub.jsx` | الرئيسية | Navigation | None (Public to Authed) | 3-column quick action grid, branch selector, store summary cards, quick nav links |
| `sale` | `SaleScreen.jsx` | نقطة البيع والميزان | Sales | `canSell` | Tare weight modal, quick product grid, numeric keypad, discounts, split payment (cash/card/debt), customer selector |
| `invoices` | `InvoicesHistory.jsx` | سجل الفواتير | Sales | `canViewInvoices` | Date filters, search by invoice # / customer, thermal receipt print, A4 invoice view, void invoice (`canVoidInvoices`) |
| `purchases` | `PurchasesView.jsx` | المشتريات والموردين | Inventory | `canManagePurchases` | Purchase entry modal, supplier account ledger, supplier payment recording, purchase return modal, debt tracking |
| `customers` | `CustomersView.jsx` | العملاء والديون | Sales | `canManageCustomers` | Customer profile modal, customer debt payment modal, customer statement A4 view, WhatsApp sharing, balance audit |
| `products` | `ProductsManagement.jsx` | الأصناف والأسعار | Inventory | `canManageInventory` | Add/edit product modal, wholesale buy price, retail sell price, low stock alerts, barcode/category filters |
| `damaged` | `DamagedItemsView.jsx` | التوالف والهالك | Inventory | `canManageInventory` | Record spoiled fruit/veg, weight loss valuation at cost price, damage justification notes |
| `expenses` | `ExpensesView.jsx` | المصروفات واليوميات | Operations | `canManageExpenses` | Add expense modal, category classification, payment method (cash/bank), daily total summaries |
| `workers` | `WorkersPayrollView.jsx` | الموظفون والرواتب | Operations | `canManagePayroll` | Worker profile modal, advance payment modal, monthly salary settlement voucher, worker ledger |
| `audit` | `StoreAuditView.jsx` | الجرد والسيولة ومطابقة الدرج | Finance | `canViewFinance` | Cash drawer counting reconciliation, expected cash vs actual diff, period cash/bank inflows and outflows |
| `partners` | `PartnersEquityView.jsx` | الشركاء والمسحوبات والأرباح | Finance | `canViewFinance` | Partner equity cards, profit distribution modal, cash drawings modal, initial capital ledger |
| `reports` | `ReportsCenterView.jsx` | مركز التقارير A4 الرسمية | Finance | `canViewFinance` | 6 executive cards, income statement, sales analysis, customer debt aging, supplier balances, shift closure report |
| `settings` | `SettingsView.jsx` | إعدادات وضبط النظام | Settings | `canAccessSettings` | Shop name, tax VAT settings, receipt header/footer, printer profiles (80mm/58mm/A4), font scale slider, multi-branch modal trigger, user management |

### 1.2 Interactive Modals & Dialogs

| Modal Component | Trigger Surface | Primary Functions |
|---|---|---|
| `InvoiceReceiptModal.jsx` | `SaleScreen`, `InvoicesHistory` | 80mm / 58mm thermal receipt layout, QR code rendering, thermal print trigger |
| `A4InvoiceModal.jsx` | `SaleScreen`, `InvoicesHistory`, `StoreAuditView` | Official A4 tax invoice layout, print to PDF, company header/footer |
| `SalesReturnModal.jsx` | `SaleScreen`, `InvoicesHistory` | Item quantity/weight return, refund calculation (cash/credit), stock restoration |
| `PurchaseReturnModal.jsx` | `PurchasesView` | Supplier return entry, refund method, deduction from supplier balance |
| `BranchesManagementModal.jsx` | Header, `DesktopSidebar`, `SettingsView` | Add branch, edit branch, stock transfer between branches |
| `ChangePasswordModal.jsx` | `DesktopSidebar`, `SettingsView` | Verify old password, validate minimum length, save new hash |
| `SuperAdminPortal.jsx` | `DesktopSidebar` (Super Admin Only) | Tenant management (add, edit, suspend, delete), license expiration dates |
| `WeightTallyModal.jsx` | `SaleScreen` | Multiple crate/box tare calculation, gross minus tare equals net weight |
| `UpdateNotificationModal.jsx`| App Launch | Inform user of available releases (Web/Desktop/Android), trigger update flow |
| `DesktopUpdateModal.jsx` | Electron Titlebar / Modal | Download progress bar, silent background download, execute installer and restart |
| `EmojiPickerModal.jsx` | `ProductsManagement` | Vegetable & fruit emoji selection for visual product tiles |

---

## 2. Backend Cloudflare Functions API Inventory

| Path | HTTP Method | Auth Required | Purpose | Database Entities Touched |
|---|:---:|:---:|---|---|
| `/api/health` | `GET` | No | System health, D1 connectivity check, version verification | Ping D1 SQLite |
| `/api/backup` | `POST` | Tenant Scoped | Encrypted full-store JSON snapshot backup | `tenant_backups` |
| `/api/releases/latest`| `GET` | No | Version semver check for desktop/mobile updates | Static release metadata |
| `/api/releases` | `GET` | No | Full list of published platform releases | Releases registry |
| `/api/sync/push` | `POST` | Tenant Scoped | Ingest batch mutations from offline/online POS clients | `sync_events` |
| `/api/sync/pull` | `GET` | Tenant Scoped | Retrieve mutations since client lastSyncTimestamp | `sync_events` |
| `/api/tenants` | `GET` | Super Admin | List all registered tenants / stores | `tenants` |
| `/api/tenants` | `POST` | Super Admin | Provision new tenant account | `tenants` |
| `/api/tenants` | `PATCH`| Super Admin | Update tenant status, allowed branches, expiration | `tenants` |
| `/api/tenants` | `DELETE`| Super Admin | Delete tenant and cascade drop related records | `tenants` |
| `/api/tenants/lookup`| `GET` | No | Look up tenant by username or store code for login | `tenants` |
| `/api/users` | `GET` | Tenant Scoped | List staff members and role permissions for store | `users` |
| `/api/users` | `POST` | Tenant Scoped | Create new cashier / accountant / manager user | `users` |
| `/api/users` | `PATCH`| Tenant Scoped | Update staff member roles, active status, passwords | `users` |
| `/api/users` | `DELETE`| Tenant Scoped | Delete staff member from store | `users` |
| `/api/trial-requests`| `POST` | No | Lead capture for prospective commercial subscribers | In-memory / email lead |

---

## 3. Database Schema Entities (Cloudflare D1 SQLite)

| Table Name | Primary Key | Foreign Keys | Key Constraints & Indices | Critical Fields |
|---|---|---|---|---|
| `tenants` | `id` (TEXT) | None | `UNIQUE(username)`, `store_code` | `role`, `status`, `expires_at`, `allowed_branches` |
| `branches` | `id` (TEXT) | `tenant_id` $\to$ `tenants.id` | `idx_branches_tenant` | `name`, `code`, `is_main`, `status` |
| `products` | `id` (TEXT) | `tenant_id` $\to$ `tenants.id` | `idx_products_tenant` | `buy_price`, `sell_price`, `current_stock_kg`, `is_active` |
| `branch_inventory` | `id` (TEXT) | `tenant_id`, `branch_id`, `product_id` | `UNIQUE(branch_id, product_id)` | `stock_kg`, `updated_at` |
| `customers` | `id` (TEXT) | `tenant_id` $\to$ `tenants.id` | `idx_customers_tenant` | `name`, `phone`, `balance`, `credit_limit` |
| `customer_payments`| `id` (TEXT) | `tenant_id`, `customer_id` | `idx_customer_payments_tenant` | `amount`, `payment_method`, `date` |
| `suppliers` | `id` (TEXT) | `tenant_id` $\to$ `tenants.id` | `idx_suppliers_tenant` | `name`, `phone`, `balance` |
| `supplier_payments`| `id` (TEXT) | `tenant_id`, `supplier_id` | `idx_supplier_payments_tenant` | `amount`, `payment_method`, `date` |
| `invoices` | `id` (TEXT) | `tenant_id`, `branch_id` | `idx_invoices_tenant_branch` | `invoice_number`, `subtotal`, `total`, `paid_amount`, `status` |
| `invoice_items` | `id` (TEXT) | `tenant_id`, `invoice_id` | `idx_invoice_items_lookup` | `quantity_kg`, `unit_price`, `cost_price`, `total` |
| `purchases` | `id` (TEXT) | `tenant_id`, `branch_id` | `idx_purchases_tenant` | `total_amount`, `paid_cash_amount`, `remaining_debt` |
| `expenses` | `id` (TEXT) | `tenant_id`, `branch_id` | `idx_expenses_tenant` | `amount`, `category`, `payment_method`, `is_supplier_payment` |
| `workers` | `id` (TEXT) | `tenant_id` $\to$ `tenants.id` | `idx_workers_tenant` | `name`, `monthly_salary`, `current_balance` |
| `worker_transactions`| `id` (TEXT)| `tenant_id`, `worker_id` | `idx_worker_trans_tenant` | `type`, `amount`, `payment_method`, `date` |
| `partners` | `id` (TEXT) | `tenant_id` $\to$ `tenants.id` | None | `share_percentage`, `initial_capital` |
| `partner_drawings` | `id` (TEXT) | `tenant_id`, `partner_id` | None | `amount`, `payment_method`, `date` |
| `sync_events` | `id` (TEXT) | `tenant_id` $\to$ `tenants.id` | `idx_sync_events_pull(tenant_id, server_timestamp)` | `entity_type`, `action`, `payload_json`, `server_timestamp` |
| `tenant_backups` | `id` (TEXT) | `tenant_id` $\to$ `tenants.id` | `idx_backups_tenant` | `snapshot_json`, `size_bytes`, `version` |
| `users` | `id` (TEXT) | `tenant_id` $\to$ `tenants.id` | `UNIQUE(tenant_id, username)` | `role`, `status`, `permissions_json` |

---

## 4. Platform Runtime Matrix

| Feature / Capability | Web (Pages / PWA) | Desktop (Electron Windows) | Mobile (Android Capacitor) |
|---|:---:|:---:|:---:|
| **Shell & Runtime** | Browser / Chrome / Safari / Edge | Electron 28 Node.js Runtime | Android WebView (Chromium) |
| **Window Frame** | Browser Viewport | Frameless Custom Topbar | Fullscreen Native Immersive |
| **Hardware Back Button** | Browser Back | N/A | Capacitor App Back Event Listener |
| **File Protocol / Origin** | `https://khodar-pos.pages.dev` | `file:///.../dist/index.html` | `http://localhost` |
| **API Base URL** | Relative or `https://khodar-pos.pages.dev` | Authoritative `https://khodar-pos.pages.dev` | Authoritative `https://khodar-pos.pages.dev` |
| **Storage Engine** | Browser `localStorage` | Electron Chromium `localStorage` | Android WebStorage SQLite backed |
| **Printing Support** | Browser `window.print()` | Silent Thermal Spool / System Print | System Print Intent / Bluetooth ESC/POS |
| **Auto-Update Engine** | Service Worker Cache Invalidation | In-App Silent NSIS Downloader & Installer | Google Play / In-App APK Intent |
| **Cross-Tab Sync** | `BroadcastChannel` | `BroadcastChannel` | N/A (Single Activity) |
