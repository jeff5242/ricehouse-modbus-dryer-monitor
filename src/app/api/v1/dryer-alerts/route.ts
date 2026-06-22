import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { TABLE } from "@/lib/db-tables";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const resolved = request.nextUrl.searchParams.get("resolved");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "50");
  const offset = parseInt(request.nextUrl.searchParams.get("offset") ?? "0");

  const supabase = createServiceClient();

  let query = supabase
    .from(TABLE.ALERTS)
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (resolved === "false") {
    query = query.eq("is_resolved", false);
  } else if (resolved === "true") {
    query = query.eq("is_resolved", true);
  }

  const { data, count } = await query;

  return NextResponse.json({
    data: (data ?? []).map((a) => ({
      id: a.id,
      device_type: a.device_type,
      device_id: a.device_id,
      alert_type: a.alert_type,
      error_code: a.error_code,
      message: a.message,
      is_resolved: a.is_resolved,
      severity: a.error_code ? "red" : "orange",
      triggered_at: a.created_at,
      resolved_at: a.resolved_at,
    })),
    meta: {
      total: count ?? 0,
      limit,
      offset,
    },
  });
}
