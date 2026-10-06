# ZGIRT System Architecture

## Overview
ZGIRT (زقيرت) is an enterprise retail and wholesale Point of Sale, inventory, and accounting platform purpose-built for tobacco and cigarette operations.

## Technology Stack
- **Domain Core**: Pure deterministic JavaScript/TypeScript (`@zgirt/core`) with integer-cents arithmetic and packaging hierarchy normalization.
- **Frontend**: React 18, Vite, Tailwind CSS, Arabic RTL-first UI design system, PWA.
- **Cloud Backend**: Cloudflare Workers (`zgirt-api`), Cloudflare D1 SQLite Database (`zgirt_pos_production`), Cloudflare Pages (`zgirt-pos-web-app`).
- **Desktop**: Electron runner with direct thermal printing bridge.
- **Mobile**: Capacitor 8 wrapper for handheld Android barcode scanners.

## Key Subsystems
1. **Packaging Hierarchy**: Configurable Cartons -> Packs -> Pieces conversion matrices.
2. **Double-Entry Cash Shifts**: Mathematical tracking of expected cash, counted cash, and variance.
3. **Causal Precondition Sync**: Vector clocks/heads verifying state consistency before commits.
4. **Tenant Isolation**: Database level foreign key cascades and server-side tenant binding on every query.
