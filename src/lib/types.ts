export interface DryerStatus {
  dryer_id: number;
  is_online: boolean;
  status_code: number;
  status_name: string;
  hot_air_temp: number | null;
  set_temp: number | null;
  error_code: number;
  error_name: string | null;
  timer_set_hours: number | null;
  timer_set_minutes: number | null;
  timer_display_hours: number | null;
  timer_display_minutes: number | null;
  rs485_error_count: number;
  updated_at: string;
  dryer?: {
    id: number;
    name: string;
    model_name: string | null;
  };
}

export interface MoistureStatus {
  meter_id: number;
  moisture_setting: number | null;
  moisture_setting_tiny: number | null;
  grain_type: number | null;
  grain_type_name: string | null;
  mode: string;
  control_source: string;
  grain_temp: number | null;
  error_code: number;
  error_name: string | null;
  last_moisture_value: number | null;
  last_measurement_grain: string | null;
  measurement_trigger: string | null;
  measurement_mode: string | null;
  last_measurement_time: string | null;
  measurement_interval: number | null;
  has_measured_since_bootup: boolean | null;
  auto_led: boolean | null;
  display_value: number | null;
  dist_09_11: number;
  dist_11_13: number;
  dist_13_15: number;
  dist_15_17: number;
  dist_17_19: number;
  dist_19_21: number;
  dist_21_23: number;
  dist_23_25: number;
  dist_25_27: number;
  dist_27_29: number;
  dist_29_31: number;
  dist_31_33: number;
  dist_33_35: number;
  dist_35_37: number;
  dist_37_40: number;
  distribution_sample_size: number | null;
  updated_at: string;
  moisture_meter?: {
    id: number;
    name: string;
  };
}

export interface Alert {
  id: number;
  device_type: string;
  device_id: number;
  alert_type: string;
  error_code: number | null;
  message: string;
  is_resolved: boolean;
  notified_at: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface DryingBatch {
  id: number;
  dryer_id: number;
  started_at: string;
  ended_at: string | null;
  initial_moisture: number | null;
  final_moisture: number | null;
  target_moisture: number | null;
  grain_type: number | null;
  grain_type_name: string | null;
  duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
}
