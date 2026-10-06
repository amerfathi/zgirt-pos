# QA ACCOUNTING & FINANCIAL RECONCILIATION — BRRAKA POS v2.6.1

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](README.md) و[فهرس الوثائق](docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.

**System**: Brraka POS (بركة - كاشير ومحاسبة سحابية)  
**Standard**: Strict Double-Entry Balance Sheet Invariant: $\Delta\text{Assets} = \Delta\text{Liabilities} + \Delta\text{Equity}$  
**Timestamp**: 2026-09-20  

---

## 1. Authoritative Accounting Model

Brraka POS employs a hybrid point-of-sale and merchant inventory ledger model:
1. **Cash Drawer / Vault Assets**: Real-time tracked in `StoreAuditView` and `ReportsCenterView`.
2. **Accounts Receivable (A/R)**: Customer credit debts tracked in `customers.balance` and `customerPayments`.
3. **Accounts Payable (A/P)**: Wholesale supplier debts tracked in `suppliers.balance` and `supplierPayments`.
4. **Inventory Asset (COGS)**: Physical stock kg valued at wholesale buy cost `costPerKg`.
5. **Employee Receivables Asset**: Worker advances (`worker_transactions.type === 'advance'`), strictly distinguished from operating payroll expenses.
6. **Operating Profit & Loss (P&L)**: Real-time Net Sales minus COGS minus Operating Expenses minus Gross Salaries minus Spoilage Losses.
7. **Partner Equity**: Cumulative Capital Contributions plus Retained Profit minus Cumulative Drawings.

---

## 2. Mathematical Invariant Verification Matrix

| Workflow | Source Entity | Asset Effect | Liability Effect | Equity Effect | Status |
|---|---|---|---|---|:---:|
| **Cash Sale** | `invoices` | $+\text{Cash}$, $-\text{Inventory (COGS)}$ | $0$ | $+\text{Net Profit}$ | **BALANCED** |
| **Credit Sale** | `invoices` | $+\text{Customer Debt (A/R)}$, $-\text{Inventory}$ | $0$ | $+\text{Net Profit}$ | **BALANCED** |
| **Customer Payment** | `customer_payments` | $+\text{Cash}$, $-\text{Customer Debt}$ | $0$ | $0$ | **BALANCED** |
| **Cash Wholesale Purchase** | `purchases` | $-\text{Cash}$, $+\text{Inventory}$ | $0$ | $0$ | **BALANCED** |
| **Credit Wholesale Purchase** | `purchases` | $+\text{Inventory}$ | $+\text{Supplier Debt (A/P)}$ | $0$ | **BALANCED** |
| **Supplier Payment** | `supplier_payments` | $-\text{Cash}$ | $-\text{Supplier Debt (A/P)}$ | $0$ | **BALANCED** |
| **Worker Advance Disbursement** | `worker_transactions` | $-\text{Cash}$, $+\text{Worker Receivable}$ | $0$ | $0$ (No P&L) | **BALANCED** |
| **Worker Salary Settlement** | `worker_transactions` | $-\text{Cash (Net)}$, $-\text{Worker Receivable}$ | $0$ | $-\text{Salary Expense}$ | **BALANCED** |
| **Damaged Goods Spoilage** | `damaged_items` | $-\text{Inventory (at Cost)}$ | $0$ | $-\text{Loss Expense}$ | **BALANCED** |
| **Partner Cash Drawing** | `partner_drawings` | $-\text{Cash}$ | $0$ | $-\text{Partner Equity}$ | **BALANCED** |

---

## 3. Cash Drawer End-of-Shift Reconciliation Equation

The authoritative cash drawer balance is verified by:
$$\text{Expected Drawer Cash} = \text{Opening Float} + \text{Cash Sales} + \text{Customer Cash Debt Payments} - \text{Cash Expenses} - \text{Cash Purchases} - \text{Supplier Cash Payments} - \text{Worker Advances} - \text{Worker Net Salaries} - \text{Partner Cash Drawings}$$

Any difference between $\text{Actual Counted Cash}$ and $\text{Expected Drawer Cash}$ represents:
$$\text{Cash Variance} = \text{Actual Counted} - \text{Expected Drawer}$$
- A positive variance represents cash overage (فائض درج).
- A negative variance represents cash shortage (عجز درج).

All reports in `StoreAuditView.jsx` and `ReportsCenterView.jsx` now compute this exact formula without double-counting worker transactions.
