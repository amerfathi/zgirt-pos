# Live authentication CPU repair — 2026-10-03

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](../README.md) و[فهرس الوثائق](../docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.

The owner requires no additional subscription. Cloudflare dashboard confirms Workers Free (10ms CPU per Pages request). A filtered live QA login trace returned `exceededCpu`, CPU18ms, wall196ms, HTTP503/1102.

## Repair

All Pages password operations (login, tenant/staff creation and reset, account password change, platform owner changes) pass the environment to the password helper. It delegates bcrypt12 to `PASSWORD_CRYPTO`, a private SQLite-backed Durable Object in `braka-password-crypto`. Existing bcrypt hashes, password limits, rate limiting, authorization, session issuance and revocation remain intact. Each operation gets an independent object; no global serialized login queue, storage writes, password/session cache, or request logging. Missing/failed binding rejects the operation. bcrypt initialization is deferred on the Pages side.

The Worker has `workers_dev=false` and `preview_urls=false`, a default404 handler, no database binding, and no application credentials. Only the Pages namespace binding can invoke the computation. No subscription upgrade, password migration, or new public endpoint.

Cloudflare documents SQLite Durable Objects on Free with 30s default CPU per invocation, 100,000 requests/day and13,000GB-s/day compute. These are finite free quotas, not a claim of unlimited capacity or a1000-user load certification:
- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/pages/functions/bindings/#durable-objects

## Deployment and verification

- Private Worker final version: `479415e2-95c8-49e0-bda7-c7b7fb5e1b52`.
- Final Pages deployment: https://b7928fe4.khodar-pos.pages.dev (production main); initial repair deploymenta297fb3c.
- Emergency package derives from published baselinec10f4e5, with only password helper/routes and DO binding changed. Staged under ignored `scratch/auth-hotfix-20261003`. It deliberately excludes candidate2.6.13 migrations/financial changes. Web JS `index-nF3Ee0ql.js` and CSS `index-B5pZnCDW.css` matched the production asset names before deployment. No installed desktop/Android package replaced.
- Local real workerd/DO API suite:41 API cases passed, plus delegation and private-compute behavioral tests. Security guards, lint and full typecheck passed.
- Live isolated expiring QA companies: owner/staff logins and `/api/auth/me` succeeded. Staff password change succeeded; old session and old password rejected401; new password accepted200; original fixture password restored and verified. Owner's account untouched.
- Final live trace: every captured operation had outcome`ok`; login CPU6-21ms (most6-10ms), password changes9/14ms. The final isolated login was7ms/200. Some successful observations still exceed the nominal10ms under Cloudflare's available burst allowance; do not claim every request is below10ms or that free quota failures are impossible. No1102 occurred in this validation.
- Actual Web/Windows financial journeys on live: different companies online and offline/reconnect each accepted both invoices once with pending0. Android debug WebView successfully called the live login API200; this is not a full Android published-APK UI/financial test.
- Same-company/two-cashier offline journey still returns200 for one invoice and409 for the other, pending retained after reload. This unrelated financial reconciliation/numbering blocker remains OPEN; this authentication repair does not certify it.

Evidence is ignored under `scratch/artifacts/live-multi-company/`; fixture secrets stay in its private configuration and must not be committed. Trace before/after and auth status artifacts contain only allowlisted diagnostic fields.

## Future deployment

Deploy `workers/password-crypto/wrangler.toml` before Pages on a new account; keep the root `PASSWORD_CRYPTO` namespace binding. Re-run correct/wrong-password, staff password-change/session-revocation and CPU trace checks after deployment. Use SQLite classes so the namespace remains compatible with Free. No data restoration is needed to roll back code: pre-repair Pages deployment62caac06-98b9-4a91-b35b-b5fab457ceaa remains available, but restoring it reintroduces the bcrypt Pages CPU failure.
