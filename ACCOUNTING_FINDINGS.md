# ACCOUNTING FINDINGS & VULNERABILITY REGISTER

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](README.md) و[فهرس الوثائق](docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.

**Project**: Brraka POS (بركة)  
**Version**: v2.6.1  
**Audit Type**: Master Autonomous Accounting Audit & Repair  

---

## Findings Index by Severity

| ID | Phase | Category | Title | Severity | Status |
|---|---|---|---|:---:|:---:|
| ARC-01 | Phase 1 | Cross-Platform Sync | Relative `/api` endpoints break on Android/Desktop | CRITICAL | CONFIRMED |
| ARC-02 | Phase 1 | Local-First Isolation | Dual Storage Strategy & Concurrency Risks | HIGH | CONFIRMED |
| ARC-03 | Phase 1 | Event Bus & Sync Stream | `sync_events` ingestion without automatic dual-write | HIGH | CONFIRMED |
| ACC-01 | Phase 2 | Financial Math & P&L | Worker Advances & Salaries Double Deducted from Cash & Net Profit | CRITICAL | CONFIRMED |
| ACC-02 | Phase 2 | Double-Entry System | Absence of Unified Double-Entry General Ledger Engine | HIGH | CONFIRMED |
| ACC-03 | Phase 2 | Custody Management | Lack of Formal Custody (العهدة) Lifecycle (Issuance -> Expense -> Settlement) | HIGH | CONFIRMED |
| DB-01 | Phase 3 | Database Schema | Missing Relational Tables for Returns, Damaged Items, Transfers & Ledger in D1 | HIGH | CONFIRMED |
| DB-02 | Phase 3 | D1 Event Projection | Relational Tables Remain Empty Due to Missing Ingestion Projections | HIGH | CONFIRMED |
| SEC-01 | Phase 3 | Multi-Tenant Security | Missing Authorization Gate on Cloud Sync (`/api/sync/*`) & Open Tenant Listing | CRITICAL | CONFIRMED |
| CSH-01 | Phase 4 | Cash & Treasury | Absence of Persistent Shift Closing & Drawer Settlement Audit Log | HIGH | CONFIRMED |
| CSH-02 | Phase 4 | Multi-Branch Treasury | Global Cash Pooling Without Independent Branch Drawer/Safe Partitioning | HIGH | CONFIRMED |
| CUS-01 | Phase 5 | Petty Cash Custody | Absence of Operational Custody Engine (Issuance, Voucher Settlement & Return) | HIGH | CONFIRMED |
| TXN-01 | Phase 6 | Transaction Lifecycle | Hard Deletion of Invoices Violates Regulatory Audit Trail & Numbering Continuity | HIGH | CONFIRMED |
| TXN-02 | Phase 6 | Transaction Lifecycle | `deleteWorkerTransaction` Fails to Reverse Worker Advance & Leaves Orphaned Expense | CRITICAL | CONFIRMED |
| REP-01 | Phase 7 | Reports & Equity | Partner Equity Statement Excludes Initial Capital from Balance Calculation | MEDIUM | CONFIRMED |
| REP-02 | Phase 7 | Reports & P&L | Missing Unit Cost on Invoice Line Items Prevents Accrual-Based COGS Calculation | HIGH | CONFIRMED |
| USR-01 | Phase 8 | Multi-User Concurrency | Sequential Invoice Number Collisions Across Concurrent Cashier Terminals | HIGH | CONFIRMED |
| USR-02 | Phase 8 | RBAC Security | Cloudflare API Endpoints Lack Server-Side Role & Permission Enforcement | HIGH | CONFIRMED |
| SYN-01 | Phase 9 | Cloud Synchronization | Inbound Sync Events Discarded Due to Missing Ingestion Handler in `startAutoSync` | CRITICAL | CONFIRMED |
| SYN-02 | Phase 9 | Cloud Synchronization | Outbound Sync Pipeline Omits Core Financial Entities (Expenses, Purchases, Debt) | CRITICAL | CONFIRMED |
| XPL-01 | Phase 10 | Cross-Platform Topology | Hardcoded Relative Endpoints Fail on Android & Desktop WebViews | CRITICAL | CONFIRMED |
| OFF-01 | Phase 11 | Offline Queue & Resilience | Poison-Pill Deadlock in Batch Sync Queue Stalls Offline Mutations | HIGH | CONFIRMED |
| SEC-02 | Phase 12 | Credential Security | Hardcoded Master Platform Credentials in Client-Side JavaScript | HIGH | CONFIRMED |
| SEC-03 | Phase 12 | Multi-Tenant Data Isolation | Shared Device LocalStorage Keys Lack Tenant Namespace (Data Bleed) | CRITICAL | CONFIRMED |

---

## Detailed Findings Log

### PHASE 1 — ARCHITECTURE AUDIT FINDINGS

| ID | Category | Title | Severity | Impact |
|---|---|---|:---:|---|
| **ARC-01** | Cross-Platform Sync | Relative `/api` endpoints break on Android/Desktop | **CRITICAL** | `cloudflareSync.js` uses relative URLs (`/api/sync/push`, `/api/sync/pull`). On Android (Capacitor) and Desktop (Electron), this resolves to `capacitor://localhost/api/...` or `file:///api/...`, silently failing cloud sync and stranding mutations in the local offline queue. |
| **ARC-02** | Local-First Isolation | Dual Storage Strategy (In-memory + LocalStorage + D1) | **HIGH** | Local state calculations in `useAppStore` occur synchronously, while D1 synchronization is asynchronous event-based. If two cashiers in the same store create transactions offline, duplicate invoice numbers could occur if sequencing is client-only. |
| **ARC-03** | Event Bus & Sync Stream | `sync_events` table ingestion without automatic dual-write | **HIGH** | `push.js` writes events into `sync_events` table in D1, but does not immediately project those events into the relational tables (`invoices`, `customers`, etc.) on the backend unless a projection worker runs. |

### PHASE 2 — ACCOUNTING MODEL AUDIT FINDINGS

| ID | Category | Title | Severity | Impact |
|---|---|---|:---:|---|
| **ACC-01** | Financial Math & P&L | Worker Advances & Salaries Double Deducted from Cash & Net Profit | **CRITICAL** | `addWorkerTransaction` pushes to `workerTransactions` AND simultaneously calls `addExpense` without setting an `isWorkerPayment` flag. In `getFinancialPosition()`: `cashExpenses` includes the worker expense, and `cashWorkerAdvances`/`cashWorkerSalaries` ALSO includes the transaction, deducting it twice from `totalCashOutflow` and `cashBalance`. In `ReportsCenterView.jsx`: `generalExpensesAmount` + `totalSalariesPaid` subtracts salaries twice from P&L, and subtracts advances (which are balance-sheet assets/receivables) from P&L profit. When deleting a worker transaction, the linked expense is never deleted. |
| **ACC-02** | Double-Entry System | Absence of Unified Double-Entry General Ledger Engine | **HIGH** | The system currently calculates positions reactively from separate entity arrays (`invoices`, `customers`, `suppliers`, `expenses`). It lacks a formal journal entry ledger (`id, date, debit_account, credit_account, amount, reference_id, branch_id`) to mathematically guarantee $\sum \text{Debits} = \sum \text{Credits}$ across all business events. |
| **ACC-03** | Custody Management | Lack of Formal Custody (العهدة) Lifecycle (Issuance -> Expense -> Settlement) | **HIGH** | Custody is presently conflated with either opening drawer float (`settings.openingCashDrawerFloat`) or worker advances (`currentAdvance`). There is no structured lifecycle for petty cash custody (عهدة مالية): delivering funds to a custodian, attaching itemized expense receipts against the custody balance, and returning unspent funds to the central safe/treasury upon settlement. |

### PHASE 3 — DATABASE AUDIT FINDINGS

| ID | Category | Title | Severity | Impact |
|---|---|---|:---:|---|
| **DB-01** | Database Schema | Missing Relational Tables for Returns, Damaged Items, Transfers & Ledger in D1 | **HIGH** | `d1/schema.sql` and the live Cloudflare D1 instance lack tables for `sales_returns`, `purchase_returns`, `damaged_items`, `profit_distributions`, `stock_transfers`, and `journal_entries`. These entities currently exist only in client local state or unstructured JSON strings inside `sync_events`. |
| **DB-02** | D1 Event Projection | Relational Tables Remain Empty Due to Missing Ingestion Projections | **HIGH** | The remote database audit verified that `invoices` contains 0 rows while `sync_events` contains 17 rows. `functions/api/sync/push.js` stores events in an append-only log without projecting them into structured relational tables (`invoices`, `customers`, `purchases`, etc.). Direct SQL queries to relational tables yield no data. |
| **SEC-01** | Multi-Tenant Security | Missing Authorization Gate on Cloud Sync (`/api/sync/*`) & Open Tenant Listing | **CRITICAL** | Neither `/api/sync/push` nor `/api/sync/pull` enforces token authentication, session validation, or tenant signature. Any client supplying arbitrary `tenantId` can push corrupt events or pull another tenant's confidential business records. Furthermore, `GET /api/tenants` exposes all tenant accounts and store metadata without requiring super_admin credentials. |

### PHASE 4 — CASH & TREASURY AUDIT FINDINGS

| ID | Category | Title | Severity | Impact |
|---|---|---|:---:|---|
| **CSH-01** | Cash & Treasury | Absence of Persistent Shift Closing & Drawer Settlement Audit Log | **HIGH** | The cash drawer reconciliation tool in `StoreAuditView.jsx` calculates variance between theoretical expected drawer cash and physical count only as temporary in-memory state. When the page reloads or a shift ends, the count, variance (عجز / زيادة), timestamp, and cashier sign-off are lost, precluding historical shift audit trails. |
| **CSH-02** | Multi-Branch Treasury | Global Cash Pooling Without Independent Branch Drawer/Safe Partitioning | **HIGH** | `getFinancialPosition()` aggregates all cash inflows and outflows into a single global `cashBalance` across all branches. In multi-branch setups, cash in Branch BR-01 drawer cannot be audited independently from Branch BR-02, creating reconciliation confusion between branch managers. |

### PHASE 5 — CUSTODY AUDIT FINDINGS

| ID | Category | Title | Severity | Impact |
|---|---|---|:---:|---|
| **CUS-01** | Petty Cash Custody | Absence of Operational Custody Engine (Issuance, Voucher Settlement & Return) | **HIGH** | The system lacks an end-to-end Petty Cash Custody (العهد النقدية) lifecycle. Store owners cannot disburse custody funds to procurement representatives or drivers, attach expense/purchase receipts against an active custody balance, or record the return of surplus cash. Currently, such disbursements are either forced into salary advances or immediate P&L expenses, distorting accounting reports. |

### PHASE 6 — TRANSACTION & JOURNAL AUDIT FINDINGS

| ID | Category | Title | Severity | Impact |
|---|---|---|:---:|---|
| **TXN-01** | Transaction Lifecycle | Hard Deletion of Invoices Violates Regulatory Audit Trail & Numbering Continuity | **HIGH** | `deleteInvoice` permanently deletes invoices from the dataset. In fiscal accounting and electronic invoicing regulations, invoices must be immutable and sequentially numbered. Deletion leaves number gaps and destroys financial transaction history. Invoices should only be subject to voiding (`voidInvoice`) with an auditable reason or reversed via formal credit notes (sales returns). |
| **TXN-02** | Transaction Lifecycle | `deleteWorkerTransaction` Fails to Reverse Worker Advance & Leaves Orphaned Expense | **CRITICAL** | When `deleteWorkerTransaction(id)` is called, it only filters the record out of `workerTransactions`. It does NOT reverse the worker's `currentAdvance` balance (leaving the worker with an inflated or incorrect advance debt), and does NOT delete the mirrored expense record created during transaction addition in `expenses`. |

### PHASE 7 — REPORTS RECONCILIATION FINDINGS

| ID | Category | Title | Severity | Impact |
|---|---|---|:---:|---|
| **REP-01** | Reports & Equity | Partner Equity Statement Excludes Initial Capital from Balance Calculation | **MEDIUM** | In `PartnersEquityView.jsx`, `getPartnerStats()` computes `netBalance = totalEarned - totalDrawn`. The initial capital contribution (`initialCapital`) recorded during partner creation is omitted from the formula, resulting in negative or understated equity statements for partners who funded the business. |
| **REP-02** | Reports & P&L | Missing Unit Cost on Invoice Line Items Prevents Accrual-Based COGS Calculation | **HIGH** | `SaleScreen.jsx` adds items to cart and finalized invoices without snapshotting the product's unit cost (`costPerKg`). Consequently, `ReportsCenterView.jsx` approximates gross profit as total sales minus total purchases during the period. When stock is purchased in bulk, P&L reports artificial losses, whereas when sales draw from prior stock, P&L shows inflated profits. True COGS ($\sum \text{qty} \times \text{cost}$) requires preserving unit cost on invoice items. |

### PHASE 8 — MULTI-USER & RBAC AUDIT FINDINGS

| ID | Category | Title | Severity | Impact |
|---|---|---|:---:|---|
| **USR-01** | Multi-User Concurrency | Sequential Invoice Number Collisions Across Concurrent Cashier Terminals | **HIGH** | Invoice numbering is generated on the client as `settings.nextInvoiceNumber || (invoices.length + 126)`. When two cashiers ring up sales simultaneously or work offline before syncing, both devices generate the identical invoice sequence number (e.g. #000130), causing customer receipt confusion and accounting collisions upon cloud synchronization. |
| **USR-02** | RBAC Security | Cloudflare API Endpoints Lack Server-Side Role & Permission Enforcement | **HIGH** | Role-Based Access Control (`resolveUserPermissions`) is strictly evaluated on the client frontend. Backend Cloudflare Functions (`/api/users`, `/api/tenants`) accept modifications without validating caller authorization tokens or verifying admin privileges, allowing potential privilege escalation via direct API calls. |

### PHASE 9 — SYNCHRONIZATION AUDIT FINDINGS

| ID | Category | Title | Severity | Impact |
|---|---|---|:---:|---|
| **SYN-01** | Cloud Synchronization | Inbound Sync Events Discarded Due to Missing Ingestion Handler in `startAutoSync` | **CRITICAL** | In `useAppStore.js`, `startAutoSync(tenantId, 30000)` calls `pullUpdates(tenantId)` without an `onUpdatesReceived` callback. When the Edge returns events from other devices, `cloudflareSync.js` advances `LAST_SYNC_KEY` but never merges or applies the incoming entities to the store. The events are dropped, and because the timestamp is advanced, the client never retrieves them again, resulting in permanent desynchronization between cashiers and management. |
| **SYN-02** | Cloud Synchronization | Outbound Sync Pipeline Omits Core Financial Entities (Expenses, Purchases, Debt) | **CRITICAL** | Only `saveInvoice` and user management actions invoke `cloudflareSync.recordMutation()`. Crucial accounting events—including expenses, wholesale purchases, supplier payments, customer debt collections, sales returns, purchase returns, and damaged stock—are never recorded in the sync queue. Multi-device stores therefore operate with completely fragmented financial books. |

### PHASE 10 — CROSS-PLATFORM AUDIT FINDINGS

| ID | Category | Title | Severity | Impact |
|---|---|---|:---:|---|
| **XPL-01** | Cross-Platform Topology | Hardcoded Relative Endpoints Fail on Android & Desktop WebViews | **CRITICAL** | On Android (Capacitor) and Desktop (Electron), the application runs under `http://localhost` or `file://` local file schemes. All network calls using relative URIs (`/api/sync/push`, `/api/sync/pull`, `/api/tenants/lookup`) fail with 404 or unsupported protocol errors. The client becomes completely disconnected from Cloudflare Edge and D1, disabling multi-platform data synchronization unless an absolute, platform-aware API base URL resolver is used. |

### PHASE 11 — OFFLINE & RETRY AUDIT FINDINGS

| ID | Category | Title | Severity | Impact |
|---|---|---|:---:|---|
| **OFF-01** | Offline Queue & Resilience | Poison-Pill Deadlock in Batch Sync Queue Stalls Offline Mutations | **HIGH** | `cloudflareSync.flushQueue()` takes batches of 100 events and pushes them to `/api/sync/push`. If a single event fails backend validation or SQLite constraints, the entire atomic batch fails. Without individual event retry splitting or a Dead-Letter Queue (DLQ), the failing item remains at the head of the queue, locking the entire offline queue in an endless retry loop. |

### PHASE 12 — SECURITY & AUTHORIZATION AUDIT FINDINGS

| ID | Category | Title | Severity | Impact |
|---|---|---|:---:|---|
| **SEC-02** | Credential Security | Hardcoded Master Platform Credentials in Client-Side JavaScript | **HIGH** | In `useAppStore.js`, the super_admin email and plaintext password (`amerfathi123@gmail.com` / `[REDACTED: compromised legacy credential]`) are hardcoded directly into the client authentication function. Any end user inspecting the application bundle or source code can extract these credentials and gain unrestricted root ownership over all tenant accounts. |
| **SEC-03** | Multi-Tenant Data Isolation | Shared Device LocalStorage Keys Lack Tenant Namespace (Data Bleed) | **CRITICAL** | Storage keys (`khodar_pos_products_v3`, `khodar_pos_invoices_v3`, etc.) are static and global. When multiple merchants or cashiers log in sequentially on a shared workstation or tablet, the local dataset of the previous tenant remains active in state and storage, causing confidential sales, debts, and customer rosters to bleed across different merchants. |
