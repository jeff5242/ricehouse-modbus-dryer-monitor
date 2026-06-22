import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { TABLE } from "@/lib/db-tables";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dryerId = parseInt(id);
  if (isNaN(dryerId) || dryerId < 1 || dryerId > 10) {
    return NextResponse.json(
      { error: { code: "INVALID_ID", message: "Invalid dryer ID" } },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const [dryerRes, moistureRes] = await Promise.all([
    supabase
      .from(TABLE.DRYER_STATUS)
      .select(`*, dryer:${TABLE.DRYERS}(id, name, model_name)`)
      .eq("dryer_id", dryerId)
      .single(),
    supabase
      .from(TABLE.MOISTURE_STATUS)
      .select("*")
      .eq("meter_id", dryerId)
      .single(),
  ]);

  if (!dryerRes.data) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Dryer not found" } },
      { status: 404 }
    );
  }

  const d = dryerRes.data;
  const m = moistureRes.data;

  return NextResponse.json({
    data: {
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
      timer_set_hours: d.timer_set_hours,
      timer_set_minutes: d.timer_set_minutes,
      timer_display_hours: d.timer_display_hours,
      timer_display_minutes: d.timer_display_minutes,
      rs485_error_count: d.rs485_error_count,
      moisture: m
        ? {
            value: m.last_moisture_value,
            setting: m.moisture_setting,
            setting_tiny: m.moisture_setting_tiny,
            grain_temp: m.grain_temp,
            grain_type: m.grain_type,
            grain_type_name: m.grain_type_name,
            mode: m.mode,
            control_source: m.control_source,
            error_code: m.error_code,
            error_name: m.error_name,
            measurement_interval: m.measurement_interval,
            display_value: m.display_value,
            updated_at: m.updated_at,
          }
        : null,
      updated_at: d.updated_at,
    },
  });
}
