# ZGIRT — زقيرت
### Independent Commercial POS, Inventory, Accounting & Wholesale Platform for Tobacco Retailers

![License](https://img.shields.io/badge/license-Proprietary-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-emerald.svg)
![Target](https://img.shields.io/badge/domain-Tobacco%20Retail%20%26%20Wholesale-amber.svg)

---

## 🌟 Overview

**ZGIRT (زقيرت)** is a high-performance, resilient, offline-first Point of Sale, inventory management, multi-branch treasury, and wholesale accounting platform engineered specifically for **cigarette and tobacco merchants**.

Designed with **Arabic RTL as a first-class citizen**, ZGIRT delivers:
- **Fast Barcode & Multi-Tier POS**: Retail and Wholesale workflows with rapid packaging unit switches (Carton / Pack / Piece).
- **Causal Synchronization Engine**: Precondition-based offline sync preventing silent last-write-wins data loss.
- **Double-Entry Cash Drawer & Treasury Integrity**: Integer-cents financial arithmetic eliminating floating-point drift.
- **Cross-Platform Deployments**: Modern Web/PWA, Native Windows Desktop (Electron), and Android Mobile (Capacitor).
- **Cloudflare Serverless Backend**: Powered by Cloudflare Workers/Pages, D1 SQLite database, and R2 secure backups.

---

## 🏛️ Architecture & Packaging Hierarchy

Tobacco retail operates on strict packaging hierarchies:
```
1 Carton (كرتونة)  =  10 Packs (بواكي / علب)  =  200 Pieces (سجائر فردي)
```
ZGIRT tracks physical inventory at the fundamental unit while supporting automated carton breaking, dynamic price breaks, and barcode assignment per packaging level.

---

## 🚀 Quick Start

### 1. Requirements
- Node.js >= 20.x
- npm >= 10.x
- Cloudflare Wrangler CLI (for backend migrations & deploys)

### 2. Installation
```bash
git clone https://github.com/amerfathi/zgirt-pos.git
cd zgirt-pos
npm install
```

### 3. Development
```bash
# Run local Vite web application
npm run dev

# Run Cloudflare D1 local worker backend
npm run worker:dev

# Run Windows Desktop (Electron)
npm run desktop:start
```

### 4. Automated Tests
```bash
npm test
```
All accounting, causal sync, and tenant isolation tests run with deterministic fixtures.

---

## 🔒 Security & Tenant Isolation
ZGIRT operates a multi-tenant database model. All database queries, sync events, and business transactions are isolated by `tenant_id` and signed session tokens with constant-time cryptographic validation.

---

## 📄 License
Proprietary & Confidential. All rights reserved.
