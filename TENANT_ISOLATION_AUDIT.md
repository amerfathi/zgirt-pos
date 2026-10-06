# Tenant isolation — 2026-09-22

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](README.md) و[فهرس الوثائق](docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.
Local real workerd/D1 tests verify unauthorized requests, A-to-B users/sync/backup access, nested foreign tenant payloads and cashier administration denial. This is runtime evidence, not just source matching; it is not production or native-device evidence.
Browser caches are keyed by tenant AND user. A mounted store captures its identity so pending writes after login cannot land in the next account. Anonymous effects cannot overwrite a new session. Two regression tests exercise both races.
Queue display counts now only the signed-in tenant. Legacy queue storage is still shared physically and needs a transactional migration. Account isolation is an application access boundary, not encryption against someone controlling the operating-system account.
Outstanding: field-level financial redaction, complete branch/reference ownership checks, export/import isolation, cross-platform navigation and browser-cache tests. In-flight client sync is generation/token checked, but full runtime race coverage remains open.
