# RBAC Matrix & Access Control Verification — v2.6.0

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](../README.md) و[فهرس الوثائق](../docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.
**Product**: Baraka / Khodar-POS (سوق الخضار الذكي)  
**Date**: September 19, 2026  
**Status**: VERIFIED & HARDENED

---

## 1. Executive Summary
During the Final Production Gate review, an audit of the Role-Based Access Control (RBAC) identified an architectural nuance: while UI navigation elements (`DesktopSidebar.jsx`, `BottomNav.jsx`) accurately respected and hid unauthorized tabs, direct navigation via query parameters (`?tab=...`) was previously unblocked in the main routing tree (`App.jsx`). 

This has been **formally patched and enforced at both the presentation level and runtime routing layer**, ensuring zero unauthorized access or data leakage for non-privileged roles (e.g., cashiers attempting to open financial audits, reports, or system settings).

---

## 2. Definitive RBAC Permission Matrix

| Module / Feature / Route | Required Permission | `super_admin` | `company_owner` / `admin` | `cashier` | `accountant` | `inventory_manager` | Custom Role |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Point of Sale (`sale`)** | `canSell` | ✅ | ✅ | ✅ (Default) | ✅ (Default) | ❌ | Configurable |
| **Invoice History (`invoices`)** | `canViewInvoices` | ✅ | ✅ | ✅ (Default) | ✅ (Default) | ✅ (Default) | Configurable |
| **Customers & Receivables (`customers`)** | `canManageCustomers` | ✅ | ✅ | ✅ (Default) | ✅ (Default) | ❌ | Configurable |
| **Purchases & Suppliers (`purchases`)** | `canManagePurchases` | ✅ | ✅ | ❌ | ✅ (Default) | ✅ (Default) | Configurable |
| **Inventory & Pricing (`products`)** | `canManageInventory` | ✅ | ✅ | ❌ | ✅ (Default) | ✅ (Default) | Configurable |
| **Damaged / Spoilage (`damaged`)** | `canManageInventory` | ✅ | ✅ | ❌ | ✅ (Default) | ✅ (Default) | Configurable |
| **Expenses Management (`expenses`)** | `canManageExpenses` | ✅ | ✅ | ❌ | ✅ (Default) | ❌ | Configurable |
| **Staff & Payroll (`workers`)** | `canManagePayroll` | ✅ | ✅ | ❌ | ✅ (Default) | ❌ | Configurable |
| **Cash Drawer & Audit (`audit`)** | `canViewFinance` | ✅ | ✅ | ❌ | ✅ (Default) | ❌ | Configurable |
| **Partners Equity & Draw (`partners`)**| `canViewFinance` | ✅ | ✅ | ❌ | ✅ (Default) | ❌ | Configurable |
| **Official A4 Reports (`reports`)** | `canViewFinance` | ✅ | ✅ | ❌ | ✅ (Default) | ❌ | Configurable |
| **System Settings (`settings`)** | `canAccessSettings` | ✅ | ✅ | ❌ | ❌ | ❌ | Configurable |
| **Super Admin Portal (`superadmin`)** | Global / Super role | ✅ | ❌ | ❌ | ❌ | ❌ | Denied |
| **Branch Management** | Tenant Owner / Super | ✅ | ✅ | ❌ | ❌ | ❌ | Denied |

---

## 3. Enforcement Mechanisms

### A. Route Guarding (`src/App.jsx`)
Direct URL manipulation (e.g., appending `?tab=settings` or `?tab=audit`) evaluates `store.hasPermission(TAB_PERMISSION_MAP[currentTab])` prior to rendering any DOM tree.
- If unauthorized, an **Access Denied** interface is rendered with a fallback redirect to the highest permitted tab (`sale` or `home`).
- State-change listener continuously verifies that if role credentials change or are downgraded mid-session, unauthorized views are instantly dismounted.

### B. Navigation Visibility (`DesktopSidebar.jsx` & `BottomNav.jsx`)
- Sidebar categories and individual navigation items are filtered out dynamically using `checkPermission(tab.id)`.
- Empty groups whose child tabs are all forbidden to the active user are omitted from rendering.

### C. Backend API Isolation (`functions/api/users/index.js`)
- `PATCH /api/users`: Mandates `tenantId` match, preventing cross-tenant role elevation.
- `DELETE /api/users`: Mandates `tenantId` match and blocks self-deletion of active user.
- Password hashes and critical secrets are stripped from response payloads.

---

## 4. Verification Test Results
Execution script: `scripts/run_final_production_gate.mjs`
- **Cashier Access**: Blocked across all 8 administrative tabs (`settings`, `audit`, `reports`, `partners`, `expenses`, `workers`, `purchases`, `products`).
- **Explicit Override Validation**: Verified that granting `canManageExpenses` dynamically to a cashier grants access solely to `expenses` while keeping `settings` and other modules locked.
- **Result**: **PASS (100% verified)**.
