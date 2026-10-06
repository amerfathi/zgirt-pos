# Accounting reconciliation — 2026-09-22

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](README.md) و[فهرس الوثائق](docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.
The 17 inherited accounting/QA tests pass but mostly reproduce formulas outside the application. They are NOT evidence of full application end-to-end correctness despite their console labels.
New tests/store-sync.test.mjs mounts the real useAppStore with React. Before the fix a sale receipt scenario yielded stock 14 instead of expected 17. After repair:
- Start stock 20 (branch main 20), customer debt 0.
- Receive sale with two lines for the same product: 2 + 1 kg; debt 15.
- Receive duplicate in same batch, another batch, and after remount: stock 17, branch 17, debt 15.
- Receive void twice: stock 20, debt 0.
- Delete voided invoice: balances remain unchanged.
Local posting and voiding share invoiceInventory with inbound processing. This is limited workflow regression, not ledger certification.
The prior FAIL statement is superseded for application accounting reconciliation by the 2026-09-23 canonical actual-hook test. `tests/accounting-reconciliation.test.mjs` independently derives and exactly matches cash, bank, debts, stock/value, sales/purchases/returns, COGS, expenses, damage, payroll/advances, partners and profit after local posting, reopen, second-replica application and replay. This verifies P4's defined reconciliation requirement. The product still has no general double-entry journal, so this is not a double-entry accounting certification; report presentation, restore and conflict behavior remain separate gates.
The same real-hook scenario additionally verifies two local submits with the same checkout key before React rerenders, receiving the local sale back from sync, and two local void calls before rerender. Each financial effect occurs once.
