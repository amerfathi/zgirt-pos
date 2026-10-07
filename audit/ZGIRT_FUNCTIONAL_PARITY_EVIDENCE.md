# ZGIRT Functional Parity & Evidence Index

**Baseline:** 100% of Brraka mature business workflows, accounting rules, and platform logic.

---

## 1. Verified Executable Capabilities

### A. Core Point of Sale & Invoicing
- **Sale Checkout & COGS:** Verified in `tests/accounting_audit_test.cjs` & `tests/comprehensive_qa_suite.cjs` (Test `POS-E2E-001`). Stock decrements, invoice items lock purchase cost at creation time, and cash ledger updates deterministically.
- **Invoice Voiding & Returns:** Verified in `tests/comprehensive_qa_suite.cjs` (Test `INV-VOID-001`). Completed invoices void cleanly, restoring inventory and adjusting customer or cash balances.
- **Physical Printing:** Thermal (80mm / 58mm) and A4 invoice formats verified in `tests/physical-invoice-print.cjs`.

### B. Accounting, Ledgers & Precision
- **Integer Cents & Floating-Point Protection:** Tested in `tests/comprehensive_qa_suite.cjs` (Test `PREC-001`). Eliminates cumulative floating-point errors (`0.1 + 0.2`).
- **Customer Receivables (AR):** Tested in `tests/comprehensive_qa_suite.cjs` (Test `CUST-AR-001`). Credit sales increment customer balance; partial collections reduce it.
- **Supplier Payables (AP):** Tested in `tests/comprehensive_qa_suite.cjs` (Test `SUPP-AP-001`). Credit purchases increment payables; cash payments settle them.
- **Worker Payroll & Advances:** Tested in `tests/accounting_audit_test.cjs` (Tests 1, 2, 3). Worker advances are asset receivables that do NOT affect P&L; salary disbursements deduct from P&L and cash accurately.
- **Partner Equity:** Tested in `tests/accounting_audit_test.cjs` (Test 4). Formula: `Equity = Capital + (Net Profit * share %) - Drawings`.

### C. Causal Synchronization & Offline Engine
- **Precondition Vectors:** Tested in `tests/sync-durable.test.mjs` (26 test suites passed). Preconditions detect concurrent offline edits and prevent silent overwrite.
- **Idempotency & Replays:** Duplicate mutation execution leaves database and local cache in identical deterministic states (`IDEMP-001`).
- **Owner Conflict Review:** Interactive resolution portal (`ConflictReviewPanel.jsx`) allows the business owner to review and resolve concurrent edits.

### D. Multi-Branch & Tenant Isolation
- **Tenant Isolation:** Tested in `tests/branch-isolation.test.mjs`. Queries strictly bound to authenticated `tenant_id`. Database triggers enforce branch limits per subscription tier.
- **Role-Based Access Control (RBAC):** Verified in `tests/security_regression.cjs`. Granular permission presets enforce role separation between Admin, Manager, Cashier, and Auditor.

### E. Tobacco Retail & Wholesale Adaptation
- **Packaging Hierarchy:** Cartons (كرتونة) $\rightarrow$ Packs (علبة) $\rightarrow$ Pieces (سجارة).
- **Dual-Mode POS:** Retail single-pack and wholesale carton price tiers.
- **Unit Normalization:** Automatic conversion of carton sales into base inventory counts without data corruption.
