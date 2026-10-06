# Accounting day, drawers, and cashier shifts — approved design

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](../README.md) و[فهرس الوثائق](../docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.

Status: design approved by owner on 2026-10-01. Local implementation in progress; no release is implied.

## مطابقة 2026-10-03 — تتقدم على الادعاءات التاريخية أدناه

توجد APIs إصدار التصاريح وpin عام وخدمات فكّ محلي؛ لكنها ليست موصولة بالدخول الحقيقي. توجد open/close في store بالفعل، وattribution لبعض cash hooks داخل aggregate المستخدم فقط؛ لا يتضمن ذلك حفظ الفاتورة مع سجل الدرج المشترك. replay عبر sync يحافظ على actor الجلسة الحالية، ولا يتيح للمحاسب التالي مزامنة مصادر المحاسب السابق.

فحص D1 أعاد إنتاج قبول درج شركة أخرى عبر cash_shift؛ أضيف تحقق tenant/branch/active drawer. كذلك أعاد اختبار مستقل إنتاج فشل open→sale→close→next-open داخل commit group واحدة؛ صُحح التحقق باستخدام حالة متسلسلة داخل الدفعة ومجموع حركاتها قبل commit D1 الذري. نفس الاختبار يثبت rollback كامل للتسوية الناقصة وإعادة إرسال الدفعة دون تكرار النقد. هذا دليل لنفس المحاسب فقط، ولا يغلق handover بين حسابين أو إثبات الجهاز أو النسخ والاستعادة أو التطبيقات الأصلية. راجع `AI_HANDOFF_CURRENT.md` وملحق CASH في `RELEASE_BLOCKERS.md` قبل المتابعة.

## Offline-first amendment approved by owner (2026-10-01)

The preferred operating rhythm is to synchronize once at shift start and again at shift close. Cash sales continue when connectivity disappears during the shift. If connectivity is unavailable at closing time, the designated device durably records the physical count and an immutable **locally closed, pending synchronization** event; it may then open the next shift on the **same physical drawer and device**. On reconnection, financial events, close, and next open are uploaded in their original order. A locally closed shift is not represented as server-confirmed until all preceding events and the close receive authoritative acknowledgements. The cashier sees both statuses distinctly.

Only one designated device may produce offline cash events for a drawer. Other devices may use that drawer only with current online confirmation; they cannot independently open a competing offline shift or close it. Initial drawer/device registration requires one online authorization. Subsequent shifts can open offline on that already-registered device, provided the local aggregate and lease identity remain intact. If the device or its unsynced data is lost, supervisor recovery must be audited; no automatic zero-count or invented server acknowledgement is permitted.

This amendment supersedes earlier wording that required the local outbox to be empty before **local** close. An empty, acknowledged outbox is required only before marking the close **server-confirmed**. The current server close endpoint is a foundation, not a complete offline close flow; it must remain unavailable in the UI until the local durable chain, sequential replay, server validation, backup/recovery, and cross-platform tests are complete.

### Decision log and alternatives

- Chosen: offline local close followed by ordered server confirmation. Rejected: mandatory internet at every close, because it halts normal store operation.
- Chosen: one offline writer per drawer, with same-device offline handover. Rejected: two independent offline devices for the same drawer, because neither can know the other's cash movements at count time.
- Chosen: distinct local-pending and server-confirmed states. Rejected: a single "closed" indicator that could imply cloud reconciliation before upload.

### Explicit assumptions and verification targets

- Branch timezone defines the accounting date; the actual close timestamp may be later than the shift's last accounting date.
- The existing durable aggregate/outbox is the intended storage boundary; shift close and its local cash source list must commit atomically with the pending sync event, not in an unprotected settings key.
- At least 1,000 active users may operate across tenants; locks/conflicts are scoped by tenant, branch, drawer, and shift, not global.
- Tenant/branch permissions and drawer-device ownership are server-enforced after reconnection. A disconnected device can only act within its previously verified local scope.
- Tests must cover no connectivity from start to close, two consecutive offline shifts, crash/restart between count and upload, duplicate/lost acknowledgements, same-account dual devices, branch isolation, and recovery after device loss. Windows, Android, and Web must be checked before release.

## Implementation checkpoint (2026-10-01)

The pure shift calculation engine and a D1 foundation for tenant/branch-scoped drawers and open shifts have been implemented locally. A partial unique index enforces one open shift per drawer even when two requests race. The cash endpoints are not connected to checkout, and closing, device lease enforcement, UI, backup/restore, and platform verification remain unimplemented. This checkpoint must not be released as a completed cash-control feature.

Next local checkpoint: the sync push path now derives a cash amount from a newly-created financial record that explicitly names an open `cashShiftId`. A transactional movement row is keyed by the source sync-event ID, and the server rejects a missing/foreign/closed shift or another cashier's shift. This is opt-in and does **not** yet make shift attribution mandatory for the current checkout. Pending local events, actual closing, and full device leases are not solved. In particular, closing must remain disabled until those paths and migration/backup are complete.

Correction checkpoint: when a previously shift-attributed financial record is voided or deleted, sync now requires a new open-shift reference and records one opposite-signed movement linked to the original source event. Repeated and same-batch corrections are guarded; the original movement remains immutable. This does not yet prove a physical cash refund actually occurred, and the current UI does not provide the required shift reference on correction. Pending local events, closing, offline device leases, and mandatory attribution remain release blockers.

Close checkpoint: a local-only server endpoint can persist counted cash, source-derived expected cash, variance, actor, and actual close timestamp. It rejects a nonzero reported pending queue, movement-count mismatch, duplicate close, and a caller without the designated device's 256-bit proof. The proof is generated and persisted by the opening client before its request, sent once, and only its server-secret-derived hash is stored; identical open requests can be retried after lost acknowledgement. A server does not independently know whether an offline client has unsent events: the current `pendingEventCount` is client-reported, so this endpoint must stay disconnected from the UI until durable local outbox verification, cross-device coordination, and recovery behavior are implemented and tested. Device proof is an ownership check, not a substitute for that verification.

Local durability checkpoint: a deliberately unconnected `cashShiftLedger` now records open, cash-event, and locally closed shift snapshots together with ordered outbox entries in one IndexedDB-backed aggregate commit. Tests reopen the aggregate after two consecutive shifts and inject a failed close commit to verify rollback. This is **not** a complete offline workflow: the current sync API rejects `cash_shift` events, the real sale/receipt hooks do not yet attach them, initial device registration/proof persistence is not wired to this ledger, and no server acknowledgement can promote `closed_local` to confirmed. Keep the ledger off all user-facing paths until those parts and cross-platform recovery tests are complete.

Cross-cashier checkpoint: the two-consecutive-shift durability fixture uses **the same authenticated account**. A shift event for another cashier is now rejected from that user's aggregate. The existing aggregate/outbox key is scoped to `(tenant,user,permission scope)`, so a second cashier signing in on the same offline device cannot see or flush the first cashier's pending events. Treating a second actor ID in the first cashier's queue as a successful handover would falsely claim multi-user support and could misattribute financial events. A real offline handover between distinct accounts requires a durable device/drawer queue and a server-attested, revocable device delegation protocol that preserves each event's original actor, maintains one ordered cash chain, survives login/logout and failed commits, and is backed up/recoverable. The device queue must be transactionally linked with each user's financial aggregate; a separate non-atomic storage write is unacceptable. The server must authenticate replayed actors and reject competing devices/branches before any UI activation. This remains a release blocker.

Offline authentication checkpoint: the application currently keeps only one verified user and bearer token in `sessionStorage`; a different cashier cannot sign in while disconnected. The proposed cross-cashier handover therefore also requires a previously online-verified, time-limited offline access grant for each authorized cashier on the designated device. First-time staff login, changed/revoked permissions, and expired grants must require connectivity rather than silently granting access. This prerequisite and its revocation window require explicit owner acceptance before any offline multi-account login is built or represented as available.

## Offline multi-cashier handover — owner decision, 2026-10-01

### Understanding and scope

- A registered physical drawer may pass from cashier A to cashier B on the same designated device without internet, after A durably counts and locally closes their shift.
- B must have previously completed an online, server-verified login on **that device**. First-time login on a disconnected device is not supported.
- Each cashier's invoices and cash events retain their original actor and branch. A shared device/drawer journal carries the cross-account ordering; it is not a substitute for the financial records.
- Offline access lasts at most **24 hours from the last successful online verification** for that cashier/device, as approved by the owner. An expired grant blocks starting a new offline shift, but never deletes pending records or changes prior accounting.
- No server-confirmed close is displayed before authoritative acknowledgement. This change does not authorize a second offline writing device, global branch access, or indefinite offline login.

### Chosen architecture and alternatives

The recommended design is a tenant/branch/drawer/device-scoped durable journal with an ordered sequence of actor-attributed shift transitions. Financial source records stay in their user-scoped aggregates. Recording a sale plus its journal entry must use **one IndexedDB transaction spanning both records** with compare-and-swap revisions; a two-step write is forbidden. A device-local lock serializes handover and cash posting, while the server verifies device registration, cashier grants, shift state, branch authorization, source IDs, replay order, and idempotency. Server acknowledgement advances the journal only after every preceding financial event is accepted. This preserves each actor while allowing same-device cross-account handover.

Rejected: putting B's shift in A's aggregate, because this misattributes identity and strands pending events after logout. Rejected: two independent user queues plus a best-effort handover marker, because an interruption between writes can lose the order. Rejected: unrestricted offline login, because revocation cannot reach a disconnected device. Rejected: a second offline device for one drawer, because its physical count cannot reconcile against the first device's unseen cash.

### Security, reliability, and scale assumptions

The app must not retain plaintext passwords or a reusable server bearer token as the offline credential. A local grant is bound to tenant, cashier, device, allowed branches, and a server-issued verification time; it is unlocked by that cashier's secret and expires after 24 hours. The server remains authoritative on reconnect and rejects revoked permissions or conflicting drawer history; rejected records are preserved for audited recovery, never silently deleted. Device-clock rollback cannot be fully prevented offline, so server timestamps and grant expiry are checked again on replay. The owner accepts that revocation cannot be enforced on a disconnected device until reconnection or the 24-hour local expiry, whichever comes first. The journal is per drawer rather than a global lock, so about 1,000 active users across tenants do not contend on one queue. Ordinary empty inbound checks stay throttled; financial events are pushed when connectivity returns without a fixed two-minute batch delay.

### Implementation and verification gates

1. Pure grant policy: reject wrong device, tenant, branch, cashier, missing prior online verification, and expiry at the 24-hour boundary. No offline first login.
2. Durable multi-record commit: user financial aggregate and shared drawer journal commit or roll back together; test failed/aborted IndexedDB transactions and reopen.
3. Server protocol: register device online, issue and verify grants, then replay A's cash events, A's close, B's open, and B's events in order with original actor identities. Test changed permissions, duplicate/lost acknowledgement, conflicting device, foreign branch, and partial batch failure.
4. Connect existing sale/receipt hooks and user switching; show local-pending versus server-confirmed state and recovery guidance. Only then test real Web, Windows, and Android workflows before release.

Decision log: 24-hour grant chosen over seven or thirty days to reduce the disconnected revocation window; same-device shared journal chosen over account-only queues to preserve ordered handover; server-verified enrollment chosen over first-time offline identity claims. The initial high-risk multi-agent design-review skill named by the brainstorming workflow is unavailable in this environment; until independent review and platform tests are complete, this remains an implementation draft and release blocker.

Implementation checkpoint: the 24-hour tenant/cashier/device/branch policy has passing boundary tests, but it accepts claims only and **does not verify a server signature or authenticate an offline login**. `DurableAggregate.commitBatch` now atomically compare-and-commits two records in one strict IndexedDB transaction; a real Chrome test checks a stale second revision rolls both back and that a successful pair survives a forced browser-process stop. This storage infrastructure is not yet connected to the financial hook or live authentication, and neither offline grants nor cross-cashier server replay are available to users.

Local cross-account checkpoint: an isolated `cashDrawerJournal` service now uses the paired commit to append the same shift transition to the actor's own aggregate and the device/drawer journal. Fixtures verify cashier A can close and cashier B can open the same offline drawer without writing B's shift into A's account, and injected paired-commit failure leaves both records unchanged. This service is deliberately not wired to the UI. It does not yet atomically include actual invoice/receipt records, transfer A's pending financial source events under an authorized replay identity, issue a signed grant from online login, or reconcile with D1. Do not interpret the local handover test as end-to-end offline cashier switching.

Signature checkpoint: the staged journal now rejects raw caller-supplied claims. A verified handle can be created only after an ECDSA P-256/SHA-256 signature checks against a supplied public JWK; tests mutate the signed cashier and branch to prove rejection. **This is not production authentication yet**: the trusted public key is not pinned/configured in the app, the server does not issue signed grants at login, no password-gated local unlock exists, and replay does not authenticate the original actors. A caller-chosen public key must never be accepted as a production trust root. These are still release blockers.

Signing-helper checkpoint: a server-only ECDSA P-256 signing helper is now tested against the local verifier. It accepts a private JWK and claims supplied by its caller solely as an isolated primitive; it is **not** an issuance endpoint. Before use, an authenticated endpoint must derive tenant, cashier, device registration, branch permissions, and issue time from trusted server state, keep the signing key in a server secret, and pin the corresponding public key in the client. Neither a client-supplied private key nor client-supplied grant claims may be accepted. No existing session, invoice, or replay behavior has changed.

Issuance checkpoint: a login-bound, device-bound issuance flow now exists behind `/api/cash/devices` and `/api/cash/grants`. Device registration is one online authorization that stores a salted proof hash; grant issuance then derives tenant, cashier, registered device, active branch scope, and verification time from the authenticated session and database and signs with a private JWK read only from the server secret `OFFLINE_GRANT_PRIVATE_JWK`. The client trust root is pinned in `src/config/offlineGrantPublicKey.js`, whose provisioned public JWK is committed while its private half lives only in the Cloudflare secret (OA-07). An integration test proves unauthenticated, wrong-proof, unregistered-device, cross-tenant, and forged-claim requests are rejected and that the issued grant verifies against the pinned public key. This still does not unlock an offline login: binding to a previously verified cashier credential (blocker 2) remains.

Offline unlock checkpoint: a staged `src/services/offlineUnlock.js` binds the signed grant to the previously verified cashier's password without retaining the plaintext or a reusable bearer token. At online enrollment it verifies the grant, then stores it next to a salted PBKDF2 verifier of the password. Offline unlock re-derives and compares the password, re-verifies the ECDSA signature, and re-asserts the 24-hour expiry plus the device/branch/cashier/tenant scope before releasing the verified handle used by the shared drawer journal. Tests cover first-time offline login, wrong password, expired grant, tampered envelope, wrong scope, and enrollment of an invalid grant. The accepted local revocation window is the same 24-hour expiry: server revocation cannot reach a disconnected device and is enforced on reconnect. This service is not yet wired to the login/startup flow or a durable device-scoped store.

Persistence and wiring checkpoint: a durable, device-scoped `src/services/offlineGrantStore.js` (injectable IndexedDB backend plus an in-memory test backend), a stable `src/services/offlineDeviceIdentity.js` (device ID plus a 64-hex possession proof), and an injectable `src/services/offlineGrantEnrollment.js` now tie the pieces together. `enrollOnline` registers the device, requests a signed grant, enrolls it against the cashier's password, and persists it keyed by tenant/cashier/device; `unlockOffline` reloads and unlocks it and returns the verified handle for the shared drawer journal. Tests cover device-identity reuse, device-scoped durability, full enrollment, successful and failed offline unlock, and rollback when the server rejects registration. These orchestrators are deliberately not called from the login UI yet, so the offline cashier feature stays hidden.

## Understanding

- A branch may have multiple physical cash drawers and multiple cashiers.
- A cashier closes and counts their shift before handing the *same drawer* to another cashier, even if both shifts occur on the same day.
- A user account may be open on two computers. Devices are not accounting identities.
- A shift may be closed before midnight. An overdue shift must be closed the next morning before new cash sales on its drawer.
- Daily accounting must not mix yesterday's transactions with today's because of a late shift close.
- Financial history, local pending transactions, and branch isolation must survive sync/recovery; no silent balance edits.

## Decisions and alternatives

1. **Shift identity = tenant + branch + physical drawer + shift ID.** Rejected user-only identity (one user can use two devices/drawers) and device-only identity (one drawer can be shared across devices).
2. **Accounting date = transaction occurrence date in the branch timezone.** Shift open/close timestamps are separate. Rejected using close date for every transaction in a shift.
3. **Exactly one active shift per drawer; multiple drawers per branch may run concurrently.** The next cashier's shift cannot open on the same drawer before the previous one is closed and reconciled.
4. **No automatic close or guessed count at midnight.** An overdue shift blocks *new cash activity on that drawer* until counted and closed. Other drawers may operate independently.
5. **Online shared-device cash activity is allowed only against the confirmed current shift. Offline cash activity has one designated device per drawer.** Rejected unconstrained multi-device offline cash writes because neither device can safely know the other's pending events.
6. **Close is an immutable reconciliation event.** Preserve opening float, expected cash, counted cash, variance, actor, source device, occurrence and recorded timestamps, and reason/approval for variance. Corrections are explicit reversal/adjustment events.

## Proposed flow

At shift open, an authorized cashier selects branch and drawer, verifies opening float, and receives the active shift ID. Every cash event carries tenant, branch, drawer, shift, event ID, actor, device, occurrence time, and accounting date. The server validates tenant/branch membership and atomically rejects duplicate event IDs, stale shift IDs, and competing opens/closes. Non-cash sales retain branch and accounting date and need no drawer assignment.

At close, the cashier counts physical cash. The locally expected amount is opening float plus durably recorded local cash inflows minus outflows and transfers. Closure is allowed without connectivity on the designated device and remains explicitly pending server confirmation while its outbox has unacknowledged events. Counted-versus-expected difference is recorded, never silently applied to sales or previous events. Handover to the next cashier is a new shift with an explicitly counted opening float; the same offline device preserves the ordering across both shifts.

An overdue shift retains its original transactions' accounting dates. Close records its *actual* next-day timestamp and the affected shift. The daily report groups by each event's accounting date, branch, and drawer; it does not move transactions to the date of close. An administrator may see all drawers but cannot silently bypass an overdue or unreconciled close.

## Non-functional assumptions and risk

- **Scale/performance:** Support at least the previously discussed order of 1,000 active users without global locks; concurrency is scoped to a drawer and shift. Aggregate reports use indexed tenant/branch/accounting-date keys.
- **Security/privacy:** Tenant and branch access, drawer permissions, and close rights are enforced server-side and in local UI; device IDs are not authorization credentials.
- **Reliability:** Cash events and close operations are idempotent and committed atomically with sync state. Local closure is allowed with pending events but is never labeled server-confirmed until all prior events are acknowledged. A lost designated device requires an audited supervisor recovery path, not an inferred zero queue.
- **Availability:** Other drawers and branches continue when one drawer is overdue. Offline cash is limited to its designated device; online shared-device operation requires current server-confirmed shift state.
- **Maintenance:** Journal, shift, and correction schemas must be versioned and migratable, with backup/restore coverage and cross-platform regression tests.

## Implementation and verification gates

1. Characterize existing cash/branch/sync paths, then add failing tests for active-shift uniqueness, cross-device replay, overdue close, accounting-date attribution, and variance persistence.
2. Add shift/drawer data model, server authorization and atomic concurrency guards, local durable outbox behavior, and recovery path without converting old balances silently.
3. Add cashier open/count/close/handover UI, branch daily and shift reports, backup/restore migration, and Windows/Android/Web verification.
4. Only after shift behavior is reliable, integrate it with balanced journal postings and formal financial statements; tax, inventory count, bank reconciliation, and receivable allocation remain separate sequential work items.

No live rollout until data migration, offline conflicts, day-boundary behavior, and multi-device scenarios pass. Approval of this design does not certify the existing app.
