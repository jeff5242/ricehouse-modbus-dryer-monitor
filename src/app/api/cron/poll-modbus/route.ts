import { NextRequest, NextResponse } from "next/server";
import { runPoll } from "@/lib/poll/run-poll";

export const maxDuration = 55;
export const dynamic = "force-dynamic";

// 輪詢核心在 src/lib/poll/run-poll.ts；這裡只做驗證與回應。
// 正式輪詢已改由常駐 poller（poller/main.ts）執行，此端點保留給手動觸發（trigger-poll）與備援。
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runPoll();
  return NextResponse.json({ ok: true, ...result });
}
