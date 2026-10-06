# Sync remediation — 2026-09-22

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](README.md) و[فهرس الوثائق](docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.
Server push/pull enforce bearer authentication, tenant ownership, role permissions, branch checks, bounded batch size and nested tenant validation. D1 integer sequence replaces wall-clock cursors.
Migration 0008 rejects altered duplicate event content within the write transaction. Tests cover sequential retry, concurrent conflict, two conflicting IDs in one batch (whole batch rolls back), and equal-timestamp pagination. Original event history is retained.
Client removes only explicitly acknowledged IDs. Corrupt queue data and quota failures are no longer silently treated as empty/successful saves. Counters are tenant filtered; overlapping pulls are serialized and stale account responses rejected.
Actual React store regression demonstrates duplicate invoice receipt (same batch, later batch, after remount), aggregate repeated product lines, branch stock, customer debt, duplicate void and delete-after-void.
NOT CLOSED: state/outbox/cursor do not share a durable atomic transaction. Existing business callers still swallow some queue errors. Deletion followed by replay can resurrect data. Purchases, returns, damage, payroll and transfers do not yet have proven identical local/remote accounting behavior. No cross-device end-to-end certification.
