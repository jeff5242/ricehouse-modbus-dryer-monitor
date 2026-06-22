import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { TABLE } from "@/lib/db-tables";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

const DRYING_STATUS_NAMES: Record<number, string> = {
  0x00: "準備中",
  0x01: "停止",
  0x02: "停止(預備通風)",
  0x03: "入穀",
  0x04: "入穀滿量",
  0x05: "排出",
  0x06: "乾燥",
  0x07: "通風乾燥",
  0x08: "乾燥結束",
  0x09: "乾燥暫停",
  0x0a: "乾燥完成",
};

const DRYER_ERROR_NAMES: Record<number, string> = {
  0x01: "風壓開關異常",
  0x03: "熱風檢知器異常",
  0x04: "燃燒機壓力開關異常",
  0x05: "熱風超出設定5°C",
  0x06: "燃燒機熄火",
  0x07: "異常過熱",
  0x09: "點火前受光",
  0x11: "底座馬達過載",
  0x12: "升降機馬達過載",
  0x13: "排塵機馬達過載",
  0x14: "排風機馬達過載",
  0x15: "迴轉閥馬達過載",
  0x16: "均分馬達過載",
  0x17: "迴轉閥/底馬迴轉異常",
  0x80: "SW3設定錯誤",
};

const MOISTURE_ERROR_NAMES: Record<number, string> = {
  0x31: "通訊異常(測定→操作)",
  0x32: "通訊異常(操作→測定)",
  0x33: "水份計無法正確測定",
  0x34: "滾輪電極異常",
  0x35: "取料不良",
  0x36: "穀物選擇鈕異常",
  0x37: "水份設定異常",
  0x38: "滾輪電極周邊異常",
  0x39: "溫度檢知器異常",
  0x40: "EEPROM異常",
};

const VENTILATION_STATUSES = new Set([0x02, 0x07]);

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function formatDecimal(value: number | null, decimals = 2): string {
  if (value === null || value === undefined) return (0).toFixed(decimals);
  return value.toFixed(decimals);
}

function formatTimer(
  hours: number | null,
  minutes: number | null
): string {
  const h = (hours ?? 0).toString().padStart(2, "0");
  const m = (minutes ?? 0).toString().padStart(2, "0");
  return `${h}:${m}`;
}

interface DryerRow {
  dryer_id: number;
  is_online: boolean;
  status_code: number;
  status_name: string | null;
  hot_air_temp: number | null;
  set_temp: number | null;
  error_code: number | null;
  error_name: string | null;
  timer_set_hours: number | null;
  timer_set_minutes: number | null;
  timer_display_hours: number | null;
  timer_display_minutes: number | null;
  dryer?: { model_name: string | null } | null;
}

interface MoistureRow {
  meter_id: number;
  moisture_setting: number | null;
  moisture_setting_tiny: number | null;
  grain_type_name: string | null;
  grain_temp: number | null;
  error_code: number | null;
  error_name: string | null;
  last_moisture_value: number | null;
  mode: string | null;
}

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action");

  if (action !== "getstatus") {
    return new NextResponse("Unknown action\n", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...CORS_HEADERS },
    });
  }

  const supabase = createServiceClient();

  const [dryerRes, moistureRes] = await Promise.all([
    supabase
      .from(TABLE.DRYER_STATUS)
      .select(`*, dryer:${TABLE.DRYERS}(model_name)`)
      .order("dryer_id"),
    supabase
      .from(TABLE.MOISTURE_STATUS)
      .select("*")
      .order("meter_id"),
  ]);

  const dryers = (dryerRes.data ?? []) as DryerRow[];
  const moistures = (moistureRes.data ?? []) as MoistureRow[];
  const moistureMap = new Map(moistures.map((m) => [m.meter_id, m]));

  const lines: string[] = [];

  for (const d of dryers) {
    const no = d.dryer_id;
    const m = moistureMap.get(no);
    const statusCode = d.status_code ?? 0xff;
    const errorCode = d.error_code ?? 0;
    const moistureErrorCode = m?.error_code ?? 0;
    const isVentilation = VENTILATION_STATUSES.has(statusCode);

    lines.push(`${no}:Model=${d.dryer?.model_name ?? ""}`);
    lines.push(`${no}:Power=${d.is_online ? "ON" : "OFF"}`);
    lines.push(
      `${no}:Stat=${DRYING_STATUS_NAMES[statusCode] ?? d.status_name ?? "未知"}`
    );
    lines.push(`${no}:TempSet=${formatDecimal(d.set_temp)}`);
    lines.push(`${no}:Temp=${formatDecimal(d.hot_air_temp)}`);
    lines.push(
      `${no}:SetTime=${formatTimer(d.timer_set_hours, d.timer_set_minutes)}`
    );
    lines.push(
      `${no}:ShowTime=${formatTimer(d.timer_display_hours, d.timer_display_minutes)}`
    );
    lines.push(
      `${no}:Err=${errorCode === 0 ? "無錯誤" : (DRYER_ERROR_NAMES[errorCode] ?? `E-${errorCode}`)}`
    );

    lines.push(`${no}:Stat2_0=OFF`);
    lines.push(`${no}:Stat2_1=OFF`);
    lines.push(`${no}:Stat2_2=OFF`);
    lines.push(`${no}:Stat2_3=${isVentilation ? "通風" : "OFF"}`);
    lines.push(`${no}:Stat2_4=OFF`);
    lines.push(`${no}:Stat2_5=OFF`);
    lines.push(`${no}:Stat2_6=連續模式`);
    lines.push(`${no}:Stat2_7=OFF`);

    lines.push(
      `${no}:MoistureErr=${moistureErrorCode === 0 ? "無錯誤" : (MOISTURE_ERROR_NAMES[moistureErrorCode] ?? `E${moistureErrorCode}`)}`
    );
    lines.push(`${no}:Moisture=${formatDecimal(m?.last_moisture_value ?? null)}`);
    lines.push(`${no}:MoistureSet=${formatDecimal(m?.moisture_setting ?? null)}`);
    lines.push(
      `${no}:MoistureSetTiny=${formatDecimal(m?.moisture_setting_tiny ?? null)}`
    );
    lines.push(`${no}:CerealsType=${m?.grain_type_name ?? "稻穀"}`);
    lines.push(`${no}:CerealsTemp=${formatDecimal(m?.grain_temp ?? null)}`);
  }

  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
      ...CORS_HEADERS,
    },
  });
}
