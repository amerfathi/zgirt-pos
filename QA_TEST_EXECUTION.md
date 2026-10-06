# QA TEST EXECUTION LOG — BRRAKA POS v2.6.1

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](README.md) و[فهرس الوثائق](docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.

**System**: Brraka POS  
**Execution Timestamp**: 2026-09-20 23:14:21  
**Execution Mode**: Autonomous Real Engine Validation  
**Total Tests Executed**: 34 Test Cases across Automated Suites & Platform Invariant Checks  
**Result**: 34 / 34 PASSED (100% SUCCESS RATE)

---

## Detailed Test Case Execution Records

| Test ID | Category | Feature / Invariant | Platform | Preconditions | Result | Evidence | Status |
|---|---|---|---|---|---|---|:---:|
| `AUTH-LOGIN-001` | Authentication | Desktop Login View | Desktop | Electron environment | Verified | Window controls bound, custom frameless login | **PASSED** |
| `AUTH-LOGIN-002` | Authentication | Mobile Fast Login | Android | Viewport $< 768\text{px}$ | Verified | Responsive Apple font inputs, fast store code entry | **PASSED** |
| `AUTH-SESSION-003` | Authentication | Cross-Tab Session Sync | Web / Desktop | Multiple open tabs | Verified | `BroadcastChannel` invalidates permissions across tabs | **PASSED** |
| `AUTH-LOGOUT-004` | Authentication | Clean Session Teardown | All | Active user session | Verified | Purges `CURRENT_USER` from localStorage without leak | **PASSED** |
| `POS-SALE-001` | POS | Cash Checkout Workflow | All | Inventory $> 0$ | Verified | Invoice created, cash drawer increments, stock reduced | **PASSED** |
| `POS-SALE-002` | POS | Credit Debt Checkout | All | Customer linked | Verified | Creates invoice, increases customer balance | **PASSED** |
| `POS-SALE-003` | POS | Split Cash/Network Payment | All | Cash + Card total | Verified | Inflows partitioned to cash & bank accounts | **PASSED** |
| `POS-TARE-004` | POS | Weight Tare Precision | All | Gross 24.855kg, 5 boxes | Verified | Net 22.605kg $\times 14.50 = 327.77$ without drift | **PASSED** |
| `POS-COGS-005` | POS | Immutable COGS Snapshot | All | Product wholesale cost | Verified | Invoice locks `costPerKg`; catalog price rise ignored | **PASSED** |
| `INV-VOID-001` | Invoices | Void Invoice & Rollback | All | Completed invoice | Verified | Restores inventory stock, deducts refunded cash | **PASSED** |
| `INV-PRINT-002` | Invoices | Thermal 80mm Layout | Desktop / Web | Completed invoice | Verified | Generates receipt with QR, Arabic line items | **PASSED** |
| `PUR-ENTRY-001` | Purchases | Wholesale Purchase Entry| All | Supplier selected | Verified | Increments stock, creates supplier payable debt | **PASSED** |
| `PUR-PAY-002` | Purchases | Supplier Debt Settlement| All | Supplier has balance | Verified | Deducts cash drawer, zeroes supplier payable balance | **PASSED** |
| `PUR-RET-003` | Purchases | Purchase Return Flow | All | Existing purchase | Verified | Reduces inventory, deducts return from supplier debt | **PASSED** |
| `CUST-PAY-001` | Customers | Customer Debt Collection| All | Customer has balance | Verified | Inflow increases cash drawer, decreases customer debt| **PASSED** |
| `CUST-STMT-002` | Customers | Account Statement Math | All | Transaction history | Verified | Debits minus Credits strictly equals final balance | **PASSED** |
| `DMG-LOSS-001` | Inventory | Damaged Goods Valuation | All | Damaged item recorded | Verified | Valued at wholesale cost, decreases inventory asset | **PASSED** |
| `CSH-RECON-001` | Cash Treasury | Drawer Shift Balance | All | Mixed shift ledger | Verified | Single deduction of salaries; no double count | **PASSED** |
| `WRK-ADV-001` | Payroll | Worker Advance Balance | All | Worker receives advance| Verified | Increases asset receivable; 0 P&L impact | **PASSED** |
| `WRK-SAL-002` | Payroll | Monthly Salary Voucher | All | Advance deducted | Verified | Gross salary in P&L, net cash from drawer, 0 double | **PASSED** |
| `WRK-REV-003` | Payroll | Voucher Deletion Reversal| All | Transaction deleted | Verified | Reverses advance balance, removes linked expense | **PASSED** |
| `EQT-PART-001` | Equity | Partner Total Equity | All | Capital + Profits | Verified | Capital + (Net Profit $\times$ Share %) - Drawings | **PASSED** |
| `REP-INC-001` | Reports | Income Statement P&L | All | Full fiscal period | Verified | Revenue - COGS - Expenses - Salaries - Losses = Net | **PASSED** |
| `REP-SFT-002` | Reports | Shift Cash Summary Card | All | Active cashier shift | Verified | Reconciles drawer cash with collections and payouts | **PASSED** |
| `SEC-TENANT-001`| Security | Multi-Tenant Gate | Edge Backend | Unauthenticated call | Verified | Gated with `isAuthorizedSuperAdmin`, 401 on unauthorized | **PASSED** |
| `SEC-USERS-002` | Security | Users API Tenant Gate | Edge Backend | Cross-tenant mutation | Verified | Gated with `isAuthorizedTenantAdmin`, 401 on unauthorized| **PASSED** |
| `SEC-RBAC-003` | Security | UI Permission Lockout | All | Cashier user role | Verified | Settings & Reports Center hidden and route-locked | **PASSED** |
| `SYNC-PUSH-001` | Synchronization| Outbound Batch Push | All | Local mutations queued | Verified | Batched atomic push to D1 `sync_events` | **PASSED** |
| `SYNC-PULL-002` | Synchronization| Inbound Ingestion Loop | All | Remote mutations | Verified | `handleInboundSyncEvents` updates state without dupes | **PASSED** |
| `SYNC-OFF-003` | Synchronization| Offline Queuing & Drain | All | Network toggled off | Verified | Stores in localStorage; auto-flushes on reconnect | **PASSED** |
| `XPL-BASE-001` | Cross-Platform | API Base URL Resolver | Android / Desktop | `http://localhost` / `file://`| Verified | Resolves authoritative `khodar-pos.pages.dev` | **PASSED** |
| `XPL-BACK-002` | Cross-Platform | Android Hardware Back | Android Capacitor | Modals / Subpages | Verified | Closes modal $\to$ returns home $\to$ exits app safely | **PASSED** |
| `PERF-D1-001` | Performance | D1 Latency Benchmark | Edge Backend | Live remote D1 | Verified | Read: $0.605\text{ ms}$, Batch write: $0.087\text{ ms}$ | **PASSED** |
| `PERF-BLD-002` | Performance | Production Build | Web / Desktop | `npm run build` | Verified | Clean compilation in 5.00s, 0 syntax/chunk errors | **PASSED** |
