# Brraka Reference Reality Audit & Lessons Learned for ZGIRT

**Project:** ZGIRT — زقيرت (Independent Tobacco Retail & Wholesale POS Platform)  
**Reference Examined:** `khodar-pos` (`amerfathi/khodar-pos`)  
**Status:** READ-ONLY REFERENCE AUDIT COMPLETED  
**Date:** 2026-10-06  

---

## 1. Executive Summary & Core Mandate

The existing Brraka codebase was developed for grocery/produce retail (`khodar-pos`), evolving through multiple production iterations to solve hard real-world problems: multi-tenant security, offline-first operation, causal sync conflicts, cash drawer drift, and cross-platform distribution.

ZGIRT is **NOT** a clone of Brraka. ZGIRT is a purpose-built commercial platform for **cigarette and tobacco retail and wholesale stores**, designed from zero with a clean monorepo architecture, distinct product identity, dedicated Cloudflare resources (`zgirt_pos_production`), and an independent GitHub repository (`amerfathi/zgirt-pos`).

This audit records the architectural findings, classifies components for ZGIRT, and documents lessons learned to avoid past pitfalls.

---

## 2. Brraka Subsystem Audit & Classification

| Subsystem | Brraka Implementation | Evaluation / Findings | ZGIRT Strategy | Classification |
| :--- | :--- | :--- | :--- | :--- |
| **Monorepo / Project Layout** | Single root folder mixing web, electron, android, cloudflare functions | Functional but entangled; hard to isolate domain logic and test headless | Modern Monorepo / structured workspace (`packages/core`, `apps/web`, `apps/desktop`, `apps/mobile`, `workers/api`) | **REDESIGN** |
| **Product & Unit Hierarchy** | Flat produce model: `stock_kg`, `sell_price`, `buy_price`, simple units | Cigarette/tobacco domain requires: Carton -> Pack -> Piece hierarchy, wholesale vs retail tiers, barcode per unit level, quantity breaks | Brand / Tobacco hierarchy with configurable packaging multipliers (`units_per_pack`, `packs_per_carton`), barcode mapping, multi-tier pricing | **REDESIGN** |
| **Backend & Cloud Architecture** | Cloudflare Pages Functions + D1 + Durable Objects (`braka-password-crypto`) | Pages functions work well with D1. DO for bcrypt was used due to CPU limits; modern WebCrypto (PBKDF2/Argon2/Scrypt via WebCrypto SubtleCrypto) can be native & fast | Cloudflare Worker / Pages API + D1 + R2 backups, pure WebCrypto SubtleCrypto PBKDF2/SHA-256 (no DO dependency required for auth) | **PORT CAREFULLY & IMPROVE** |
| **Authentication & RBAC** | Bearer tokens hashed with SHA-256 in `sessions` table; `tenants` + `users` tables; granular `permissions_json` | Very solid tenant validation, role presets (`company_owner`, `admin`, `cashier`, etc.), session revocation | Port the secure Bearer token hash architecture and tenant isolation checks, enhance with tobacco domain permissions (`wholesaleDiscount`, `costView`, `cartonBreak`) | **PORT CAREFULLY** |
| **Tenant & Branch Isolation** | Rigorous tenant verification on every endpoint; triggers preventing tenant crossing; `branches_limit_before_insert` | Excellent. Server rejects requests if tenant mismatch or token invalid. DB triggers prevent branch count overflow | Reuse concept and D1 foreign key cascaded isolation. Strict `tenant_id` on every query | **REUSE CONCEPT** |
| **POS Transaction Flow & Atomicity** | `atomicStore.js` with client-side optimistic apply and queued sync mutations; financial events tied to cash shifts | Solid atomicity principles; prevents inventory or financial drift | Build deterministic transaction pipeline in `@zgirt/core`: Atomic cart calculate -> stock deduction -> invoice creation -> cash/debt posting -> audit trail | **PORT CAREFULLY & CLEAN** |
| **Cash Drawer & Treasury** | `cashShiftEngine.js`, `cashDrawerJournal.js`: Cents-based arithmetic, shifts with opening cash, expected cash, variance, device binding | High engineering rigor: integer cents calculation, strict state machines (open/closed/local_closed), actor checks | Adopt integer cents math and shift lifecycle directly. Adapt for tobacco wholesale & retail shifts (cash, pos machine, transfer to treasury) | **PORT CAREFULLY** |
| **Causal Sync & Conflict Policy** | `sync_events_v2` with `conflict_policy_version`, precondition heads (`sync_conflict_heads`), atomic commit groups | State-of-the-art causal conflict tracking. Prevents last-write-wins corruption by asserting precondition state hashes | Port the precondition-based causal sync model with idempotent replay and commit grouping | **PORT CAREFULLY** |
| **Offline-First Storage** | IndexedDB with local replication, sync queue, offline grants | Enabled offline cashier shifts, but complex legacy migrations caused bloat in Brraka | Clean, modern Dexie/idb-based offline store with typed schema, no legacy baggage | **REDESIGN ENGINE, REUSE MODEL** |
| **Wholesale Operations** | Basic customer balance and credit limit in Brraka | Tobacco wholesale is central: carton pricing, tiered discounts, credit terms, partial repayments, customer statements | Purpose-built wholesale workflow: carton/pack pricing, custom wholesale price books, statement generation, credit aging | **REDESIGN / NEW DOMAIN** |
| **Desktop Application** | Electron with custom frameless window, thermal printer support, native update helper | Good printer integration and update verification | Electron wrapper with high-performance IPC, direct ESC/POS thermal printing, and secure updater | **PORT CAREFULLY** |
| **Android Application** | Capacitor 8 + Android Gradle app | Clean cross-platform setup, but UI initially suffered from desktop-first design squeezed into mobile | Mobile-first Capacitor setup with responsive RTL Tailwind layouts designed specifically for handheld POS/scanners | **REDESIGN UI, PORT CAPACITOR** |
| **CI/CD & Testing** | Comprehensive GitHub Actions with security, integration, and accounting audits | Strong testing philosophy: financial reconciliation, branch isolation, and sync durability tests | Create clean GitHub Actions matrix: typecheck, lint, unit tests, financial audit tests, Cloudflare deployment | **PORT CAREFULLY** |

---

## 3. Key Lessons Learned from Brraka's Production History

1. **Floating Point Monetary Errors:** Brraka suffered early issues from float rounding. Fixed by adopting integer cents (`Math.round(amount * 100)`). ZGIRT will enforce integer cents in all domain models from day 1.
2. **Silent Last-Write-Wins Data Loss:** Two cashiers selling the same stock offline or updating the same customer balance concurrently caused silent overwrite. Brraka resolved this with `conflict_policy_version: 1` and precondition vectors (`heads`). ZGIRT inherits this causal precondition system.
3. **Cash Shift / Drawer Discrepancies:** Cashiers could previously enter cash transactions outside an active shift or under another cashier's drawer. The `cashShiftEngine` strictly bound transactions to opened shifts and verified device IDs. ZGIRT keeps this strict rule.
4. **Tenant Data Leakage Vectors:** Never trust `tenant_id` from the payload without matching the authenticated session's `tenant_id`. Every SQL query must bind `auth.principal.tenantId`.
5. **Product Packaging Multipliers:** In grocery, units are kg/gram/piece. In tobacco, units are **Carton (كرتونة) -> Pack (باقة/علبة) -> Piece (سجارة/حبة)**. Multipliers must be rigidly tracked so selling 1 pack reduces inventory by 1 pack, or breaking a carton into 10 packs increases pack stock and reduces carton stock accurately.

---

## 4. ZGIRT Architecture Blueprint

```
zgirt/
├── apps/
│   ├── web/               # React 18/19 + Vite + Tailwind CSS + PWA (Desktop & Mobile optimized)
│   ├── desktop/           # Electron runner with native thermal printer & offline persistence
│   └── mobile/            # Capacitor Android native wrapper with hardware barcode camera support
├── packages/
│   ├── core/              # TypeScript Domain logic: POS engine, wholesale, packaging hierarchy,
│   │                      # integer money, cash drawer state machine, causal sync preconditions
│   └── db/                # D1 Migrations, Schema, and Cloudflare database client
├── workers/
│   └── api/               # Cloudflare Workers / Pages Functions API (Auth, Sync, POS, Reports)
├── docs/                  # Architectural documentation, sync specs, accounting specifications
└── .github/workflows/     # Automated CI/CD (Tests, Security Audit, Cloudflare deployment)
```
