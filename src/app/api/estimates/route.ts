import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { TABLE } from "@/lib/db-tables";
import {
  calculateDryingEstimate,
  type MoisturePoint,
  type DryingEstimate,
} from "@/lib/drying-estimate";

export const dynamic = "force-dynamic";

const HOURS_WINDOW = 24;

export interface EstimateResponse {
  estimates: Record<number, DryingEstimate>;
}

export async function GET() {
  const supabase = createServiceClient();
  const since = new Date(
    Date.now() - HOURS_WINDOW * 60 * 60 * 1000
  ).toISOString();

  const [settingsRes, readingsRes] = await Promise.all([
    supabase
      .from(TABLE.MOISTURE_STATUS)
      .select("meter_id, moisture_setting")
      .order("meter_id"),
    supabase
      .from(TABLE.MOISTURE_READINGS)
      .select("meter_id, moisture_value, recorded_at")
      .not("moisture_value", "is", null)
      .gte("recorded_at", since)
      .order("recorded_at"),
  ]);

  const settingMap = new Map(
    (settingsRes.data ?? []).map((m) => [
      m.meter_id as number,
      m.moisture_setting as number | null,
    ])
  );

  const readingsByDevice = new Map<number, MoisturePoint[]>();
  for (const r of readingsRes.data ?? []) {
    const id = r.meter_id as number;
    const arr = readingsByDevice.get(id) ?? [];
    arr.push({
      timestamp: new Date(r.recorded_at).getTime(),
      moisture: r.moisture_value as number,
    });
    readingsByDevice.set(id, arr);
  }

  const estimates: Record<number, DryingEstimate> = {};

  for (const [meterId, points] of readingsByDevice) {
    const target = settingMap.get(meterId);
    if (target === null || target === undefined) continue;

    const estimate = calculateDryingEstimate(points, target);
    if (estimate) {
      estimates[meterId] = estimate;
    }
  }

  return NextResponse.json({ estimates });
}
