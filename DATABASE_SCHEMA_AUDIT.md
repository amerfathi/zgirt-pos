# Database schema — 2026-09-22

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](README.md) و[فهرس الوثائق](docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.
Migrations:
0003 sessions, store codes, auth versions and trials;
0004 revocation triggers and request limits;
0005 sequence-based sync while retaining historical table;
0006 hashed recovery tokens;
0007 signed release manifest;
0008 immutable retry guard.
d1/schema.sql now bootstraps an EMPTY database from the same 0001–0008 definitions. Existing databases must use migration tracking, NOT rerun schema.sql or manually repeat ALTER statements.
Actual local D1 tests PASS: all migrations on empty DB, bootstrap/numbered sqlite_master structure equivalence, preserving an existing event during 0005 migration, conflict batch rollback.
Still open: full code/query/foreign-key audit, previous manually modified production schemas, migration backups, rollback/runbook and staged deployment. Passing a fixture upgrade is not proof of every existing database upgrade.
