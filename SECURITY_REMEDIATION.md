# Security remediation — 2026-09-22

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](README.md) و[فهرس الوثائق](docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.
Implemented locally, not deployed. Authentication uses opaque random bearer tokens; D1 stores SHA-256 token digests bound to server AUTH_SECRET. Passwords use bcrypt cost 12. Plaintext legacy credentials are rejected, NOT upgraded during login. The earlier PBKDF2 description was incorrect and is superseded.
Central API middleware denies unauthenticated access to protected/unknown routes. Public routes are login, trial submission, reset-token consumption, latest release and health. Admin-only operations have additional guards. Server loads current role, membership, status and credential version on requests.
Session revalidation uses /api/auth/me. Browser broadcasts trigger revalidation, never assign privileges from their payload. Logout revokes server sessions when reachable and uses keepalive across navigation; offline server revocation cannot be guaranteed.
Recovery tokens are hashed, tenant-scoped, expire in 15 minutes, consumed once and invalidate existing staff sessions after password change. Actual workerd/D1 tests cover these behaviors.
Remaining: trusted recovery/migration for legacy accounts, production AUTH_SECRET provisioning/rotation, complete public-request abuse controls, audit log coverage, native runtime verification. Do not claim all secrets revoked.
