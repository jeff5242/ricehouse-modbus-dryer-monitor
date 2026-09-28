// 常駐 Modbus 輪詢器：取代「pg_cron 每 5 分鐘打 Vercel Function」。
// 邏輯完全沿用 src/lib/poll/run-poll.ts；這裡只負責排程、日誌、優雅停止。
// 執行：npx tsx poller/main.ts（tsx 會讀 tsconfig.json 的 @/* 路徑）
import { runPoll } from "@/lib/poll/run-poll";

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NPORT_HOST",
] as const;

type Level = "info" | "warn" | "error";

function log(level: Level, msg: string, extra: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...extra }));
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    log("error", `環境變數 ${name} 必須是正整數`, { value: raw });
    process.exit(1);
  }
  return n;
}

function assertRequiredEnv(): void {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    log("error", "缺少必要環境變數，拒絕啟動", { missing });
    process.exit(1);
  }
}

const INTERVAL_MS = readPositiveInt("POLL_INTERVAL_MS", 5 * 60 * 1000);
const SLOW_CYCLE_WARN_MS = readPositiveInt("POLL_SLOW_WARN_MS", 90 * 1000);
const SHUTDOWN_GRACE_MS = 130 * 1000; // 一輪最長約 2 分鐘（連線重試 + 20 台 × 投票重讀）

let nextTimer: NodeJS.Timeout | null = null;
let running = false;
let stopping = false;
let cycleCount = 0;

async function cycle(): Promise<void> {
  if (stopping) return;
  running = true;
  cycleCount += 1;
  const started = Date.now();

  try {
    const result = await runPoll();
    const ms = Date.now() - started;
    log(result.errors.length > 0 ? "warn" : "info", "輪詢完成", {
      cycle: cycleCount,
      ms,
      dryers: result.dryers,
      moistureMeters: result.moistureMeters,
      alerts: result.alerts,
      errorCount: result.errors.length,
      errors: result.errors.slice(0, 3),
    });
    if (ms > SLOW_CYCLE_WARN_MS) log("warn", "本輪耗時過長", { ms, threshold: SLOW_CYCLE_WARN_MS });
  } catch (err) {
    log("error", "輪詢擲出例外", {
      cycle: cycleCount,
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    running = false;
    if (stopping) {
      log("info", "最後一輪已結束，退出");
      process.exit(0);
    }
    // 用「完成後再排下一輪」而不是 setInterval：慢的一輪絕不會與下一輪重疊
    nextTimer = setTimeout(() => void cycle(), INTERVAL_MS);
  }
}

function shutdown(signal: string): void {
  log("info", `收到 ${signal}，準備停止`, { running });
  stopping = true;
  if (nextTimer) clearTimeout(nextTimer);
  if (!running) process.exit(0);
  const force = setTimeout(() => {
    log("warn", "等待當前輪次逾時，強制結束");
    process.exit(0);
  }, SHUTDOWN_GRACE_MS);
  force.unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  log("error", "unhandledRejection", { reason: String(reason) });
});

assertRequiredEnv();
log("info", "poller 啟動", {
  intervalMs: INTERVAL_MS,
  nportHost: process.env.NPORT_HOST,
  nportPort: process.env.NPORT_DRYER_PORT ?? "4001",
  siteUrl: process.env.SITE_URL ?? null,
  node: process.version,
});
void cycle();
