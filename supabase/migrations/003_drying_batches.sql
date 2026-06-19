-- 烘乾批次記錄
CREATE TABLE rhm_drying_batches (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dryer_id SMALLINT NOT NULL REFERENCES rhm_dryers(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  initial_moisture NUMERIC(4,1),
  final_moisture NUMERIC(4,1),
  target_moisture NUMERIC(4,1),
  grain_type SMALLINT,
  grain_type_name TEXT,
  duration_minutes INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rhm_drying_batches_dryer ON rhm_drying_batches (dryer_id, started_at DESC);
CREATE INDEX idx_rhm_drying_batches_active ON rhm_drying_batches (dryer_id) WHERE is_active;

ALTER TABLE rhm_drying_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous read" ON rhm_drying_batches FOR SELECT USING (true);
