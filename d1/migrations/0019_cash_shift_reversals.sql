ALTER TABLE cash_shift_movements ADD COLUMN reverses_source_event_id TEXT;
CREATE UNIQUE INDEX idx_cash_shift_single_reversal
  ON cash_shift_movements(tenant_id,reverses_source_event_id)
  WHERE reverses_source_event_id IS NOT NULL;
