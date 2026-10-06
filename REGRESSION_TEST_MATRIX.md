# Regression test matrix — 2026-09-22

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](README.md) و[فهرس الوثائق](docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.
| Command / suite | Observed result | Limits |
|---|---|---|
| npm run test:integration | PASS: 32 tests, 0 failures | Local runtime only |
| API suite | PASS: 18 tests | Real local workerd + D1, production handlers/middleware |
| Storage/queue suite | PASS: 9 tests | Browser Storage harness, not native storage test |
| React store sync | PASS: 1 workflow | Actual store mounted; storage/events harness, offline |
| Updater security helpers | PASS: 4 tests | Real generated Ed25519 keys; not Windows install |
| npm run test:security | PASS | Source-pattern guards only |
| npm run test:accounting | PASS: 17 inherited checks | Formula tests, not full application E2E |
| npm run lint | PASS | Scoped ESLint rules; not a security proof |
| npm run build | PASS | Bundle-size warning remains |
| typecheck | NOT RUN / missing gate | Must be added meaningfully |
| Android/Electron/browser E2E | NOT RUN | No certification |

CI runs install, lint, tests and build; hosted CI execution has not been observed. New tests are included through npm run test:integration.
