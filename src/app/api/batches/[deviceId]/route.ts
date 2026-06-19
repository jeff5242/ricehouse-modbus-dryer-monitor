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

  const limit = parseInt(
    request.nextUrl.searchParams.get("limit") ?? "20"
  );

  const supabase = createServiceClient();

  const { data } = await supabase
    .from(TABLE.DRYING_BATCHES)
    .select("*")
    .eq("dryer_id", id)
    .order("started_at", { ascending: false })
    .limit(limit);

  return NextResponse.json({
    deviceId: id,
    batches: data ?? [],
  });
}
