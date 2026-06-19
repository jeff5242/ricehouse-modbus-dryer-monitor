"use client";

import type { DryerStatus } from "@/lib/types";

const STATUS_COLORS: Record<number, string> = {
  0x01: "bg-gray-100 border-gray-300",     // 停止
  0x02: "bg-gray-100 border-gray-300",     // 停止(預備通風)
  0x03: "bg-blue-50 border-blue-300",      // 入穀
  0x04: "bg-blue-100 border-blue-400",     // 入穀滿量
  0x05: "bg-purple-50 border-purple-300",  // 排出
  0x06: "bg-orange-50 border-orange-400",  // 乾燥
  0x07: "bg-yellow-50 border-yellow-300",  // 通風乾燥
  0x08: "bg-green-50 border-green-300",    // 乾燥結束
  0x09: "bg-amber-50 border-amber-300",    // 乾燥暫停
  0x0a: "bg-green-100 border-green-400",   // 乾燥完成
  0xff: "bg-gray-50 border-gray-200",      // 關機
};

function formatTimer(hours: number | null, minutes: number | null): string {
  if (hours === null || minutes === null) return "--:--";
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

export function DryerCard({ status }: { status: DryerStatus }) {
  const name = status.dryer?.name ?? `${status.dryer_id}號機`;
  const borderColor =
    status.error_code > 0
      ? "border-red-500 bg-red-50"
      : !status.is_online
        ? "bg-gray-50 border-gray-200"
        : (STATUS_COLORS[status.status_code] ?? "bg-white border-gray-200");

  const updatedAgo = getTimeAgo(status.updated_at);

  return (
    <div className={`rounded-xl border-2 p-4 ${borderColor} transition-all`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg">{name}</h3>
        <span
          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
            status.is_online
              ? "bg-green-100 text-green-700"
              : "bg-gray-200 text-gray-500"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${status.is_online ? "bg-green-500" : "bg-gray-400"}`}
          />
          {status.is_online ? "連線中" : "離線"}
        </span>
      </div>

      {/* Status */}
      <div className="text-2xl font-semibold mb-2">
        {status.status_name}
      </div>

      {/* Error */}
      {status.error_code > 0 && (
        <div className="bg-red-100 text-red-800 rounded-lg px-3 py-2 mb-3 text-sm font-medium">
          E-{status.error_code.toString(16).padStart(2, "0").toUpperCase()}{" "}
          {status.error_name}
        </div>
      )}

      {/* Temperature */}
      {status.is_online && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-white/60 rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500">熱風溫度</div>
            <div className="text-xl font-bold text-orange-600">
              {status.hot_air_temp !== null ? `${status.hot_air_temp}°C` : "--"}
            </div>
          </div>
          <div className="bg-white/60 rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500">設定溫度</div>
            <div className="text-xl font-bold text-blue-600">
              {status.set_temp !== null ? `${status.set_temp}°C` : "--"}
            </div>
          </div>
        </div>
      )}

      {/* Timer */}
      {status.is_online && status.status_code === 0x06 && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-white/60 rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500">設定時間</div>
            <div className="text-lg font-mono">
              {formatTimer(status.timer_set_hours, status.timer_set_minutes)}
            </div>
          </div>
          <div className="bg-white/60 rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500">剩餘時間</div>
            <div className="text-lg font-mono">
              {formatTimer(status.timer_display_hours, status.timer_display_minutes)}
            </div>
          </div>
        </div>
      )}

      {/* Model + Updated */}
      <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
        <span>{status.dryer?.model_name ?? ""}</span>
        <span>{updatedAgo}</span>
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分鐘前`;
  const hours = Math.floor(minutes / 60);
  return `${hours}小時前`;
}
