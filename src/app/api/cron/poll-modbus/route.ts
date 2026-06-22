import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import {
  ModbusSession,
  deviceAddress,
  type ModbusConnection,
} from "@/lib/modbus/client";
import {
  MODBUS_DRYER_SLAVE_ID,
  MODBUS_MOISTURE_SLAVE_ID,
  DRYER_DEVICE_SHIFT,
  MOISTURE_DEVICE_SHIFT,
  DRYER_REGISTER_COUNT,
  MOISTURE_REGISTER_COUNT,
  MODBUS_MAX_READ_WORDS,
  RS485_BUS_INTERVAL_MS,
} from "@/lib/modbus/constants";
import { parseDryerRegisters, parseMoistureRegisters } from "@/lib/modbus/parser";
import { sendLineNotify } from "@/lib/line-notify";
import { TABLE } from "@/lib/db-tables";

export const maxDuration = 55;
export const dynamic = "force-dynamic";

const DEVICE_COUNT = 10;
const DRYING_STATUSES = new Set([0x06, 0x07]);
const MOISTURE_APPROACHING_THRESHOLD_PCT = 2.0;

interface StatusTransition {
  deviceId: number;
  oldStatus: number;
  newStatus: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const results = { dryers: 0, moistureMeters: 0, alerts: 0, errors: [] as string[] };

  const { data: prevStatuses } = await supabase
    .from(TABLE.DRYER_STATUS)
    .select("dryer_id, status_code")
    .order("dryer_id");
  const prevStatusMap = new Map(
    (prevStatuses ?? []).map((s) => [s.dryer_id, s.status_code as number])
  );
  const transitions: StatusTransition[] = [];
  const currentDryerStatusMap = new Map<number, number>();

  const conn: ModbusConnection = {
    host: process.env.NPORT_HOST!,
    port: parseInt(process.env.NPORT_DRYER_PORT || "4001"),
  };
  const dryerSlaveId = parseInt(
    process.env.MODBUS_DRYER_SLAVE_ID || String(MODBUS_DRYER_SLAVE_ID)
  );
  const moistureSlaveId = parseInt(
    process.env.MODBUS_MOISTURE_SLAVE_ID || String(MODBUS_MOISTURE_SLAVE_ID)
  );

  const session = new ModbusSession(conn);

  try {
    await session.connect();

    // === 輪詢乾燥機 (Slave 0x01, 位址 00x0H-00x4H) ===
    for (let i = 0; i < DEVICE_COUNT; i++) {
      try {
        const startAddr = deviceAddress(0, i, DRYER_DEVICE_SHIFT);
        const registers = await session.readRegistersWithVote(
          dryerSlaveId,
          startAddr,
          DRYER_REGISTER_COUNT
        );
        const data = parseDryerRegisters(i + 1, registers);

        try {
          const errAddr = deviceAddress(0x0400, i, DRYER_DEVICE_SHIFT);
          const [errVal] = await session.readRegistersWithVote(
            dryerSlaveId,
            errAddr,
            1,
            3
          );
          data.rs485ErrorCount = errVal & 0xff;
        } catch {
          // 非關鍵資料
        }

        await supabase.from(TABLE.DRYER_STATUS).upsert({
          dryer_id: i + 1,
          is_online: data.isOnline,
          status_code: data.statusCode,
          status_name: data.statusName,
          hot_air_temp: data.hotAirTemp,
          set_temp: data.setTemp,
          error_code: data.errorCode,
          error_name: data.errorName,
          timer_set_hours: data.timerSetHours,
          timer_set_minutes: data.timerSetMinutes,
          timer_display_hours: data.timerDisplayHours,
          timer_display_minutes: data.timerDisplayMinutes,
          rs485_error_count: data.rs485ErrorCount,
          updated_at: new Date().toISOString(),
        });

        await supabase.from(TABLE.DRYER_READINGS).insert({
          dryer_id: i + 1,
          status_code: data.statusCode,
          hot_air_temp: data.hotAirTemp,
          set_temp: data.setTemp,
          error_code: data.errorCode,
        });

        const oldStatus = prevStatusMap.get(i + 1) ?? 0xff;
        if (oldStatus !== data.statusCode) {
          transitions.push({
            deviceId: i + 1,
            oldStatus: oldStatus,
            newStatus: data.statusCode,
          });
        }
        currentDryerStatusMap.set(i + 1, data.statusCode);

        if (data.isOnline && data.modelCode > 0) {
          await supabase
            .from(TABLE.DRYERS)
            .update({ model_code: data.modelCode, model_name: data.modelName })
            .eq("id", i + 1);
        }

        if (data.errorCode > 0) {
          await handleAlert(
            supabase,
            "dryer",
            i + 1,
            "error",
            data.errorCode,
            `${i + 1}號乾燥機異常: E-${data.errorCode.toString(16).padStart(2, "0")} ${data.errorName ?? ""}`
          );
          results.alerts++;
        } else {
          await resolveAlerts(supabase, "dryer", i + 1);
        }

        results.dryers++;
      } catch (err) {
        const msg = `乾燥機 ${i + 1}: ${err instanceof Error ? err.message : String(err)}`;
        results.errors.push(msg);

        await supabase
          .from(TABLE.DRYER_STATUS)
          .update({ is_online: false, updated_at: new Date().toISOString() })
          .eq("dryer_id", i + 1);
      }

      await sleep(RS485_BUS_INTERVAL_MS);
    }

    // === 輪詢水分計 (Slave 0x02, 位址 0x00H-0x0FH) ===
    for (let i = 0; i < DEVICE_COUNT; i++) {
      try {
        const baseAddr = deviceAddress(0, i, MOISTURE_DEVICE_SHIFT);

        const batch1 = await session.readRegistersWithVote(
          moistureSlaveId,
          baseAddr,
          MODBUS_MAX_READ_WORDS
        );

        await sleep(RS485_BUS_INTERVAL_MS);

        const batch2 = await session.readRegistersWithVote(
          moistureSlaveId,
          baseAddr + MODBUS_MAX_READ_WORDS,
          MOISTURE_REGISTER_COUNT - MODBUS_MAX_READ_WORDS
        );

        const registers = [...batch1, ...batch2];
        const data = parseMoistureRegisters(i + 1, registers);

        await supabase.from(TABLE.MOISTURE_STATUS).upsert({
          meter_id: i + 1,
          moisture_setting: data.moistureSetting,
          moisture_setting_tiny: data.moistureSettingTiny,
          grain_type: data.grainType,
          grain_type_name: data.grainTypeName,
          mode: data.mode,
          control_source: data.controlSource,
          grain_temp: data.grainTemp,
          error_code: data.errorCode,
          error_name: data.errorName,
          last_moisture_value: data.lastMoistureValue,
          last_measurement_grain: data.lastMeasurementGrain,
          measurement_trigger: data.measurementTrigger,
          measurement_mode: data.measurementMode,
          last_measurement_time: data.lastMeasurementTime?.toISOString() ?? null,
          measurement_interval: data.measurementInterval,
          has_measured_since_bootup: data.hasMeasuredSinceBootup,
          auto_led: data.autoLed,
          display_value: data.displayValue,
          dist_09_11: data.moistureDistribution[0] ?? 0,
          dist_11_13: data.moistureDistribution[1] ?? 0,
          dist_13_15: data.moistureDistribution[2] ?? 0,
          dist_15_17: data.moistureDistribution[3] ?? 0,
          dist_17_19: data.moistureDistribution[4] ?? 0,
          dist_19_21: data.moistureDistribution[5] ?? 0,
          dist_21_23: data.moistureDistribution[6] ?? 0,
          dist_23_25: data.moistureDistribution[7] ?? 0,
          dist_25_27: data.moistureDistribution[8] ?? 0,
          dist_27_29: data.moistureDistribution[9] ?? 0,
          dist_29_31: data.moistureDistribution[10] ?? 0,
          dist_31_33: data.moistureDistribution[11] ?? 0,
          dist_33_35: data.moistureDistribution[12] ?? 0,
          dist_35_37: data.moistureDistribution[13] ?? 0,
          dist_37_40: data.moistureDistribution[14] ?? 0,
          distribution_sample_size: data.distributionSampleSize,
          updated_at: new Date().toISOString(),
        });

        if (data.lastMoistureValue !== null) {
          await supabase.from(TABLE.MOISTURE_READINGS).insert({
            meter_id: i + 1,
            moisture_value: data.lastMoistureValue,
            grain_temp: data.grainTemp,
            grain_type: data.grainType,
          });
        }

        const isDryerActive = DRYING_STATUSES.has(
          currentDryerStatusMap.get(i + 1) ?? 0xff
        );
        if (
          isDryerActive &&
          data.lastMoistureValue !== null &&
          data.moistureSetting !== null
        ) {
          await checkMoistureApproaching(
            supabase,
            i + 1,
            data.lastMoistureValue,
            data.moistureSetting
          );
        }

        if (data.errorCode > 0) {
          await handleAlert(
            supabase,
            "moisture_meter",
            i + 1,
            "error",
            data.errorCode,
            `${i + 1}號水分計異常: E${data.errorCode} ${data.errorName ?? ""}`
          );
          results.alerts++;
        } else {
          await resolveAlerts(supabase, "moisture_meter", i + 1);
        }

        results.moistureMeters++;
      } catch (err) {
        const msg = `水分計 ${i + 1}: ${err instanceof Error ? err.message : String(err)}`;
        results.errors.push(msg);
      }

      await sleep(RS485_BUS_INTERVAL_MS);
    }
  } catch (err) {
    results.errors.push(`TCP 連線失敗: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    session.close();
  }

  await processDryingTransitions(supabase, transitions);

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    ...results,
  });
}

async function resolveAlerts(
  supabase: ReturnType<typeof createServiceClient>,
  deviceType: string,
  deviceId: number
) {
  await supabase
    .from(TABLE.ALERTS)
    .update({ is_resolved: true, resolved_at: new Date().toISOString() })
    .eq("device_type", deviceType)
    .eq("device_id", deviceId)
    .eq("alert_type", "error")
    .eq("is_resolved", false);
}

async function handleAlert(
  supabase: ReturnType<typeof createServiceClient>,
  deviceType: string,
  deviceId: number,
  alertType: string,
  errorCode: number,
  message: string
) {
  const { data: existing } = await supabase
    .from(TABLE.ALERTS)
    .select("id")
    .eq("device_type", deviceType)
    .eq("device_id", deviceId)
    .eq("error_code", errorCode)
    .eq("is_resolved", false)
    .limit(1);

  if (existing && existing.length > 0) return;

  await supabase.from(TABLE.ALERTS).insert({
    device_type: deviceType,
    device_id: deviceId,
    alert_type: alertType,
    error_code: errorCode,
    message,
    notified_at: new Date().toISOString(),
  });

  await sendLineNotify(
    `\n🚨 ${message}\n時間: ${new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`
  );
}

async function processDryingTransitions(
  supabase: ReturnType<typeof createServiceClient>,
  transitions: StatusTransition[]
) {
  for (const t of transitions) {
    const wasDrying = DRYING_STATUSES.has(t.oldStatus);
    const isDrying = DRYING_STATUSES.has(t.newStatus);

    if (!wasDrying && isDrying) {
      try {
        const { data: moisture } = await supabase
          .from(TABLE.MOISTURE_STATUS)
          .select("moisture_setting, last_moisture_value, grain_type, grain_type_name")
          .eq("meter_id", t.deviceId)
          .single();

        await supabase
          .from(TABLE.DRYING_BATCHES)
          .update({ is_active: false, ended_at: new Date().toISOString() })
          .eq("dryer_id", t.deviceId)
          .eq("is_active", true);

        await supabase.from(TABLE.DRYING_BATCHES).insert({
          dryer_id: t.deviceId,
          initial_moisture: moisture?.last_moisture_value ?? null,
          target_moisture: moisture?.moisture_setting ?? null,
          grain_type: moisture?.grain_type ?? null,
          grain_type_name: moisture?.grain_type_name ?? null,
          is_active: true,
        });
      } catch {
        // batch table may not exist yet
      }
    }

    if (wasDrying && !isDrying) {
      await supabase
        .from(TABLE.ALERTS)
        .update({ is_resolved: true, resolved_at: new Date().toISOString() })
        .eq("device_type", "moisture_meter")
        .eq("device_id", t.deviceId)
        .eq("alert_type", "moisture_approaching")
        .eq("is_resolved", false);

      let durationMinutes: number | null = null;
      let finalMoisture: number | null = null;

      try {
        const { data: batch } = await supabase
          .from(TABLE.DRYING_BATCHES)
          .select("id, started_at")
          .eq("dryer_id", t.deviceId)
          .eq("is_active", true)
          .order("started_at", { ascending: false })
          .limit(1)
          .single();

        if (batch) {
          const { data: moisture } = await supabase
            .from(TABLE.MOISTURE_STATUS)
            .select("last_moisture_value")
            .eq("meter_id", t.deviceId)
            .single();

          finalMoisture = moisture?.last_moisture_value ?? null;
          const durationMs = Date.now() - new Date(batch.started_at).getTime();
          durationMinutes = Math.round(durationMs / 60000);

          await supabase
            .from(TABLE.DRYING_BATCHES)
            .update({
              is_active: false,
              ended_at: new Date().toISOString(),
              final_moisture: finalMoisture,
              duration_minutes: durationMinutes,
            })
            .eq("id", batch.id);
        }
      } catch {
        // batch table may not exist yet
      }

      const isComplete = t.newStatus === 0x0a || t.newStatus === 0x08;
      if (isComplete) {
        if (finalMoisture === null) {
          const { data: moisture } = await supabase
            .from(TABLE.MOISTURE_STATUS)
            .select("last_moisture_value")
            .eq("meter_id", t.deviceId)
            .single();
          finalMoisture = moisture?.last_moisture_value ?? null;
        }

        const now = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
        let msg = `\n✅ ${t.deviceId}號乾燥機烘乾完成！`;

        if (durationMinutes !== null) {
          const hours = Math.floor(durationMinutes / 60);
          const mins = durationMinutes % 60;
          const timeStr = hours > 0 ? `${hours}小時${mins}分` : `${mins}分鐘`;
          msg += `\n烘乾時間: ${timeStr}`;
        }

        if (finalMoisture !== null) {
          msg += `\n最終水分: ${finalMoisture}%`;
        }

        msg += `\n完成時間: ${now}`;

        await sendLineNotify(msg);

        const alertMsg = `${t.deviceId}號乾燥機烘乾完成` +
          (finalMoisture !== null ? `，最終水分 ${finalMoisture}%` : "");

        await supabase.from(TABLE.ALERTS).insert({
          device_type: "dryer",
          device_id: t.deviceId,
          alert_type: "drying_complete",
          error_code: 0,
          message: alertMsg,
          notified_at: new Date().toISOString(),
        });
      }
    }
  }
}

async function checkMoistureApproaching(
  supabase: ReturnType<typeof createServiceClient>,
  deviceId: number,
  moistureValue: number,
  moistureSetting: number
) {
  if (moistureValue <= moistureSetting) return;

  const gap = moistureValue - moistureSetting;
  if (gap > MOISTURE_APPROACHING_THRESHOLD_PCT) return;

  const { data: existing } = await supabase
    .from(TABLE.ALERTS)
    .select("id")
    .eq("device_type", "moisture_meter")
    .eq("device_id", deviceId)
    .eq("alert_type", "moisture_approaching")
    .eq("is_resolved", false)
    .limit(1);

  if (existing && existing.length > 0) return;

  const message = `${deviceId}號乾燥機水分接近目標: 目前 ${moistureValue}%，目標 ${moistureSetting}%`;

  await supabase.from(TABLE.ALERTS).insert({
    device_type: "moisture_meter",
    device_id: deviceId,
    alert_type: "moisture_approaching",
    error_code: 0,
    message,
    notified_at: new Date().toISOString(),
  });

  const now = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
  await sendLineNotify(
    `\n📢 ${deviceId}號乾燥機水分接近目標！` +
      `\n目前水分: ${moistureValue}%` +
      `\n目標水分: ${moistureSetting}%` +
      `\n差距: ${gap.toFixed(1)}%` +
      `\n時間: ${now}`
  );
}
