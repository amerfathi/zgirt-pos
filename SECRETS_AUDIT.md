# Secrets audit — 2026-09-22

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](README.md) و[فهرس الوثائق](docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.
No secret values are recorded in this document.
The local Git history contains 44 reachable commits. Previously embedded administrator credential and Android signing material remain compromised in history. No external revocation, key rotation or history rewrite has been performed or verified.
Current-tree cleanup includes frontend/default account secrets, tracked Android keystore removal, external Gradle signing configuration, and removal of legacy credential copies from three browser audit scripts and ACCOUNTING_FINDINGS. Those scripts now require explicit test credentials in environment variables. They have not been rerun and are not release evidence.
The removed keystore remains recoverable in Git history; this removal does not revoke it. Replacing an installed Android app signing identity requires a distribution-specific migration/key-upgrade strategy; do not silently break installed-user upgrades.
Legacy password records fail authentication. An authorized reset/migration and session revocation plan is still required before deployment. Provision AUTH_SECRET and updater signing material outside Git; pinned updater public key is not yet supplied.
Status: BLOCKED for external rotation and signing continuity; full second-pass current-tree/history discovery remains OPEN, not certified clean.
