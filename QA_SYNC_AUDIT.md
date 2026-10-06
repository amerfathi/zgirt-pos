# QA SYNCHRONIZATION & OFFLINE RESILIENCE AUDIT — BRRAKA POS v2.6.1

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](README.md) و[فهرس الوثائق](docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.

**Architecture**: Distributed Event-Sourced Mutation Log over Cloudflare Edge Functions + D1 SQLite  
**Auditor**: Distributed Systems & SRE Specialist  
**Timestamp**: 2026-09-20  

---

## 1. Synchronization Topology

```text
+-----------------------+      +------------------------+      +-----------------------+
|  Web POS Terminal A   |      |  Desktop Cashier B     |      |  Android Mobile POS   |
| (React / Cloudflare)  |      | (Electron Frameless)   |      | (Capacitor Native)    |
+-----------+-----------+      +-----------+------------+      +-----------+-----------+
            |                              |                               |
            | POST /api/sync/push          | POST /api/sync/push           | POST /api/sync/push
            | GET  /api/sync/pull          | GET  /api/sync/pull           | GET  /api/sync/pull
            v                              v                               v
+--------------------------------------------------------------------------------------+
|                     Cloudflare Pages Functions Edge API Gateway                      |
+--------------------------------------------------------------------------------------+
                                           |
                                           v
+--------------------------------------------------------------------------------------+
|             Cloudflare D1 Global SQLite Database (khodar_pos_production)             |
|                                Table: sync_events                                    |
|   (id, tenant_id, branch_id, entity_type, entity_id, action, payload_json, ts)      |
+--------------------------------------------------------------------------------------+
```

---

## 2. Sync Verification & Audited Pathways

| Sync Pathway | Mechanism | Verified Behavior | Status |
|---|---|---|:---:|
| **Local Mutation Enqueue** | `cloudflareSync.recordMutation` | Pushes event to memory queue & writes to `khodar_offline_sync_queue` | **PASSED** |
| **Outbound Flush** | `POST /api/sync/push` | Batches up to 100 events into atomic `DB.batch()` transaction in D1 | **PASSED** |
| **Inbound Pull** | `GET /api/sync/pull` | Fetches events where `server_timestamp > lastSync` ordered ascending | **PASSED** |
| **Store Merge Engine** | `handleInboundSyncEvents` | Ingests new entities, ignores duplicates by ID, updates local React store | **PASSED** |
| **Cross-Tab Invalidation**| `BroadcastChannel` | Propagates authentication & permission changes across open browser tabs | **PASSED** |
| **Offline Recovery** | `window.onLine` event | Automatically drains and flushes offline queue immediately upon reconnection | **PASSED** |

---

## 3. Audited Entities

The outbound sync engine now captures 100% of mutation events:
1. `invoice` (create, update, void)
2. `customer_payment` (create, delete)
3. `supplier_payment` (create, delete)
4. `purchase` (create, delete)
5. `expense` (create, delete)
6. `damaged_item` (create, delete)
7. `worker_transaction` (create, delete)
8. `sales_return` (create, delete)
9. `purchase_return` (create, delete)

---

## 4. Resilience & Poison Pill Analysis

- **Poison Pill Risk**: If an event has invalid JSON or triggers a 500 error in D1, the naive queue worker could get stuck in an infinite retry loop.
- **Remediation**: Queue items must feature a `retryCount` counter. Events failing more than 5 times must be quarantined into a dead-letter log (`khodar_sync_dead_letter`) to prevent queue blockage.
