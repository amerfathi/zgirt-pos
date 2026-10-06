# Data integrity — 2026-09-22

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](README.md) و[فهرس الوثائق](docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.
Fixed and tested: session-switch namespace race; altered idempotency retries; sync sequence pagination; repeated invoice stock/debt application; duplicate reversal; corrupt queue preservation.
Important distinction: enqueue now throws on corruption/quota, but several business callers catch and ignore exceptions. That still permits local business state without a durable outbound event. FAIL until transactional local writes/outbox and UI failure propagation are implemented.
React slice persistence remains separate writes. A crash between invoice, inventory and debt writes can leave partial state; advancing the cursor after scheduling React updates is not a durability guarantee. FAIL.
Cloud snapshot round-trip test checks exact payload retention only. It does not prove complete backup-modify-restore-reconcile or safe import. Export/restore, linked references, concurrent edits, negative stock and full reports require further work.
