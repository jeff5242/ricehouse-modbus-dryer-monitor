const PREFIX = "rhm_";

export const TABLE = {
  DRYERS: `${PREFIX}dryers`,
  MOISTURE_METERS: `${PREFIX}moisture_meters`,
  DRYER_STATUS: `${PREFIX}dryer_status`,
  MOISTURE_STATUS: `${PREFIX}moisture_status`,
  DRYER_READINGS: `${PREFIX}dryer_readings`,
  MOISTURE_READINGS: `${PREFIX}moisture_readings`,
  ALERTS: `${PREFIX}alerts`,
  DRYING_BATCHES: `${PREFIX}drying_batches`,
} as const;
