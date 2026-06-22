import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { TABLE } from "@/lib/db-tables";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
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

  const hours = parseInt(request.nextUrl.searchParams.get("hours") ?? "24");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "500");
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const supabase = createServiceClient();

  const [dryerRes, moistureRes] = await Promise.all([
    supabase
      .from(TABLE.DRYER_READINGS)
      .select("hot_air_temp, set_temp, status_code, error_code, recorded_at")
      .eq("dryer_id", dryerId)
      .gte("recorded_at", since)
      .order("recorded_at")
      .limit(limit),
    supabase
      .from(TABLE.MOISTURE_READINGS)
      .select("moisture_value, grain_temp, grain_type, recorded_at")
      .eq("meter_id", dryerId)
      .gte("recorded_at", since)
      .order("recorded_at")
      .limit(limit),
  ]);

  return NextResponse.json({
    data: {
      dryer_id: dryerId,
      hours,
      dryer_readings: dryerRes.data ?? [],
      moisture_readings: moistureRes.data ?? [],
    },
  });
}
