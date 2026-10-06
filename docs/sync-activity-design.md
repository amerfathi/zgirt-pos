# Activity-driven financial synchronization

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](../README.md) و[فهرس الوثائق](../docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.

## Agreed intent

- Push locally committed operations immediately; preserve the durable outbox until exact server acknowledgement.
- A dormant screen need not display changes instantly. The one- or two-hour timer is a recovery fallback, not the source of financial freshness.
- Refresh on launch, reconnect, focus, branch/financial-screen activity (coalesced within five minutes), and before an online financial commit.
- Keep offline work visibly pending. Never claim a server-confirmed financial result while a push is pending or rejected.
- The server remains authoritative for tenant/branch permissions, immutable retries and causal conflict checks.
- Minimize empty Cloudflare requests; 1,000 users is an example, not a certified capacity target.

## Assumptions and risks

- The existing aggregate/outbox and D1 conflict-head policy remain in place. No server schema migration is needed for scheduling.
- An online preflight pull narrows the stale-read window but cannot prevent another device from writing immediately afterward; server-side conflict checks must still reject stale pushes.
- Offline devices can lose unsent local data if device storage is destroyed before upload. The UI must expose this pending state; backup/recovery is a separate safeguard.
- A one-hour idle fallback does not guarantee a real-time display. The UI must distinguish local data from confirmed synchronization.
- A load test and account-specific Cloudflare limits are required before promising capacity or a latency SLA.

## Decision log

1. Chosen: activity-driven pull plus rare fallback and immediate push. Rejected: four-second polling because it creates many empty authenticated D1 requests.
2. Rejected for now: WebSocket/Durable Object notifications. More infrastructure and operational cost are unwarranted until measured load requires them.
3. Chosen: keep local-first offline transactions and explicit pending/conflict status. Rejected: silently claiming cloud success from local commit.
4. Chosen: online refresh before financial mutation, followed by existing server conflict policy. Rejected: trusting an old screen snapshot as final authority.

## Verification

- Deterministic scheduling tests: no four-second poll, initial/reconnect/focus/activity refresh, one in-flight pull, fallback jitter and teardown.
- Mutation tests: immediate push, no outbox deletion on failed or incomplete acknowledgement, stale server conflict remains visible.
- Browser integration: active branch and financial navigation refresh; online preflight awaits inbound application; offline transaction remains pending.
- Re-run focused sync, branch, financial and browser tests before any publication. Production load and real-device behavior require separate staging tests.
