"use client";

import { useEffect, useRef, useState } from "react";
import type { Alert } from "@/lib/types";

interface AlertBellProps {
  alerts: Alert[];
}

function alertIcon(alertType: string): string {
  switch (alertType) {
    case "drying_complete":
    case "moisture_reached":
      return "✅";
    default:
      return "⚠️";
  }
}

export function AlertBell({ alerts: propAlerts }: AlertBellProps) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [dismissing, setDismissing] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDismissed(new Set());
  }, [propAlerts.length]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const alerts = propAlerts.filter((a) => !dismissed.has(a.id));
  const count = alerts.length;

  async function handleDismiss(id: number) {
    setDismissing((prev) => new Set([...prev, id]));
    const res = await fetch(`/api/alerts/${id}/resolve`, { method: "POST" });
    if (res.ok) {
      setDismissed((prev) => new Set([...prev, id]));
    }
    setDismissing((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleDismissAll() {
    const ids = alerts.map((a) => a.id);
    setDismissing((prev) => new Set([...prev, ...ids]));
    const results = await Promise.all(
      ids.map((id) =>
        fetch(`/api/alerts/${id}/resolve`, { method: "POST" })
          .then((res) => (res.ok ? id : null))
          .catch(() => null)
      )
    );
    const cleared = results.filter((id): id is number => id !== null);
    setDismissed((prev) => new Set([...prev, ...cleared]));
    setDismissing((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200"
        aria-label="通知"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-bold leading-none">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[340px] max-w-[90vw] bg-white rounded-xl shadow-lg border border-gray-200 z-20 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between gap-2">
            <span className="font-bold text-gray-800">通知</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{count} 則</span>
              {count > 0 && (
                <button
                  onClick={handleDismissAll}
                  className="text-xs font-medium text-blue-500 hover:text-blue-700 active:text-blue-800"
                >
                  全部清除
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {count === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                目前沒有通知
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="px-4 py-3 flex items-start gap-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50"
                >
                  <span className="text-lg leading-none mt-0.5">
                    {alertIcon(alert.alert_type)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-gray-800 break-words">
                      {alert.message}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {new Date(alert.created_at).toLocaleString("zh-TW", {
                        timeZone: "Asia/Taipei",
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDismiss(alert.id)}
                    disabled={dismissing.has(alert.id)}
                    className="text-gray-300 hover:text-gray-500 disabled:opacity-50 shrink-0 px-1 leading-none"
                    aria-label="清除通知"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
