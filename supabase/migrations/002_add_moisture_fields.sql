-- 新增水分計完整欄位 (對照三久 MODBUS R2 文件)

ALTER TABLE rhm_moisture_status
  ADD COLUMN IF NOT EXISTS moisture_setting_tiny SMALLINT,
  ADD COLUMN IF NOT EXISTS measurement_trigger TEXT,
  ADD COLUMN IF NOT EXISTS measurement_mode TEXT,
  ADD COLUMN IF NOT EXISTS has_measured_since_bootup BOOLEAN,
  ADD COLUMN IF NOT EXISTS auto_led BOOLEAN,
  ADD COLUMN IF NOT EXISTS display_value SMALLINT,
  ADD COLUMN IF NOT EXISTS distribution_sample_size SMALLINT;
