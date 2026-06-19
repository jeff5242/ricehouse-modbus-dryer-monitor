"use client";

import type { MoistureStatus } from "@/lib/types";

const DIST_LABELS = [
  "9-11%", "11-13%", "13-15%", "15-17%", "17-19%",
  "19-21%", "21-23%", "23-25%", "25-27%", "27-29%",
  "29-31%", "31-33%", "33-35%", "35-37%", "37-40%",
];

const DIST_KEYS = [
  "dist_09_11", "dist_11_13", "dist_13_15", "dist_15_17", "dist_17_19",
  "dist_19_21", "dist_21_23", "dist_23_25", "dist_25_27", "dist_27_29",
  "dist_29_31", "dist_31_33", "dist_33_35", "dist_35_37", "dist_37_40",
] as const;

export function MoistureCard({ status }: { status: MoistureStatus }) {
  const name = status.moisture_meter?.name ?? `${status.meter_id}號水分計`;

  const distValues = DIST_KEYS.map((key) => status[key] ?? 0);
  const maxDist = Math.max(...distValues, 1);
  const hasDistribution = distValues.some((v) => v > 0);

  return (
    <div
      className={`rounded-xl border-2 p-4 transition-all ${
        status.error_code > 0
          ? "border-red-500 bg-red-50"
          : "border-teal-200 bg-teal-50/30"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg">{name}</h3>
        <div className="flex gap-2">
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              status.mode === "AUTO"
                ? "bg-green-100 text-green-700"
                : "bg-gray-200 text-gray-500"
            }`}
          >
            {status.mode}
          </span>
          {status.grain_type_name && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {status.grain_type_name}
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      {status.error_code > 0 && (
        <div className="bg-red-100 text-red-800 rounded-lg px-3 py-2 mb-3 text-sm font-medium">
          E{status.error_code} {status.error_name}
        </div>
      )}

      {/* Main metrics */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-white/60 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500">設定水分</div>
          <div className="text-xl font-bold text-teal-600">
            {status.moisture_setting !== null ? `${status.moisture_setting}%` : "--"}
          </div>
        </div>
        <div className="bg-white/60 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500">量測水分</div>
          <div className="text-xl font-bold text-blue-600">
            {status.last_moisture_value !== null
              ? `${status.last_moisture_value}%`
              : "--"}
          </div>
        </div>
        <div className="bg-white/60 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500">穀溫</div>
          <div className="text-xl font-bold text-orange-600">
            {status.grain_temp !== null ? `${status.grain_temp}°C` : "--"}
          </div>
        </div>
      </div>

      {/* Moisture Distribution Bar Chart */}
      {hasDistribution && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">水分分布</div>
          <div className="flex items-end gap-0.5 h-12">
            {distValues.map((val, idx) => (
              <div
                key={idx}
                className="flex-1 bg-teal-400 rounded-t-sm transition-all"
                style={{ height: `${(val / maxDist) * 100}%` }}
                title={`${DIST_LABELS[idx]}: ${val}`}
              />
            ))}
          </div>
          <div className="flex gap-0.5 mt-0.5">
            {DIST_LABELS.filter((_, i) => i % 3 === 0).map((label) => (
              <div key={label} className="flex-[3] text-center text-[8px] text-gray-400">
                {label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>
          間隔: {status.measurement_interval ?? "--"}分
        </span>
        <span>
          {status.last_measurement_time
            ? new Date(status.last_measurement_time).toLocaleString("zh-TW", {
                timeZone: "Asia/Taipei",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "尚無量測"}
        </span>
      </div>
    </div>
  );
}
