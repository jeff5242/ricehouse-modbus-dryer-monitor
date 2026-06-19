"use client";

import { useEffect, useState } from "react";
import type { Alert } from "@/lib/types";

interface AlertBannerProps {
  alerts: Alert[];
}

export function AlertBanner({ alerts: propAlerts }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [dismissing, setDismissing] = useState<Set<number>>(new Set());

  useEffect(() => {
    setDismissed(new Set());
  }, [propAlerts.length]);

  const alerts = propAlerts.filter((a) => !dismissed.has(a.id));

  if (alerts.length === 0) return null;

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

  return (
    <div className="mb-2 space-y-1.5">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="text-red-500 text-xl">&#9888;</span>
            <div>
              <div className="font-medium text-red-800">{alert.message}</div>
              <div className="text-xs text-red-500">
                {new Date(alert.created_at).toLocaleString("zh-TW", {
                  timeZone: "Asia/Taipei",
                })}
              </div>
            </div>
          </div>
          <button
            onClick={() => handleDismiss(alert.id)}
            disabled={dismissing.has(alert.id)}
            className="text-red-300 hover:text-red-500 text-lg px-2 shrink-0 disabled:opacity-50"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
