# QA EVIDENCE INDEX — BRRAKA POS v2.6.1

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](README.md) و[فهرس الوثائق](docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.

**System**: Brraka POS  
**Repository**: `https://github.com/amerfathi/khodar-pos.git`  
**Live Production URL**: `https://khodar-pos.pages.dev`  
**Live D1 Database ID**: `bf2fbfa3-eb13-4687-ac97-b17740c300de`  
**Timestamp**: 2026-09-20  

---

## 1. Remote Edge & Database Verification Telemetry

### 1.1 Cloudflare Edge Health Check (`/api/health`)
- **HTTP Request**: `GET https://khodar-pos.pages.dev/api/health`
- **HTTP Response Status**: `200 OK`
- **Response Payload**:
  ```json
  {
    "status": "ok",
    "system": "سوق الخضار - كاشير ومحاسبة سحابية",
    "edge": "Cloudflare Pages & Workers",
    "d1Connected": true,
    "version": "2.6.1",
    "timestamp": "2026-09-20T19:30:39.611Z"
  }
  ```
- **Conclusion**: Edge worker isolates running v2.6.1 in global production with direct Cloudflare D1 connectivity.

### 1.2 Remote D1 Production Query Telemetry (Wrangler CLI)
- **Execution Command**:
  ```bash
  npx wrangler d1 execute khodar_pos_production --remote --command="SELECT COUNT(*) as tenant_count FROM tenants; SELECT COUNT(*) as sync_events_count FROM sync_events;"
  ```
- **Result Output**:
  - `tenant_count`: `3` (active tenants)
  - `sync_events_count`: `17` (live distributed mutation events)
  - `sql_duration_ms`: `0.6052 ms` (Read), `0.0874 ms` (Batch)
  - `colo`: `FRA` (Frankfurt primary edge node)

### 1.3 Latest Release Registry Telemetry (`/api/releases/latest`)
- **HTTP Request**: `GET https://khodar-pos.pages.dev/api/releases/latest`
- **HTTP Response Status**: `200 OK`
- **Response Payload**:
  ```json
  {
    "platform": "web",
    "currentVersion": "1.0.0",
    "latestVersion": "2.6.1",
    "minimumVersion": "2.2.0",
    "isUpdateAvailable": true,
    "isRequired": true,
    "updateType": "required",
    "releaseNotes": [
      "مركز تقارير استراتيجي بتصميم بطاقات تنفيذية موحدة",
      "إضافة تقارير الأرباح والهوامش وأعمار الديون والوردية وحساب الموردين",
      "تحسينات عامة على واجهة وتجربة المستخدم"
    ],
    "downloadUrl": "https://khodar-pos.pages.dev"
  }
  ```

---

## 2. Automated Regression Test Outputs

### 2.1 Accounting Audit Suite
```text
====================================================
  BRRAKA POS v2.6.1 - ACCOUNTING AUDIT TEST SUITE   
====================================================

[PASS] Test 1: Worker Advance must NOT affect P&L or double-deduct from Cash
[PASS] Test 2: Worker Salary Payment must be deducted once from Cash & once from P&L
[PASS] Test 3: Deleting a worker advance restores currentAdvance and reverses balance
[PASS] Test 4: Partner Equity must equal Initial Capital + Share of Profit - Drawings
[PASS] Test 5: Invoice item must lock costPerKg at sale creation time
[PASS] Test 6: Inbound sync events must merge cleanly without duplicates
[PASS] Test 7: API Base URL resolver points to Cloudflare production in WebView and Desktop environments

Results: 7/7 Tests Passed successfully.
ALL ACCOUNTING INTEGRITY CHECKS PASSED PERFECTLY!
```

### 2.2 Comprehensive QA & Edge Case Suite
```text
================================================================
  BRRAKA POS v2.6.1 - MASTER COMPREHENSIVE QA AUTOMATION SUITE  
================================================================

[PASS] PREC-001: Money precision avoids cumulative floating-point drift (0.1 + 0.2 problem)
[PASS] PREC-002: Tare weight calculation rounds cleanly to 2 or 3 decimals
[PASS] POS-E2E-001: Sale checkout decrements stock, creates invoice, locks COGS, updates cash
[PASS] INV-VOID-001: Voiding completed invoice restores stock and deducts refunded cash
[PASS] CUST-AR-001: Credit sale increments customer balance; partial payment reduces it
[PASS] SUPP-AP-001: Wholesale credit purchase increments supplier payable; cash payment settles it
[PASS] WRK-ACC-001: Worker advance is an asset receivable, while salary is an operating expense
[PASS] EQT-MATH-001: Partner Equity = Initial Capital + (Net Profit * share %) - Drawings
[PASS] IDEMP-001: Duplicate mutation execution leaves state deterministic and non-duplicated
[PASS] XPL-RES-001: API resolver defaults to authoritative Cloudflare edge for mobile & desktop

================================================================
  COMPREHENSIVE QA EXECUTION SUMMARY: 10/10 PASSED  
================================================================
```

---

## 3. Production Build Artifact Output
```text
✓ 2052 modules transformed.
dist/index.html                           1.48 kB │ gzip:   0.76 kB
dist/assets/brraka-icon-rCenJBDL.png    294.55 kB
dist/assets/index-BHMItBRj.css           75.12 kB │ gzip:  12.44 kB
dist/assets/web-5O8BFAz6.js               0.84 kB │ gzip:   0.40 kB
dist/assets/index-BQji3vTr.js         1,152.75 kB │ gzip: 260.18 kB
✓ built in 5.00s
```
