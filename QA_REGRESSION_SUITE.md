# QA PERMANENT REGRESSION TEST SUITE — BRRAKA POS v2.6.1

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](README.md) و[فهرس الوثائق](docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.

**System**: Brraka POS  
**Coverage**: Mathematical Invariants, API Gates, Money Precision, Sync Deduplication, and Platform Base URLs  
**Runner Scripts**:
1. `tests/accounting_audit_test.cjs`
2. `tests/comprehensive_qa_suite.cjs`

---

## 1. Automated Test Execution Commands

To execute the permanent automated regression suites locally or in CI/CD pipelines:
```bash
# Run Accounting Invariant & Double-Deduction Tests
node tests/accounting_audit_test.cjs

# Run Comprehensive End-to-End QA Suite
node tests/comprehensive_qa_suite.cjs

# Verify Production Build Integrity
npm run build
```

---

## 2. Regression Suites Content & Assertions

### Suite A: Accounting & Financial Invariants (`accounting_audit_test.cjs`)
1. **Worker Advance P&L Isolation**: Asserts worker advances do not generate general operating expenses or depress Net Profit.
2. **Worker Salary Single Deduction**: Asserts salary vouchers tagged `isWorkerPayment: true` are excluded from generic cash expenses to prevent cash drawer double deductions.
3. **Advance Deletion Rollback**: Asserts deleting an advance decrements `currentAdvance` back to original balance and removes linked expenses atomically.
4. **Partner Equity Capital Invariant**: Asserts total partner equity strictly includes `initialCapital` ($\text{Capital} + \text{Earned} - \text{Drawn}$).
5. **COGS Historical Freeze**: Asserts invoice items freeze `costPerKg` at checkout time and do not recalculate when catalog prices fluctuate.
6. **Inbound Sync Merge**: Asserts incoming mutation streams merge cleanly without duplicate keys.
7. **Base URL Resolver**: Asserts WebView (`http://localhost`) and Desktop (`file://`) map to `https://khodar-pos.pages.dev`.

### Suite B: End-to-End Workflows & Edge Cases (`comprehensive_qa_suite.cjs`)
1. **Money Precision**: Tests cumulative decimal summation to prevent floating-point drift (0.1 + 0.2 problem).
2. **Tare Calculation Precision**: Tests gross minus crates tare weight arithmetic to 3 decimal places.
3. **POS Sale Checkout**: Tests stock decrement, invoice generation, cash drawer increment, and COGS freezing.
4. **Invoice Voiding & Rollback**: Tests inventory stock restoration and cash drawer debit upon voiding.
5. **Customer A/R Credit Lifecycle**: Tests credit invoice generation and subsequent debt collection payments.
6. **Supplier A/P Wholesale Lifecycle**: Tests credit wholesale purchase and subsequent debt settlement payments.
7. **Worker Advance vs Operating Salary**: Tests balance sheet asset vs operating payroll expense mechanics.
8. **Partner Equity Equation**: Tests mathematical equity distribution across partners.
9. **Mutation Idempotency**: Tests deduplication of repeated client mutation dispatches.
10. **Universal API Resolver**: Validates edge routing across multiple origins.
