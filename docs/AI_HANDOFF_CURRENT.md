# ZGIRT AI Handoff & Current Project State

## 1. Project Identity & Git
- **Project Name:** ZGIRT — زقيرت
- **Domain:** Tobacco & Cigarette Retail & Wholesale POS Platform
- **GitHub Repository:** `amerfathi/zgirt-pos`
- **Current Branch:** `main`
- **Release Version:** `v1.0.0`

## 2. Cloudflare Infrastructure Provisioned
- **API Worker:** `https://zgirt-api.amerfathi123.workers.dev` (Active & Healthy)
- **Web App (Pages):** `https://zgirt-pos-web-app.pages.dev` (Active & Serving)
- **D1 Database:** `zgirt_pos_production` (UUID: `a7308bf3-0d14-441f-97b2-16371850d5a3`)
- **Region:** `EEUR`

## 3. Core Monorepo Layout
- `packages/core`: Pure domain logic (money, packaging hierarchy, cashShift engine, syncPolicy, posEngine)
- `packages/db`: D1 SQL migrations (initial schema 0001 applied remotely)
- `workers/api`: Cloudflare Worker REST API with WebCrypto auth, tenant checks, sales posting, and reports
- `apps/web`: React 18 + Tailwind CSS RTL POS interface (Retail & Wholesale modes, carton/pack quick selectors)
- `apps/desktop`: Electron wrapper with thermal printer bridge
- `apps/mobile`: Capacitor configuration for Android
- `tests`: Automated suite covering accounting consistency, causal sync, and tenant isolation

## 4. Verification Evidence
- Financial consistency test passed with 0 variance.
- Causal sync conflict test verified (stale client rejected on concurrent edit).
- Tenant isolation verified (cross-tenant access rejected).
- Live health endpoint responds `{"status":"ok","product":"ZGIRT POS"}`.
- Live web frontend serves responsive Arabic RTL POS.
