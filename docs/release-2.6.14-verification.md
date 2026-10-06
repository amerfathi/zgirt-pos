# BRAKA 2.6.14 verification — 2026-10-04

Published and verified. This is a scoped verification report, not a blanket guarantee for all devices, histories or loads.

## Scope

- Owner conflict decisions execute centrally against fresh heads, preserve originals, and produce immutable transactional receipts. Reviewed devices install a permission-filtered checkpoint only after durable atomic acknowledgement.
- Unscoped historical product references require a unique, branch-authorized source proof. The original source remains unchanged; missing dependencies cannot silently discard incoming batches.
- New invoices use UUID identities on all clients. Display/print/search uses the full lossless UUID-derived reference, with wrapping in thermal/A4 layouts.
- Only additive D1 migrations0023–0026 were applied after a private ignored export. Cash shifts remain disabled; unrelated migrations0017–0022 were not applied. Web deployment must use the conservative compatible API stage.

## Completed checks

- Full local suite:259 automated cases, zero failed/skipped. Separately17 inherited formula checks; these are not end-to-end journeys.
- Final indexed API suite:45 passed. Lint, typecheck and Web build passed.
- Actual preview owner UI: approved local source; canonical price12 recovered; original evidence retained; no page errors. Fixture price restored to10.
- Actual Android debug WebView and preview Web: offline sale, reconnect, accepted once, pending0, matching stock after reopening; cross-tenant access403.
- Initial Web/Windows financial matrix: seven scenarios passed; eighth Windows preparation timed out once, then passed an isolated retry. A complete final candidate matrix is being rerun; do not conceal the initial failure.
- Candidate matrix rerun: seven scenarios passed; same-account Windows reload prefix check failed once. The repeat also exposed simultaneous native input focus interference. The harness now prepares fields serially but still saves concurrently, retaining failure diagnostics. A run using the extracted final Windows package passed both concurrent invoices and reopen stock reconciliation with accepted1/pending0 for each device. No production sync code was changed to hide this failure.
- Hosted build37192819553 passed verification and both native builds. Windows manifest Ed25519 signature, installer SHA256 and size passed verification against the pinned key. Extracted package was exercised without replacing the user's installed application.
- Production APK has package com.khodar.pos, version2.6.14, versionCode26140; apksigner verifies the existing production certificate SHA25647187399a8bfe2007f3a1a300a3aeab895a50f11d0aedbf74abe8c02064a5c45. Installation and launch on the isolated Android36 AVD Braka_Release_2614 passed; login screen screenshot confirms2.6.14. This is not a complete financial UI journey of the signed APK.
- Actual owner decision UI also passed on production after deploymentd6d5e52a; evidence retained and receipt recovery succeeded without page errors.
- Final production matrix passed all8 scenarios using published Web and the extracted final Windows package: different companies online/offline; different cashiers in one branch offline/sequential; same account on two devices online/offline; separate branches offline; same account on two Windows instances concurrently. Each tested invoice accepted exactly once, pending0, no page errors, stock matched after reopen; cross-tenant403 and authorized-branch filtering verified.
- Final production Web + Android debug WebView offline/reconnect journey passed: each invoice accepted once, pending0, matching stock71 after reopen. Signed APK installation/launch is a separate result above, not substituted for the debug financial journey.

## Limits

- Complete-history settlement is bounded at2000 source events. Unsupported histories/relations and incomplete review coverage stay blocked with sources preserved.
- This is not a1000-concurrent-user capacity certification, a physical-printer test, or a guarantee against every possible future failure.
- Windows updater manifests use the pinned Ed25519 key. The installer has no Windows Authenticode publisher certificate; OS warnings remain possible.
- The user's installed Windows application has not been replaced. Android financial journeys above used a debug build; signed release installation is separately checked.

## Final status

Code commit:f850a7679e7bdc1b57ebfb6ebc39268be1b0c778. Build workflow:https://github.com/amerfathi/khodar-pos/actions/runs/37192819553 passed.

Production Web:https://khodar-pos.pages.dev, deployment:https://d6d5e52a.khodar-pos.pages.dev.
Immutable native release:https://github.com/amerfathi/khodar-pos/releases/tag/v2.6.14, published2026-10-04T09:59:06Z.

All3 GitHub asset digests/sizes match the verified CI artifacts. APK SHA256699b4dbe89a67c01442f2eb3cab53d2b4e8f1e4de0cb53922f60f4cd89cd836c; Windows installer SHA25699bd73cde6d35ce7dd8a8f44b3a85fed60b52cfc7e47e6696c7185e815205086; manifest SHA2568491e30ca4f36b364736f96313fbb27ce23c027b028ce524d921793bc68816c9.

Local Windows upload was interrupted after prolonged delay; no installer change or rebuild was made. Verified-build uploader consumes only successful trusted Production release/main artifacts bound to the exact producing source and version; it verifies pinned manifest/signature/file hash and refuses overwrites. Deliberately mismatched version test on the QA topic branch failed validation and skipped the privileged upload job (run37193798716). Correct upload run37193814889 passed and retained the draft until local public-asset digest verification and explicit publication.

D1 Web/Windows/Android update metadata advertises2.6.14. Public latest-release checks from2.6.13 returned available=true, all download HEAD requests200, and the returned Windows manifest signature verified. The user's installed Windows app was not upgraded during these tests.
