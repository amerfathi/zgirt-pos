# QA TEST REGISTRY — BRRAKA POS v2.6.1

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](README.md) و[فهرس الوثائق](docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.

**Registry Generation Date**: 2026-09-20  
**Authority**: Master Test Case Registry for Enterprise Accounting Certification  
**Status Legend**: `PASSED`, `FAILED`, `BLOCKED`, `NOT_APPLICABLE`, `PASSED`

---

## 1. Test Registry Index

| Test ID | Category | Feature | Platform | Target Component / API | Expected Invariant | Status |
|---|---|---|---|---|---|:---:|
| `AUTH-LOGIN-001` | Authentication | Desktop Login | Desktop | `DesktopLoginView.jsx` | Valid credentials unlock desktop POS with admin role | `PASSED` |
| `AUTH-LOGIN-002` | Authentication | Mobile Fast Login | Android/Mobile | `LoginView.jsx` | Mobile PIN / password opens responsive touch POS | `PASSED` |
| `AUTH-SESSION-003` | Authentication | Cross-Tab Session Sync | Web/Desktop | `BroadcastChannel` | Updating permissions in one tab updates active session instantly | `PASSED` |
| `AUTH-LOGOUT-004` | Authentication | Session Invalidation | All Platforms | `useAppStore.js` | Logout purges active session without leaking data to next login | `PASSED` |
| `POS-SALE-001` | Point of Sale | Cash Checkout | All Platforms | `SaleScreen.jsx` | Cash sale creates invoice, increments cash, decreases stock | `PASSED` |
| `POS-SALE-002` | Point of Sale | Credit Debt Sale | All Platforms | `SaleScreen.jsx` | Credit sale links to customer, increments customer balance | `PASSED` |
| `POS-SALE-003` | Point of Sale | Split Payment | All Platforms | `SaleScreen.jsx` | Split payment correctly divides between Cash and Bank accounts | `PASSED` |
| `POS-TARE-004` | Point of Sale | Weight Tare Calculation | All Platforms | `WeightTallyModal.jsx` | Gross weight minus (crates $\times$ tarePerCrate) = Net Weight | `PASSED` |
| `POS-COGS-005` | Point of Sale | Historical COGS Locking | All Platforms | `SaleScreen.jsx` | Line item locks `costPerKg` at checkout; immune to catalog changes | `PASSED` |
| `INV-VOID-001` | Invoices | Void Invoice & Rollback | All Platforms | `InvoicesHistory.jsx` | Voiding invoice reverses cash, resets customer debt, restores stock | `PASSED` |
| `INV-PRINT-002` | Invoices | Thermal 80mm / 58mm | Desktop/Web | `InvoiceReceiptModal.jsx` | Formats receipt with QR code, items, net weight, tax | `PASSED` |
| `PUR-ENTRY-001` | Purchases | Wholesale Purchase Entry| All Platforms | `PurchasesView.jsx` | Increments inventory stock, creates supplier debt if credit | `PASSED` |
| `PUR-PAY-002` | Purchases | Supplier Debt Settlement | All Platforms | `PurchasesView.jsx` | Cash payment reduces cash drawer and supplier payable balance | `PASSED` |
| `PUR-RET-003` | Purchases | Supplier Purchase Return| All Platforms | `PurchaseReturnModal.jsx`| Returns stock to supplier, deducts from supplier debt | `PASSED` |
| `CUST-PAY-001` | Customers | Customer Debt Collection| All Platforms | `CustomersView.jsx` | Inflow increases cash drawer, reduces customer A/R balance | `PASSED` |
| `CUST-STMT-002` | Customers | Account Statement A4 | All Platforms | `ReportsCenterView.jsx` | Debits minus Credits = Authoritative ending balance | `PASSED` |
| `DMG-LOSS-001` | Inventory | Spoiled Goods Valuation | All Platforms | `DamagedItemsView.jsx` | Loss recorded at cost price, decreases inventory valuation | `PASSED` |
| `CSH-RECON-001` | Cash Treasury | Drawer Float & End-of-Day| All Platforms | `StoreAuditView.jsx` | Opening Cash + Inflows - Outflows = Expected Cash | `PASSED` |
| `WRK-ADV-001` | Workers Payroll | Worker Advance Asset | All Platforms | `WorkersPayrollView.jsx`| Advance is Balance Sheet Asset, NOT P&L operating expense | `PASSED` |
| `WRK-SAL-002` | Workers Payroll | Salary Settlement | All Platforms | `WorkersPayrollView.jsx`| Deducts advance, pays net cash, single cash deduction | `PASSED` |
| `WRK-REV-003` | Workers Payroll | Voucher Reversal | All Platforms | `WorkersPayrollView.jsx`| Deleting worker transaction reverses advance balance atomically | `PASSED` |
| `EQT-PART-001` | Partners Equity | Total Equity Formula | All Platforms | `PartnersEquityView.jsx` | Equity = Initial Capital + Share of Net Profit - Drawings | `PASSED` |
| `REP-INC-001` | Reports Center | Income Statement P&L | All Platforms | `ReportsCenterView.jsx` | Net Revenue - COGS - Expenses - Salaries - Losses = Net Profit | `PASSED` |
| `REP-SFT-002` | Reports Center | Shift Cash Reconciliation| All Platforms | `ReportsCenterView.jsx` | Drawer Cash = Sales Cash + Collections - Expenses - Advances | `PASSED` |
| `SEC-TENANT-001`| Security | Multi-Tenant API Gate | Edge Backend | `/api/sync/pull` | Tenant A cannot pull Tenant B events via IDOR | `PASSED` |
| `SEC-USERS-002` | Security | Users API Tenant Boundary| Edge Backend | `/api/users` | Cannot create, patch, or delete users for another tenant | `PASSED` |
| `SEC-RBAC-003` | Security | Role Permission Guards | All Platforms | `DesktopSidebar.jsx` | Cashier blocked from viewing Financial Reports or Settings | `PASSED` |
| `SYNC-PUSH-001` | Synchronization | Outbound Mutation Sync | All Platforms | `/api/sync/push` | All 8 mutation entities pushed to D1 `sync_events` | `PASSED` |
| `SYNC-PULL-002` | Synchronization | Inbound Ingestion Loop | All Platforms | `/api/sync/pull` | Local store ingests remote events with deduplication | `PASSED` |
| `SYNC-OFF-003` | Synchronization | Offline Queuing & Flush | All Platforms | `cloudflareSync.js` | Mutations queue locally offline and auto-flush on reconnect | `PASSED` |
| `XPL-BASE-001` | Cross-Platform | API Base URL Resolver | Android / Desktop | `appVersion.js` | Points to production edge `khodar-pos.pages.dev` | `PASSED` |
| `XPL-BACK-002` | Cross-Platform | Android Hardware Back | Android Capacitor | `App.jsx` | Closes modals first, navigates to home, then exits app | `PASSED` |
| `PERF-D1-001` | Performance | D1 Latency Benchmark | Edge Backend | Cloudflare D1 | Remote SQL queries complete in under 50ms | `PASSED` |
| `PERF-BLD-002` | Performance | Production Bundle Size | Web / Desktop | `npm run build` | Zero syntax errors, clean chunking | `PASSED` |
