"use client";

import { useEffect, useState } from "react";
import type { Alert } from "@/lib/types";

interface AlertBannerProps {
  alerts: Alert[];
}

interface AlertStyleSet {
  bg: string;
  icon: string;
  iconColor: string;
  title: string;
  date: string;
  btn: string;
}

function alertStyle(alertType: string): AlertStyleSet {
  switch (alertType) {
    case "drying_complete":
      return {
        bg: "bg-green-50 border-green-200",
        icon: "✅",
        iconColor: "text-green-500",
        title: "text-green-800",
        date: "text-green-500",
        btn: "text-green-300 hover:text-green-500",
      };
    case "moisture_reached":
      return {
        bg: "bg-blue-50 border-blue-200",
        icon: "✅",
        iconColor: "text-blue-500",
        title: "text-blue-800",
        date: "text-blue-500",
        btn: "text-blue-300 hover:text-blue-500",
      };
    default:
      return {
        bg: "bg-red-50 border-red-200",
        icon: "⚠️",
        iconColor: "text-red-500",
        title: "text-red-800",
        date: "text-red-500",
        btn: "text-red-300 hover:text-red-500",
      };
  }
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
      {alerts.map((alert) => {
        const s = alertStyle(alert.alert_type);
        return (
          <div
            key={alert.id}
            className={`border rounded-lg px-4 py-3 flex items-center justify-between ${s.bg}`}
          >
            <div className="flex items-center gap-3">
              <span className={`text-xl ${s.iconColor}`}>{s.icon}</span>
              <div>
                <div className={`font-medium ${s.title}`}>{alert.message}</div>
                <div className={`text-xs ${s.date}`}>
                  {new Date(alert.created_at).toLocaleString("zh-TW", {
                    timeZone: "Asia/Taipei",
                  })}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleDismiss(alert.id)}
              disabled={dismissing.has(alert.id)}
              className={`text-lg px-2 shrink-0 disabled:opacity-50 ${s.btn}`}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
