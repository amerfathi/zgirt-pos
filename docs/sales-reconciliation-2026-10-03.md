# Independent multi-cashier sales reconciliation

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](../README.md) و[فهرس الوثائق](../docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.

Checkpoint: 2026-10-03. Scope: independent active invoice CREATE events without cash-shift attribution. This does not certify every financial conflict or the unfinished cash-shift feature.

## Cause and repair

Company-wide inventory/customer/liquidity heads reject a second offline sale although its additive effects commute with the first sale. Removing the heads would also permit destructive snapshot/edit races.

The authenticated read-only `/api/sync/rebase` audits a consistent D1 history/head snapshot, the client's causal predecessors, immutable event identity and already-accepted retries. It permits only independent invoice creates in the intervening history, filters returned financial records by company/branch permissions, and refuses edits, reversals, restore barriers and shift-bound movements. The bounded request covers one existing push batch (maximum100 events); the entire local sales queue can contain multiple batches. More than1000 intervening server events require another reconciliation path and stay pending; this is an explicit limit, not silent data loss.

The local aggregate atomically applies visible remote sales once, acknowledges only identical accepted source IDs, advances its cursor, and rebuilds pending transport preconditions. Invoice IDs, payloads, groups and financial amounts are preserved. Quota/failure or a locally changed queue/cursor rolls everything back. The original push trigger performs the final compare-and-swap; another server writer can still cause409 and a bounded backoff retry. Noncommuting operations retain the visible conflict and their durable queue.

An inbound fetch also rechecks the queue before delivery, preventing a response started before checkout from overwriting a newly pending ledger.

## Evidence

- Regression first reproduced404 for the missing rebase route and409 for the second independent sale; the new audited path passes. Existing stale-edit, reversal, idempotency and foreign-company checks remain passing.
- Real API/workerd suite:42 tests passed; expanded rebase assertions separately verify forged predecessors, future cursors, collisions and hidden-branch filtering/denial.
- Actual production React store: two credit sales change20kg to14kg and customer debt0 to30 exactly once, including restart and acknowledgement replay.
- Final focused aggregate/store/service suite:84 passed, including quota rollback, immutable payload, changed queue rejection, accepted-source deduplication and the inbound-fetch race.
- Full suite before the last race guard:232 integration cases plus5 security/gate/password cases and the separate inherited accounting checks passed. Lint/typecheck pass after the harness typing fix. Final hosted checks must be recorded after publication.
- Actual local Web/Electron: different cashiers, same account on two devices, and different branches after offline/reconnect accepted both sales once with pending0. Android debug2.6.13 on Braka_UI_Test/emulator-5556 also completed an offline/reconnect sale against Web.
- Live API staging deploymenta8b3ebde preserves published Web2.6.11 assets and adds only the audited route to the previous auth hotfix API. Candidate Web/Electron2.6.13 and actual Android debug2.6.13 then exercised live expiring QA companies: different cashiers, the same account on two devices, and Android/Web offline/reconnect all accepted both invoice sources once with pending0. Rebase200 followed the initial409. No user account or real data was used.

Artifacts are ignored under `scratch/artifacts/{multi-company,live-multi-company}`. Fixture credentials remain in ignored private configuration and are never printed or committed.

## Publication and limits

Final publication checkpoint2026-10-04: source bb27b7403dec2565ad7a4a1b12c7edab0a8c9b78; quality run37153236218 passed233 integration cases and security gates; production run37153318752 succeeded. Release https://github.com/amerfathi/khodar-pos/releases/tag/v2.6.13; Web https://421b2337.khodar-pos.pages.dev promoted to the production domain. Both public latest endpoints advertise2.6.13. Windows manifest signature and binary hash/size verified. Android certificate matches2.6.12.

Additional production-domain tests: different-branch Web/Electron and same-account Web/extracted published Windows binary accepted each offline invoice once,pending0. Renderer reload verified the latest server cursor and stock independently from source records, without duplicated effects. The packaged Windows journey passed after changing the harness reload wait from network-idle to DOM readiness plus explicit durable assertions; the earlier generic timeout remains a single unlocalized automation observation, not a proven app defect. Installed Windows was untouched. Final signed Android APK UI and physical printing remain unverified; the Android live journey used the debug build.

The final release/build/deployment references will be appended after verification. Production API packaging derives fromc10f4e5 plus the deployed authentication fix and this rebase route; candidate timezone/cash-shift database migrations are not deployed implicitly. Existing installed clients need the new client bundle for automatic reconciliation.

Displayed sequential invoice numbers still repeat across offline devices; internal source/invoice IDs remain distinct. Safe invoice series/number allocation remains OPEN. The first writer can remain temporarily behind a later writer's inbound view until its next refresh; queue0 means outbound acknowledgement, not that every device has the newest inbound view. No1000-user capacity or full Windows-installer/physical-printer certification is claimed.
