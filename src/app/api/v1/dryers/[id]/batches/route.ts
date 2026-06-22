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

  const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "20");
  const offset = parseInt(request.nextUrl.searchParams.get("offset") ?? "0");

  const supabase = createServiceClient();

  const { data, count } = await supabase
    .from(TABLE.DRYING_BATCHES)
    .select("*", { count: "exact" })
    .eq("dryer_id", dryerId)
    .order("started_at", { ascending: false })
    .range(offset, offset + limit - 1);

  return NextResponse.json({
    data: (data ?? []).map((b) => ({
      id: b.id,
      dryer_id: b.dryer_id,
      started_at: b.started_at,
      ended_at: b.ended_at,
      initial_moisture: b.initial_moisture,
      final_moisture: b.final_moisture,
      target_moisture: b.target_moisture,
      grain_type: b.grain_type,
      grain_type_name: b.grain_type_name,
      duration_minutes: b.duration_minutes,
      is_active: b.is_active,
    })),
    meta: {
      total: count ?? 0,
      limit,
      offset,
    },
  });
}
