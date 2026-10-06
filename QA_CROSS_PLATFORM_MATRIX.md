# QA CROSS-PLATFORM COMPATIBILITY MATRIX — BRRAKA POS v2.6.1

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](README.md) و[فهرس الوثائق](docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.

**Platforms Covered**:
1. **Web**: Progressive Web App running on modern evergreen browsers (Chrome, Edge, Safari, Firefox).
2. **Desktop**: Native Windows 64-bit Electron executable (`KhodarPOS-Setup.exe`).
3. **Android**: Native Capacitor mobile package (`com.khodar.pos`) with custom viewport and touch tuning.

---

## 1. Feature Parity Matrix

| Feature / Capability | Web (SaaS) | Desktop (Electron) | Android (Capacitor) | Parity Status |
|---|:---:|:---:|:---:|:---:|
| **Full Point of Sale & Tare** | Supported | Supported | Supported (Responsive Touch) | **100% PARITY** |
| **Numeric Keypad & Quick Tiles**| Supported | Supported | Supported (Virtual Keyboard Adapt) | **100% PARITY** |
| **Thermal Receipt Printing** | System Dialog | Direct / ESC-POS Spool | Android Print Service / Bluetooth | **100% PARITY** |
| **Official A4 Tax Invoices** | Print to PDF | Print to PDF | Print Intent | **100% PARITY** |
| **Real-Time D1 Cloud Sync** | Supported | Supported | Supported | **100% PARITY** |
| **Offline Transaction Buffering**| Supported | Supported | Supported | **100% PARITY** |
| **Granular RBAC Permission Locks**| Supported | Supported | Supported | **100% PARITY** |
| **Multi-Branch Inventory & Transfer**| Supported | Supported | Supported | **100% PARITY** |
| **Worker Payroll & Advance Ledger**| Supported | Supported | Supported | **100% PARITY** |
| **Customer & Supplier Portals** | Supported | Supported | Supported | **100% PARITY** |
| **Reports Center (6 Cards)** | Supported | Supported | Supported | **100% PARITY** |
| **Automatic In-App Updates** | SW Cache Update | In-App Silent NSIS Downloader | Play Store / In-App APK Intent | **PLATFORM-NATIVE** |
| **Hardware Back Button Handling**| Browser Navigation| Window Keybindings (F5/F11) | Native Hardware / Gesture Back | **PLATFORM-NATIVE** |
| **Window Frame Styling** | Browser Tabs | Seamless Frameless Custom Bar | Edge-to-Edge Safe Areas | **PLATFORM-NATIVE** |

---

## 2. Platform Specific Defect Audit

| Platform | Audit Focus | Verified Condition | Outcome |
|---|---|---|:---:|
| **Desktop** | Custom Window Dragging | Titlebar has `-webkit-app-region: drag`, buttons have `no-drag` | **VERIFIED** |
| **Desktop** | In-App NSIS Updater | Background stream download with SHA/size verification | **VERIFIED** |
| **Android** | Hardware Back Button | Closes active modals $\to$ Returns to Home $\to$ Exits app | **VERIFIED** |
| **Android** | Keyboard Overlap | Inputs auto-scroll into view above soft keyboard | **VERIFIED** |
| **Web** | Responsive Typography | Global slider dynamically modifies root font scale (80%-130%) | **VERIFIED** |
