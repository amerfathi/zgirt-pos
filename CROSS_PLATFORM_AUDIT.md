# Cross-platform — 2026-09-22

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](README.md) و[فهرس الوثائق](docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.
Shared frontend changes apply to Web/Electron/Capacitor source, but shared source is NOT proof of native behavior.
API resolver now keeps ordinary localhost Web development on its own origin, supports VITE_API_BASE_URL, and preserves production origin fallback for packaged native clients. Override permits HTTPS or loopback HTTP only; never send test requests to live production by default.
Electron: webSecurity/sandbox/contextIsolation enabled, node integration disabled, privileged update flow verifies signed manifest, trusted URL, version, exact size and SHA-256. Cryptographic helper tests PASS; complete IPC/download/install/navigation/CSP review remains open. Pinned production public key/signing pipeline absent.
Android: release signing is externalized; release without credentials fails. Compromised historical key not rotated. No verified clean release build/install/upgrade.
Web production build passes; main chunk about 1.14 MB (258 KB gzip). No measured native performance, UI navigation or six-direction device sync tests.
