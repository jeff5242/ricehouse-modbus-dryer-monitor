"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface DryerReading {
  hot_air_temp: number | null;
  set_temp: number | null;
  status_code: number;
  recorded_at: string;
}

interface MoistureReading {
  moisture_value: number | null;
  grain_temp: number | null;
  recorded_at: string;
}

interface ChartData {
  time: string;
  timestamp: number;
  hotAirTemp: number | null;
  setTemp: number | null;
  moistureValue: number | null;
  grainTemp: number | null;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function mergeReadings(
  dryer: DryerReading[],
  moisture: MoistureReading[]
): ChartData[] {
  const map = new Map<string, ChartData>();

  for (const d of dryer) {
    const key = d.recorded_at.slice(0, 16);
    map.set(key, {
      time: formatTime(d.recorded_at),
      timestamp: new Date(d.recorded_at).getTime(),
      hotAirTemp: d.hot_air_temp,
      setTemp: d.set_temp,
      moistureValue: null,
      grainTemp: null,
    });
  }

  for (const m of moisture) {
    const key = m.recorded_at.slice(0, 16);
    const existing = map.get(key);
    if (existing) {
      existing.moistureValue = m.moisture_value;
      existing.grainTemp = m.grain_temp;
    } else {
      map.set(key, {
        time: formatTime(m.recorded_at),
        timestamp: new Date(m.recorded_at).getTime(),
        hotAirTemp: null,
        setTemp: null,
        moistureValue: m.moisture_value,
        grainTemp: m.grain_temp,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
}

interface BatchRecord {
  id: number;
  started_at: string;
  ended_at: string | null;
  initial_moisture: number | null;
  final_moisture: number | null;
  target_moisture: number | null;
  grain_type_name: string | null;
  duration_minutes: number | null;
  is_active: boolean;
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "--";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}小時${m}分`;
  return `${m}分鐘`;
}

function formatBatchDate(iso: string): string {
  return new Date(iso).toLocaleString("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

type TabKey = "chart" | "batches";

interface TrendChartProps {
  deviceId: number;
  onClose: () => void;
}

export function TrendChart({ deviceId, onClose }: TrendChartProps) {
  const [data, setData] = useState<ChartData[]>([]);
  const [moistureSetting, setMoistureSetting] = useState<number | null>(null);
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("chart");
  const [view, setView] = useState<"all" | "temp" | "moisture" | "grain">(
    "all"
  );

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [readingsRes, batchesRes] = await Promise.all([
        fetch(`/api/readings/${deviceId}?hours=24`),
        fetch(`/api/batches/${deviceId}?limit=20`),
      ]);
      const readingsJson = await readingsRes.json();
      const batchesJson = await batchesRes.json();
      setData(mergeReadings(readingsJson.dryer, readingsJson.moisture));
      setMoistureSetting(readingsJson.moistureSetting ?? null);
      setBatches(batchesJson.batches ?? []);
      setLoading(false);
    }
    fetchData();
  }, [deviceId]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-xl p-6 text-center">
          <div className="text-gray-500">載入中...</div>
        </div>
      </div>
    );
  }

  const LABELS: Record<string, string> = {
    hotAirTemp: "熱風溫度",
    setTemp: "設定溫度",
    moistureValue: "水分",
    grainTemp: "穀溫",
  };
  const UNITS: Record<string, string> = {
    hotAirTemp: "°C",
    setTemp: "°C",
    moistureValue: "%",
    grainTemp: "°C",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltipFormatter = (value: any, name: any) => {
    if (value == null) return ["--", String(name)];
    return [`${value}${UNITS[name] ?? ""}`, LABELS[name] ?? String(name)];
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const labelFormatter = (label: any, payload: readonly any[]) => {
    if (payload?.length > 0 && payload[0]?.payload?.timestamp) {
      return formatDateTime(
        new Date(payload[0].payload.timestamp).toISOString()
      );
    }
    return String(label);
  };

  const viewButtons: { key: typeof view; label: string }[] = [
    { key: "all", label: "綜合" },
    { key: "temp", label: "溫度" },
    { key: "moisture", label: "水分" },
    { key: "grain", label: "穀溫" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-xl sm:rounded-xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-4 py-3 border-b flex items-center justify-between">
          <h2 className="text-base font-bold">
            第 {deviceId} 台
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab("chart")}
              className={`px-3 py-1 text-xs rounded-full font-medium ${
                tab === "chart"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              趨勢圖
            </button>
            <button
              onClick={() => setTab("batches")}
              className={`px-3 py-1 text-xs rounded-full font-medium ${
                tab === "batches"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              歷史批次
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 text-xl px-2"
            >
              ✕
            </button>
          </div>
        </div>

        {tab === "batches" && (
          <div className="px-4 py-3">
            {batches.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                暫無烘乾批次記錄
              </div>
            ) : (
              <div className="space-y-2">
                {batches.map((b) => (
                  <div
                    key={b.id}
                    className={`rounded-lg border px-3 py-2 ${
                      b.is_active
                        ? "border-orange-300 bg-orange-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            b.is_active
                              ? "bg-orange-500 text-white"
                              : "bg-green-500 text-white"
                          }`}
                        >
                          {b.is_active ? "烘乾中" : "已完成"}
                        </span>
                        {b.grain_type_name && (
                          <span className="text-xs text-gray-500">
                            {b.grain_type_name}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {formatDuration(b.duration_minutes)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[10px] text-gray-400">起始</span>
                        <span className="font-bold text-blue-600">
                          {b.initial_moisture != null
                            ? `${b.initial_moisture}%`
                            : "--"}
                        </span>
                      </div>
                      <span className="text-gray-300">→</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[10px] text-gray-400">結束</span>
                        <span className="font-bold text-green-600">
                          {b.final_moisture != null
                            ? `${b.final_moisture}%`
                            : "--"}
                        </span>
                      </div>
                      {b.target_moisture != null && (
                        <div className="flex items-baseline gap-1">
                          <span className="text-[10px] text-gray-400">
                            目標
                          </span>
                          <span className="text-xs text-gray-500">
                            {b.target_moisture}%
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">
                      {formatBatchDate(b.started_at)}
                      {b.ended_at && ` — ${formatBatchDate(b.ended_at)}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "chart" && (
          <>
        <div className="px-4 py-2 flex gap-1">
          {viewButtons.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`px-3 py-1 text-xs rounded-full font-medium ${
                view === v.key
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="px-2 pb-4">
          {(view === "all" || view === "temp") && (
            <div className="mb-4">
              {view === "all" && (
                <h3 className="text-xs font-bold text-gray-500 px-2 mb-1">
                  溫度曲線
                </h3>
              )}
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    domain={["auto", "auto"]}
                    unit="°C"
                  />
                  <Tooltip
                    formatter={tooltipFormatter}
                    labelFormatter={labelFormatter}
                  />
                  <Legend
                    formatter={(v) =>
                      v === "hotAirTemp" ? "熱風溫度" : "設定溫度"
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="hotAirTemp"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="setTemp"
                    stroke="#f97316"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {(view === "all" || view === "moisture") && (
            <div className="mb-4">
              {view === "all" && (
                <h3 className="text-xs font-bold text-gray-500 px-2 mb-1">
                  水分曲線
                </h3>
              )}
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    domain={["auto", "auto"]}
                    unit="%"
                  />
                  <Tooltip
                    formatter={tooltipFormatter}
                    labelFormatter={labelFormatter}
                  />
                  <Legend
                    formatter={() => "水分值"}
                  />
                  <Line
                    type="monotone"
                    dataKey="moistureValue"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                  {moistureSetting !== null && (
                    <ReferenceLine
                      y={moistureSetting}
                      stroke="#22c55e"
                      strokeDasharray="6 3"
                      label={{
                        value: `設定 ${moistureSetting}%`,
                        position: "right",
                        fontSize: 10,
                        fill: "#22c55e",
                      }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {(view === "all" || view === "grain") && (
            <div className="mb-4">
              {view === "all" && (
                <h3 className="text-xs font-bold text-gray-500 px-2 mb-1">
                  穀溫曲線
                </h3>
              )}
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    domain={["auto", "auto"]}
                    unit="°C"
                  />
                  <Tooltip
                    formatter={tooltipFormatter}
                    labelFormatter={labelFormatter}
                  />
                  <Legend
                    formatter={() => "穀溫"}
                  />
                  <Line
                    type="monotone"
                    dataKey="grainTemp"
                    stroke="#d97706"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {data.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              暫無歷史資料
            </div>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
}
