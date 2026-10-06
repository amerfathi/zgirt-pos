# Remediation tracking — checkpoint 2026-09-22

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](README.md) و[فهرس الوثائق](docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.
Not a completion certificate. Work is local on base fa10c6b; no production mutation, push or release. Previous optimistic status text is superseded by this checkpoint.

## Resume order

1. Make business state + outbox + applied-event/cursor persistence atomic; propagate quota/failure to UI.
2. Reconcile every remaining local/inbound financial transition, including delete/replay, purchase/return, payment, payroll and transfer.
3. Complete branch/API lifecycle, field/action authorization, backup/restore and legacy-account migration.
4. Finish current-tree/history secret discovery, external credential/signing rotation and updater production key provisioning.
5. Add meaningful typecheck, full real-browser/Electron/Android flows, load tests and second security/data review.

## Evidence

npm run test:integration: 32 PASS, 0 FAIL (real local D1/workerd API handlers, React store, storage harness, cryptographic helpers). npm run test:accounting: 17 inherited formula tests pass but are not E2E evidence. Lint and Web build pass; bundle warning remains. Detailed limits in REGRESSION_TEST_MATRIX.md.
The list below is a working ledger, NOT a claim to have enumerated every defect.

## SEC-001

| Field | Record |
|---|---|
| Issue ID | SEC-001 |
| Severity | Critical |
| Root Cause | Client/default credentials and anonymous backend access |
| Affected Files | functions/api/_middleware.js; functions/_lib/auth.js; src/store/useAppStore.js |
| Affected APIs | Protected /api/* |
| Affected Platforms | Web, Electron, Android, Cloudflare/D1 as applicable |
| Security Impact | Unauthenticated access |
| Accounting/Data Impact | Financial records exposed |
| Fix | Server sessions, current principal lookup and fail-closed middleware |
| Verification | tests/api-integration.test.mjs: anonymous + A/B denial |
| Regression Test | tests/api-integration.test.mjs: anonymous + A/B denial |
| Status | FIXED IN TESTED SCOPE; rollout pending |
| Evidence | Local code/test results on 2026-09-22; no deployed/native certification |

## SEC-002

| Field | Record |
|---|---|
| Issue ID | SEC-002 |
| Severity | Critical |
| Root Cause | Legacy plaintext password storage and authentication |
| Affected Files | functions/_lib/passwords.js; functions/api/auth/*; functions/api/tenants/lookup.js |
| Affected APIs | login/password/reset/recovery-token |
| Affected Platforms | Web, Electron, Android, Cloudflare/D1 as applicable |
| Security Impact | Credential compromise |
| Accounting/Data Impact | Account takeover |
| Fix | bcrypt12, plaintext denial, hashed single-use reset tokens |
| Verification | Actual D1 login/reset/revoke tests |
| Regression Test | Actual D1 login/reset/revoke tests |
| Status | CODE FIX VERIFIED; legacy account rollout BLOCKED |
| Evidence | Local code/test results on 2026-09-22; no deployed/native certification |

## SEC-003

| Field | Record |
|---|---|
| Issue ID | SEC-003 |
| Severity | High |
| Root Cause | Local cache/broadcast data treated as live session authority |
| Affected Files | functions/api/auth/me.js; src/store/useAppStore.js |
| Affected APIs | /api/auth/me |
| Affected Platforms | Web, Electron, Android, Cloudflare/D1 as applicable |
| Security Impact | Stale or forged UI privileges |
| Accounting/Data Impact | Misleading access after revocation |
| Fix | Revalidate from server; broadcasts only trigger checks |
| Verification | Actual API identity test; browser focus flow still untested |
| Regression Test | Actual API identity test; browser focus flow still untested |
| Status | PARTIAL |
| Evidence | Local code/test results on 2026-09-22; no deployed/native certification |

## SEC-004

| Field | Record |
|---|---|
| Issue ID | SEC-004 |
| Severity | Critical |
| Root Cause | Signing/admin credentials committed to source/history |
| Affected Files | android/app/build.gradle; scripts/*; Git history |
| Affected APIs | External release/auth systems |
| Affected Platforms | Web, Electron, Android, Cloudflare/D1 as applicable |
| Security Impact | Compromised keys remain usable externally |
| Accounting/Data Impact | Malicious app/update/account access |
| Fix | Current-tree cleanup; external signing configuration |
| Verification | 44-commit history present; rotation NOT verified |
| Regression Test | 44-commit history present; rotation NOT verified |
| Status | BLOCKED EXTERNAL ROTATION; discovery OPEN |
| Evidence | Local code/test results on 2026-09-22; no deployed/native certification |

## TEN-001

| Field | Record |
|---|---|
| Issue ID | TEN-001 |
| Severity | High |
| Root Cause | Pending React effects used mutable session storage scope |
| Affected Files | src/services/tenantStorage.js; src/store/useAppStore.js |
| Affected APIs | Client caches |
| Affected Platforms | Web, Electron, Android, Cloudflare/D1 as applicable |
| Security Impact | Cross-account cache exposure |
| Accounting/Data Impact | Wrong tenant cache overwritten |
| Fix | Capture namespace on store mount; remount on login |
| Verification | tests/storage.test.mjs: two session-switch race cases |
| Regression Test | tests/storage.test.mjs: two session-switch race cases |
| Status | FIXED IN TESTED SCOPE |
| Evidence | Local code/test results on 2026-09-22; no deployed/native certification |

## SYNC-001

| Field | Record |
|---|---|
| Issue ID | SYNC-001 |
| Severity | High |
| Root Cause | Read-before-insert duplicate checks race |
| Affected Files | functions/api/sync/push.js; d1/migrations/0008_sync_immutable_retry.sql |
| Affected APIs | /api/sync/push |
| Affected Platforms | Web, Electron, Android, Cloudflare/D1 as applicable |
| Security Impact | Altered mutation acknowledged |
| Accounting/Data Impact | Ambiguous transaction retry |
| Fix | Transactional trigger rejects changed retry, whole batch rollback |
| Verification | Actual D1 concurrent conflict + within-batch rollback |
| Regression Test | Actual D1 concurrent conflict + within-batch rollback |
| Status | FIXED IN TESTED SCOPE |
| Evidence | Local code/test results on 2026-09-22; no deployed/native certification |

## SYNC-002

| Field | Record |
|---|---|
| Issue ID | SYNC-002 |
| Severity | High |
| Root Cause | Timestamp pagination can skip equal-time events |
| Affected Files | functions/api/sync/pull.js; d1/migrations/0005_sync_sequence.sql |
| Affected APIs | /api/sync/pull |
| Affected Platforms | Web, Electron, Android, Cloudflare/D1 as applicable |
| Security Impact | Missing authorized records |
| Accounting/Data Impact | Lost inbound transactions |
| Fix | Integer sequence and per-user cursor |
| Verification | Actual D1 equal-timestamp pagination + upgrade retention |
| Regression Test | Actual D1 equal-timestamp pagination + upgrade retention |
| Status | FIXED IN TESTED SCOPE |
| Evidence | Local code/test results on 2026-09-22; no deployed/native certification |

## ACC-001

| Field | Record |
|---|---|
| Issue ID | ACC-001 |
| Severity | Critical |
| Root Cause | Duplicate invoice guards excluded related stock/debt effects; repeated product lines ignored |
| Affected Files | src/store/useAppStore.js; src/services/invoiceInventory.js |
| Affected APIs | Sync invoice ingestion / local sale / void |
| Affected Platforms | Web, Electron, Android, Cloudflare/D1 as applicable |
| Security Impact | No new security boundary |
| Accounting/Data Impact | Duplicate deductions and incorrect customer/branch balances |
| Fix | Synchronous identity guard, shared inventory operation, once-only reversal |
| Verification | Actual React hook test failed before fix (14 vs 17), now passes replay/remount/double-submit/void/own echo |
| Regression Test | Actual React hook test failed before fix (14 vs 17), now passes replay/remount/double-submit/void/own echo |
| Status | FIXED IN TESTED SCOPE |
| Evidence | Local code/test results on 2026-09-22; no deployed/native certification |

## DATA-001

| Field | Record |
|---|---|
| Issue ID | DATA-001 |
| Severity | Critical |
| Root Cause | Independent state persistence/outbox/cursor writes, swallowed queue failures |
| Affected Files | src/store/useAppStore.js; src/services/cloudflareSync.js |
| Affected APIs | All offline business mutations / sync |
| Affected Platforms | Web, Electron, Android, Cloudflare/D1 as applicable |
| Security Impact | Local storage integrity |
| Accounting/Data Impact | Partial, lost or resurrected financial records after crash/replay |
| Fix | Queue preserves corruption and raises quota failures; atomic transaction still required |
| Verification | 9 storage tests pass; crash consistency NOT proven |
| Regression Test | 9 storage tests pass; crash consistency NOT proven |
| Status | OPEN RELEASE BLOCKER |
| Evidence | Local code/test results on 2026-09-22; no deployed/native certification |

## ACC-002

| Field | Record |
|---|---|
| Issue ID | ACC-002 |
| Severity | Critical |
| Root Cause | Local and remote business effects differ beyond invoice path; no full journal reconciliation |
| Affected Files | src/store/useAppStore.js; reports/components |
| Affected APIs | Purchases/returns/payments/payroll/partners/transfers |
| Affected Platforms | Web, Electron, Android, Cloudflare/D1 as applicable |
| Security Impact | Granular financial permissions incomplete |
| Accounting/Data Impact | Incorrect stock, balances or reports |
| Fix | Require shared deterministic business transitions and independent expected totals |
| Verification | 17 inherited formula checks are NOT actual workflow evidence |
| Regression Test | 17 inherited formula checks are NOT actual workflow evidence |
| Status | OPEN RELEASE BLOCKER |
| Evidence | Local code/test results on 2026-09-22; no deployed/native certification |

## DB-001

| Field | Record |
|---|---|
| Issue ID | DB-001 |
| Severity | High |
| Root Cause | Bootstrap schema drift and undocumented schema assumptions |
| Affected Files | d1/schema.sql; d1/migrations/* |
| Affected APIs | All D1 APIs |
| Affected Platforms | Web, Electron, Android, Cloudflare/D1 as applicable |
| Security Impact | Missing authorization schema |
| Accounting/Data Impact | Failed or unsafe upgrades |
| Fix | Bootstrap aligned through 0008; migration-ledger use |
| Verification | Actual D1 structure parity and legacy-event preservation |
| Regression Test | Actual D1 structure parity and legacy-event preservation |
| Status | LOCAL FIX VERIFIED; full existing-schema review OPEN |
| Evidence | Local code/test results on 2026-09-22; no deployed/native certification |

## BACKUP-001

| Field | Record |
|---|---|
| Issue ID | BACKUP-001 |
| Severity | High |
| Root Cause | Snapshot round trip mistaken for complete restore integrity |
| Affected Files | functions/api/backup.js; src/store/useAppStore.js |
| Affected APIs | /api/backup; client import/export |
| Affected Platforms | Web, Electron, Android, Cloudflare/D1 as applicable |
| Security Impact | Tenant ownership of imported data |
| Accounting/Data Impact | Inconsistent restored accounting or missed data |
| Fix | API guards applied; transactional tenant-bound restore still required |
| Verification | Actual authorized snapshot payload round trip only |
| Regression Test | Actual authorized snapshot payload round trip only |
| Status | PARTIAL / OPEN |
| Evidence | Local code/test results on 2026-09-22; no deployed/native certification |

## UPDATE-001

| Field | Record |
|---|---|
| Issue ID | UPDATE-001 |
| Severity | Critical |
| Root Cause | Downloaded executable previously trusted without authenticated integrity |
| Affected Files | electron/main.cjs; electron/update-security.cjs |
| Affected APIs | /api/releases/latest; Electron update IPC |
| Affected Platforms | Web, Electron, Android, Cloudflare/D1 as applicable |
| Security Impact | Arbitrary update execution |
| Accounting/Data Impact | Device compromise |
| Fix | Pinned-key manifest, size/hash/version/origin validation |
| Verification | 4 crypto helper tests pass; native download/install not exercised |
| Regression Test | 4 crypto helper tests pass; native download/install not exercised |
| Status | PARTIAL; signing setup BLOCKED |
| Evidence | Local code/test results on 2026-09-22; no deployed/native certification |

## QA-001

| Field | Record |
|---|---|
| Issue ID | QA-001 |
| Severity | High |
| Root Cause | Insufficient workflow/platform/CI coverage |
| Affected Files | tests/*; .github/workflows/quality-gates.yml; package.json |
| Affected APIs | All platforms |
| Affected Platforms | Web, Electron, Android, Cloudflare/D1 as applicable |
| Security Impact | Undetected security regressions |
| Accounting/Data Impact | Unproven end-to-end totals |
| Fix | 32 added tests; install/lint/test/build gates |
| Verification | Local outputs 2026-09-22; no typecheck/hosted/native certification |
| Regression Test | Local outputs 2026-09-22; no typecheck/hosted/native certification |
| Status | OPEN |
| Evidence | Local code/test results on 2026-09-22; no deployed/native certification |

## DEP-001

| Field | Record |
|---|---|
| Issue ID | DEP-001 |
| Severity | Medium |
| Root Cause | Vulnerable transitive uuid through xcode/Capacitor CLI |
| Affected Files | package.json; package-lock.json |
| Affected APIs | Build toolchain |
| Affected Platforms | Web, Electron, Android, Cloudflare/D1 as applicable |
| Security Impact | Dependency advisory GHSA-w5hq-g745-h8pq |
| Accounting/Data Impact | Build/release risk; runtime reachability not certified |
| Fix | Do not force downgrade blindly; review compatible dependency resolution |
| Verification | npm audit --omit=dev: 3 moderate, 0 high/critical |
| Regression Test | npm audit --omit=dev: 3 moderate, 0 high/critical |
| Status | OPEN |
| Evidence | Local code/test results on 2026-09-22; no deployed/native certification |
