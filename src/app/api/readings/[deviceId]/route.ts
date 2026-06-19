import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { TABLE } from "@/lib/db-tables";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params;
  const id = parseInt(deviceId);
  if (isNaN(id) || id < 1 || id > 10) {
    return NextResponse.json({ error: "Invalid device ID" }, { status: 400 });
  }

  const hours = parseInt(
    request.nextUrl.searchParams.get("hours") ?? "24"
  );
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const supabase = createServiceClient();

  const [dryerRes, moistureRes, moistureStatusRes] = await Promise.all([
    supabase
      .from(TABLE.DRYER_READINGS)
      .select("hot_air_temp, set_temp, status_code, recorded_at")
      .eq("dryer_id", id)
      .gte("recorded_at", since)
      .order("recorded_at"),
    supabase
      .from(TABLE.MOISTURE_READINGS)
      .select("moisture_value, grain_temp, recorded_at")
      .eq("meter_id", id)
      .gte("recorded_at", since)
      .order("recorded_at"),
    supabase
      .from(TABLE.MOISTURE_STATUS)
      .select("moisture_setting")
      .eq("meter_id", id)
      .single(),
  ]);

  return NextResponse.json({
    deviceId: id,
    hours,
    dryer: dryerRes.data ?? [],
    moisture: moistureRes.data ?? [],
    moistureSetting: moistureStatusRes.data?.moisture_setting ?? null,
  });
}
