import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { TABLE } from "@/lib/db-tables";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const alertId = parseInt(id);
  if (isNaN(alertId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const supabase = createServiceClient();
  await supabase
    .from(TABLE.ALERTS)
    .update({ is_resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", alertId);

  return NextResponse.json({ ok: true });
}
