# QA DEFECT REGISTER — BRRAKA POS v2.6.1

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](README.md) و[فهرس الوثائق](docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.

**Last Updated**: 2026-09-20  
**Defect Severity Scale**:
- `CRITICAL`: Immediate financial corruption, data loss, or total authorization bypass.
- `HIGH`: Major feature failure, cross-tenant data leak, or sync breakdown.
- `MEDIUM`: Inconsistent report logic, UI glitch under edge conditions, or missing validation.
- `LOW`: Cosmetic issue, minor localization gap, or non-blocking UX anomaly.

---

## Active & Historical Defect Log

| Defect ID | Severity | Category | Target Component | Description | Status |
|---|:---:|---|---|---|:---:|
| **SEC-DEF-001** | **CRITICAL** | Security | `functions/api/tenants/index.js` | Open `/api/tenants` API allows unauthenticated listing, creation, modification, and deletion of customer tenants. | **OPEN (FIX REQUIRED)** |
| **SEC-DEF-002** | **HIGH** | Security | `functions/api/users/index.js` | `/api/users` endpoints accept unauthenticated DELETE / PATCH requests without validating caller credentials or session token. | **OPEN (FIX REQUIRED)** |
| **ACC-DEF-003** | **CRITICAL** | Accounting | `src/store/useAppStore.js` | Worker advance treated as operating expense in P&L, and salaries double deducted from cash drawer. | **FIXED & RE-VERIFIED** |
| **ACC-DEF-004** | **HIGH** | Accounting | `src/store/useAppStore.js` | Deleting worker transaction left orphaned expense records and failed to reverse advance balance. | **FIXED & RE-VERIFIED** |
| **REP-DEF-005** | **MEDIUM** | Reporting | `src/components/PartnersEquityView.jsx` | Partner equity cards omitted founding initial capital contribution. | **FIXED & RE-VERIFIED** |
| **REP-DEF-006** | **HIGH** | Reporting | `src/components/SaleScreen.jsx` | Invoices lacked frozen `costPerKg` snapshot; historical COGS distorted upon future catalog price shifts. | **FIXED & RE-VERIFIED** |
| **XPL-DEF-007** | **HIGH** | Cross-Platform | `src/config/appVersion.js` | Relative `/api` URLs failed on Android Capacitor (`http://localhost`) and Desktop Electron (`file://`). | **FIXED & RE-VERIFIED** |
| **SYN-DEF-008** | **HIGH** | Sync Engine | `src/services/cloudflareSync.js` | Pulled sync events from cloud discarded due to missing update callback in `startAutoSync`. | **FIXED & RE-VERIFIED** |
| **SYN-DEF-009** | **HIGH** | Sync Engine | `src/store/useAppStore.js` | Outbound synchronization omitted customer payments, expenses, damaged items, supplier payments, purchases, returns. | **FIXED & RE-VERIFIED** |

---

## Detailed Defect Records

### DEFECT SEC-DEF-001: Open Unauthenticated `/api/tenants` CRUD Gate
- **Severity**: **CRITICAL**
- **Impact**: Anyone with curl / browser access can issue `GET /api/tenants` to list all customer tenants, or `DELETE /api/tenants?id=xxx` to delete a paying customer's entire account from Cloudflare D1.
- **Root Cause**: `functions/api/tenants/index.js` has no authorization middleware checking a master secret or admin JWT.
- **Required Fix**:
  1. Add header authorization validation `Authorization: Bearer <SUPER_ADMIN_SECRET>` or master password check.
  2. Protect `GET`, `POST`, `PATCH`, and `DELETE`.

### DEFECT SEC-DEF-002: Unauthenticated `/api/users` Mutation
- **Severity**: **HIGH**
- **Impact**: Any user knowing another tenant's `tenantId` can invoke `PATCH /api/users` or `DELETE /api/users?id=...&tenantId=...` to hijack or drop employee accounts.
- **Root Cause**: Query parameters `tenantId` and `id` are used without verifying the request comes from an authenticated tenant owner or admin.
- **Required Fix**: Require tenant authorization token or signature in headers.
