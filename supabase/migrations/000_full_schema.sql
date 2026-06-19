-- ============================================
-- 稻穀烘乾機監控系統 - 完整資料庫 Schema
-- 表格前綴: rhm_ (ricehouse monitor)
-- 一次執行版本 (001 + 002 合併)
-- ============================================

-- 乾燥機設備清單
CREATE TABLE rhm_dryers (
  id SMALLINT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  model_code SMALLINT,
  model_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 水分計設備清單
CREATE TABLE rhm_moisture_meters (
  id SMALLINT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  dryer_id SMALLINT REFERENCES rhm_dryers(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 乾燥機即時狀態 (每次輪詢覆蓋)
CREATE TABLE rhm_dryer_status (
  dryer_id SMALLINT PRIMARY KEY REFERENCES rhm_dryers(id),
  is_online BOOLEAN NOT NULL DEFAULT false,
  status_code SMALLINT NOT NULL DEFAULT 255,
  status_name TEXT NOT NULL DEFAULT '未知',
  hot_air_temp SMALLINT,
  set_temp SMALLINT,
  error_code SMALLINT NOT NULL DEFAULT 0,
  error_name TEXT,
  timer_set_hours SMALLINT,
  timer_set_minutes SMALLINT,
  timer_display_hours SMALLINT,
  timer_display_minutes SMALLINT,
  rs485_error_count SMALLINT DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 水分計即時狀態 (每次輪詢覆蓋)
CREATE TABLE rhm_moisture_status (
  meter_id SMALLINT PRIMARY KEY REFERENCES rhm_moisture_meters(id),
  moisture_setting NUMERIC(4,1),
  moisture_setting_tiny SMALLINT,
  grain_type SMALLINT,
  grain_type_name TEXT,
  mode TEXT,
  control_source TEXT,
  grain_temp SMALLINT,
  error_code SMALLINT NOT NULL DEFAULT 0,
  error_name TEXT,
  last_moisture_value NUMERIC(4,1),
  last_measurement_grain TEXT,
  last_measurement_time TIMESTAMPTZ,
  measurement_interval SMALLINT,
  measurement_trigger TEXT,
  measurement_mode TEXT,
  has_measured_since_bootup BOOLEAN,
  auto_led BOOLEAN,
  display_value SMALLINT,
  distribution_sample_size SMALLINT,
  dist_09_11 SMALLINT DEFAULT 0,
  dist_11_13 SMALLINT DEFAULT 0,
  dist_13_15 SMALLINT DEFAULT 0,
  dist_15_17 SMALLINT DEFAULT 0,
  dist_17_19 SMALLINT DEFAULT 0,
  dist_19_21 SMALLINT DEFAULT 0,
  dist_21_23 SMALLINT DEFAULT 0,
  dist_23_25 SMALLINT DEFAULT 0,
  dist_25_27 SMALLINT DEFAULT 0,
  dist_27_29 SMALLINT DEFAULT 0,
  dist_29_31 SMALLINT DEFAULT 0,
  dist_31_33 SMALLINT DEFAULT 0,
  dist_33_35 SMALLINT DEFAULT 0,
  dist_35_37 SMALLINT DEFAULT 0,
  dist_37_40 SMALLINT DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 歷史紀錄 (用於趨勢圖)
CREATE TABLE rhm_dryer_readings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dryer_id SMALLINT NOT NULL REFERENCES rhm_dryers(id),
  status_code SMALLINT,
  hot_air_temp SMALLINT,
  set_temp SMALLINT,
  error_code SMALLINT DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rhm_moisture_readings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  meter_id SMALLINT NOT NULL REFERENCES rhm_moisture_meters(id),
  moisture_value NUMERIC(4,1),
  grain_temp SMALLINT,
  grain_type SMALLINT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 告警紀錄
CREATE TABLE rhm_alerts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_type TEXT NOT NULL CHECK (device_type IN ('dryer', 'moisture_meter')),
  device_id SMALLINT NOT NULL,
  alert_type TEXT NOT NULL,
  error_code SMALLINT,
  message TEXT NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- 索引
CREATE INDEX idx_rhm_dryer_readings_dryer_time ON rhm_dryer_readings (dryer_id, recorded_at DESC);
CREATE INDEX idx_rhm_moisture_readings_meter_time ON rhm_moisture_readings (meter_id, recorded_at DESC);
CREATE INDEX idx_rhm_alerts_unresolved ON rhm_alerts (is_resolved, created_at DESC) WHERE NOT is_resolved;

-- 初始化 10 台乾燥機 + 10 台水分計
INSERT INTO rhm_dryers (id, name) VALUES
  (1, '1號機'), (2, '2號機'), (3, '3號機'), (4, '4號機'), (5, '5號機'),
  (6, '6號機'), (7, '7號機'), (8, '8號機'), (9, '9號機'), (10, '10號機');

INSERT INTO rhm_moisture_meters (id, name, dryer_id) VALUES
  (1, '1號水分計', 1), (2, '2號水分計', 2), (3, '3號水分計', 3),
  (4, '4號水分計', 4), (5, '5號水分計', 5), (6, '6號水分計', 6),
  (7, '7號水分計', 7), (8, '8號水分計', 8), (9, '9號水分計', 9),
  (10, '10號水分計', 10);

INSERT INTO rhm_dryer_status (dryer_id) VALUES
  (1), (2), (3), (4), (5), (6), (7), (8), (9), (10);

INSERT INTO rhm_moisture_status (meter_id) VALUES
  (1), (2), (3), (4), (5), (6), (7), (8), (9), (10);

-- 啟用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE rhm_dryer_status;
ALTER PUBLICATION supabase_realtime ADD TABLE rhm_moisture_status;
ALTER PUBLICATION supabase_realtime ADD TABLE rhm_alerts;

-- RLS (Row Level Security)
ALTER TABLE rhm_dryers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhm_moisture_meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhm_dryer_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhm_moisture_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhm_dryer_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhm_moisture_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhm_alerts ENABLE ROW LEVEL SECURITY;

-- 允許匿名讀取 (PWA 前端)
CREATE POLICY "Allow anonymous read" ON rhm_dryers FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read" ON rhm_moisture_meters FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read" ON rhm_dryer_status FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read" ON rhm_moisture_status FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read" ON rhm_dryer_readings FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read" ON rhm_moisture_readings FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read" ON rhm_alerts FOR SELECT USING (true);

-- 允許 service_role 完整存取 (Vercel cron job 用)
CREATE POLICY "Allow service write" ON rhm_dryers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write" ON rhm_moisture_meters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write" ON rhm_dryer_status FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write" ON rhm_moisture_status FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write" ON rhm_dryer_readings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write" ON rhm_moisture_readings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write" ON rhm_alerts FOR ALL USING (true) WITH CHECK (true);
