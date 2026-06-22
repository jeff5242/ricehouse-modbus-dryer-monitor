import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { TABLE } from "@/lib/db-tables";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServiceClient();

  const [dryerRes, moistureRes] = await Promise.all([
    supabase
      .from(TABLE.DRYER_STATUS)
      .select(`*, dryer:${TABLE.DRYERS}(id, name, model_name)`)
      .order("dryer_id"),
    supabase
      .from(TABLE.MOISTURE_STATUS)
      .select("meter_id, moisture_setting, last_moisture_value, grain_temp, grain_type_name, mode, error_code, error_name, updated_at")
      .order("meter_id"),
  ]);

  const moistureMap = new Map(
    (moistureRes.data ?? []).map((m) => [m.meter_id, m])
  );

  const dryers = (dryerRes.data ?? []).map((d) => {
    const m = moistureMap.get(d.dryer_id);
    return {
      id: d.dryer_id,
      name: d.dryer?.name ?? `${d.dryer_id}號機`,
      model_name: d.dryer?.model_name ?? null,
      is_online: d.is_online,
      status_code: d.status_code,
      status_name: d.status_name,
      hot_air_temp: d.hot_air_temp,
      set_temp: d.set_temp,
      error_code: d.error_code,
      error_name: d.error_name,
      timer_set: formatTimer(d.timer_set_hours, d.timer_set_minutes),
      timer_display: formatTimer(d.timer_display_hours, d.timer_display_minutes),
      moisture: m
        ? {
            value: m.last_moisture_value,
            setting: m.moisture_setting,
            grain_temp: m.grain_temp,
            grain_type: m.grain_type_name,
            mode: m.mode,
            error_code: m.error_code,
            error_name: m.error_name,
          }
        : null,
      updated_at: d.updated_at,
    };
  });

  return NextResponse.json({ data: dryers });
}

function formatTimer(h: number | null, m: number | null): string | null {
  if (h === null && m === null) return null;
  return `${(h ?? 0).toString().padStart(2, "0")}:${(m ?? 0).toString().padStart(2, "0")}`;
}
