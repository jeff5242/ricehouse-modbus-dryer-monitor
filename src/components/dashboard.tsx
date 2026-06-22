"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { AlertBanner } from "./alert-banner";
import { TrendChart } from "./trend-chart";
import type { DryerStatus, MoistureStatus, Alert } from "@/lib/types";
import type { DryingEstimate } from "@/lib/drying-estimate";
import { TABLE } from "@/lib/db-tables";

const DEVICE_COUNT = 8;

const LUNAR_MONTHS = [
  "", "正月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "冬月", "臘月",
];
const LUNAR_DAYS = [
  "", "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
  "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十",
];

function formatLunarDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("zh-TW-u-ca-chinese", {
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const month = parseInt(parts.find((p) => p.type === "month")?.value ?? "0");
  const day = parseInt(parts.find((p) => p.type === "day")?.value ?? "0");
  return `${LUNAR_MONTHS[month] ?? `${month}月`}${LUNAR_DAYS[day] ?? `${day}日`}`;
}

function formatTimer(
  hours: number | null,
  minutes: number | null
): string {
  if (hours === null && minutes === null) return "--:--";
  const h = hours ?? 0;
  const m = minutes ?? 0;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function formatUpdatedAt(
  dryerAt: string | undefined,
  moistureAt: string | undefined
): string {
  const ts = dryerAt ?? moistureAt;
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function statusBadgeColor(code: number, isOnline: boolean) {
  if (!isOnline) return "bg-gray-300 text-gray-600";
  switch (code) {
    case 0x06:
      return "bg-orange-500 text-white";
    case 0x07:
      return "bg-yellow-500 text-white";
    case 0x0a:
      return "bg-green-500 text-white";
    case 0x03:
      return "bg-blue-500 text-white";
    case 0x01:
      return "bg-gray-500 text-white";
    default:
      return "bg-gray-400 text-white";
  }
}

function rowBorder(code: number, isOnline: boolean, hasError: boolean) {
  if (hasError) return "border-red-400 bg-red-50";
  if (!isOnline) return "border-gray-200 bg-gray-50";
  switch (code) {
    case 0x06:
      return "border-orange-300 bg-orange-50/50";
    case 0x07:
      return "border-yellow-300 bg-yellow-50/50";
    case 0x0a:
      return "border-green-300 bg-green-50/50";
    default:
      return "border-gray-200 bg-white";
  }
}

function formatEstimateTime(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  return date.toLocaleString("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatEtaDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}m`;
  return `${m}m`;
}

interface DeviceRowProps {
  id: number;
  dryer: DryerStatus | undefined;
  moisture: MoistureStatus | undefined;
  estimate: DryingEstimate | undefined;
  onTrend: () => void;
}

function DeviceRow({ id, dryer, moisture, estimate, onTrend }: DeviceRowProps) {
  const isOnline = dryer?.is_online ?? false;
  const statusCode = dryer?.status_code ?? 0xff;
  const statusName = dryer?.status_name ?? "未知";
  const modelName = dryer?.dryer?.model_name ?? "";
  const hasMoisture =
    moisture !== undefined &&
    (moisture.moisture_setting !== null ||
      moisture.last_moisture_value !== null);
  const hasError =
    (dryer?.error_code ?? 0) > 0 || (moisture?.error_code ?? 0) > 0;

  return (
    <div
      className={`rounded-lg border-2 px-3 py-2 ${rowBorder(statusCode, isOnline, hasError)}`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-baseline gap-1 shrink-0">
          <span className="text-base font-black">{id}</span>
          {modelName && (
            <span className="text-[11px] text-gray-400">{modelName}</span>
          )}
        </div>

        <span
          className={`px-2 py-0.5 rounded text-xs font-bold shrink-0 ${statusBadgeColor(statusCode, isOnline)}`}
        >
          {statusName}
        </span>

        {isOnline && (
          <>
            <div className="flex items-baseline gap-1 shrink-0">
              <span className="text-sm font-bold text-red-500">
                {dryer?.hot_air_temp ?? "--"}°C
              </span>
              {dryer?.hot_air_temp !== dryer?.set_temp && (
                <span className="text-xs text-gray-400">
                  / {dryer?.set_temp ?? "--"}°C
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-1 shrink-0">
              <span className="text-[10px] text-gray-400">烘</span>
              <span className="text-xs text-gray-500">
                {formatTimer(
                  dryer?.timer_display_hours ?? null,
                  dryer?.timer_display_minutes ?? null
                )}
              </span>
            </div>
          </>
        )}

        <div className="ml-auto flex flex-col items-end gap-0.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={onTrend}
              className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-500 font-medium active:bg-blue-100"
            >
              趨勢
            </button>
            <span className="text-[10px] text-gray-300">
              {formatUpdatedAt(dryer?.updated_at, moisture?.updated_at)}
            </span>
          </div>
          {estimate?.completionTimestamp != null && estimate.etaMinutes != null && (
            <button
              onClick={onTrend}
              className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium active:bg-indigo-100 flex items-center gap-1"
            >
              <span className="text-[8px] bg-indigo-200 text-indigo-700 rounded px-0.5 font-bold">
                估
              </span>
              {formatEstimateTime(estimate.completionTimestamp)} 完成
              <span className="text-indigo-400">
                ({formatEtaDuration(estimate.etaMinutes)})
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Line 2: Moisture data — show whenever moisture data exists */}
      {hasMoisture && (
        <div className="flex items-center gap-3 mt-1 pl-0.5">
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] text-gray-400">水分</span>
            <span className="text-sm font-bold text-blue-600">
              {moisture.last_moisture_value ?? "--"}%
            </span>
            {moisture.moisture_setting !== null && (
              <span className="text-[10px] text-gray-400">
                / 設定 {moisture.moisture_setting}%
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-[10px] text-gray-400">穀溫</span>
            <span className="text-sm font-bold text-amber-600">
              {moisture.grain_temp ?? "--"}°C
            </span>
          </div>

          {moisture.mode && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                moisture.mode === "AUTO"
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {moisture.mode}
            </span>
          )}
        </div>
      )}

      {/* Error display */}
      {hasError && (
        <div className="mt-1 text-xs text-red-700 font-medium">
          {(dryer?.error_code ?? 0) > 0 &&
            `乾燥機 ${dryer?.error_name ?? `E-${dryer?.error_code}`} `}
          {(moisture?.error_code ?? 0) > 0 &&
            `水分計 ${moisture?.error_name ?? `E${moisture?.error_code}`}`}
        </div>
      )}
    </div>
  );
}

export function Dashboard() {
  const [dryers, setDryers] = useState<DryerStatus[]>([]);
  const [moistures, setMoistures] = useState<MoistureStatus[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [estimates, setEstimates] = useState<Record<number, DryingEstimate>>({});
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [polling, setPolling] = useState(false);
  const [trendDeviceId, setTrendDeviceId] = useState<number | null>(null);

  async function refreshEstimates() {
    try {
      const res = await fetch("/api/estimates");
      const json = await res.json();
      if (json.estimates) setEstimates(json.estimates);
    } catch {
      // non-critical
    }
  }

  useEffect(() => {
    const supabase = createBrowserClient();

    async function fetchData() {
      const [dryerRes, moistureRes, alertRes] = await Promise.all([
        supabase
          .from(TABLE.DRYER_STATUS)
          .select(`*, dryer:${TABLE.DRYERS}(id, name, model_name)`)
          .order("dryer_id"),
        supabase
          .from(TABLE.MOISTURE_STATUS)
          .select(`*, moisture_meter:${TABLE.MOISTURE_METERS}(id, name)`)
          .order("meter_id"),
        supabase
          .from(TABLE.ALERTS)
          .select("*")
          .eq("is_resolved", false)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (dryerRes.data) setDryers(dryerRes.data);
      if (moistureRes.data) setMoistures(moistureRes.data);
      if (alertRes.data) setAlerts(alertRes.data);
      setLastUpdate(new Date());
      refreshEstimates();
    }

    fetchData();

    const dryerChannel = supabase
      .channel("dryer-status-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: TABLE.DRYER_STATUS },
        (payload) => {
          setDryers((prev) =>
            prev.map((d) =>
              d.dryer_id === payload.new.dryer_id
                ? { ...d, ...payload.new }
                : d
            )
          );
          setLastUpdate(new Date());
        }
      )
      .subscribe();

    const moistureChannel = supabase
      .channel("moisture-status-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: TABLE.MOISTURE_STATUS },
        (payload) => {
          setMoistures((prev) =>
            prev.map((m) =>
              m.meter_id === payload.new.meter_id
                ? { ...m, ...payload.new }
                : m
            )
          );
          setLastUpdate(new Date());
          refreshEstimates();
        }
      )
      .subscribe();

    const alertChannel = supabase
      .channel("alert-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: TABLE.ALERTS },
        (payload) => {
          setAlerts((prev) => [payload.new as Alert, ...prev].slice(0, 10));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(dryerChannel);
      supabase.removeChannel(moistureChannel);
      supabase.removeChannel(alertChannel);
    };
  }, []);

  async function handlePoll() {
    setPolling(true);
    try {
      await fetch("/api/trigger-poll", { method: "POST" });
      await refreshEstimates();
    } finally {
      setPolling(false);
    }
  }

  const onlineCount = dryers.filter((d) => d.is_online).length;
  const dryingCount = dryers.filter(
    (d) => d.status_code === 0x06 || d.status_code === 0x07
  ).length;

  const devices = Array.from({ length: DEVICE_COUNT }, (_, i) => ({
    id: i + 1,
    dryer: dryers.find((d) => d.dryer_id === i + 1),
    moisture: moistures.find((m) => m.meter_id === i + 1),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                大橋米烘乾監控
              </h1>
              <div className="flex gap-3 text-sm">
                <span className="text-green-600">
                  <span className="font-bold">{onlineCount}</span> 台連線
                </span>
                <span className="text-orange-600">
                  <span className="font-bold">{dryingCount}</span> 台乾燥中
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePoll}
                disabled={polling}
                className="px-3 py-1.5 bg-blue-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 active:bg-blue-600 shrink-0"
              >
                {polling ? "更新中..." : "更新"}
              </button>
              <div className="text-xs text-gray-400 text-right leading-relaxed">
                {lastUpdate ? (
                  <>
                    <div>
                      {lastUpdate.toLocaleDateString("zh-TW", {
                        year: "numeric",
                        month: "numeric",
                        day: "numeric",
                      })}
                      {" "}
                      {lastUpdate.toLocaleTimeString("zh-TW")}
                    </div>
                    <div>
                      {lastUpdate.toLocaleDateString("zh-TW", {
                        weekday: "short",
                      })}
                      {" "}
                      {formatLunarDate(lastUpdate)}
                    </div>
                  </>
                ) : (
                  "載入中..."
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 py-2">
        <AlertBanner alerts={alerts} />

        <div className="space-y-1.5">
          {devices.map(({ id, dryer, moisture }) => (
            <DeviceRow
              key={id}
              id={id}
              dryer={dryer}
              moisture={moisture}
              estimate={estimates[id]}
              onTrend={() => setTrendDeviceId(id)}
            />
          ))}
        </div>
      </main>

      {trendDeviceId !== null && (
        <TrendChart
          deviceId={trendDeviceId}
          onClose={() => setTrendDeviceId(null)}
        />
      )}
    </div>
  );
}
