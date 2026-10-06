CREATE TABLE cash_shift_movements (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_event_id TEXT NOT NULL,
  shift_id TEXT NOT NULL REFERENCES cash_shifts(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  drawer_id TEXT NOT NULL REFERENCES cash_drawers(id),
  accounting_date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id,source_event_id),
  FOREIGN KEY (tenant_id,source_event_id) REFERENCES sync_events_v2(tenant_id,id)
);
CREATE INDEX idx_cash_shift_movements_shift ON cash_shift_movements(tenant_id,shift_id);
CREATE TRIGGER cash_shift_movements_require_open
BEFORE INSERT ON cash_shift_movements
WHEN NOT EXISTS (
  SELECT 1 FROM cash_shifts shift
  JOIN sync_events_v2 event ON event.tenant_id=NEW.tenant_id AND event.id=NEW.source_event_id
  WHERE shift.id=NEW.shift_id AND shift.tenant_id=NEW.tenant_id AND shift.branch_id=NEW.branch_id
    AND shift.drawer_id=NEW.drawer_id AND shift.accounting_date=NEW.accounting_date
    AND shift.status='open' AND event.branch_id=NEW.branch_id
    AND json_extract(event.payload_json,'$.cashShiftId')=NEW.shift_id
)
BEGIN SELECT RAISE(ABORT,'CASH_SHIFT_INVALID_SOURCE'); END;
