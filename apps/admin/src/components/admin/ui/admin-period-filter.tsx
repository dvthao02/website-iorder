"use client";

import { useState } from "react";

// Khoảng thời gian chọn nhanh theo ngày Việt Nam; chỉ "Tùy chọn ngày…" mới hiện hai ô nhập ngày.
export type Period = "all" | "today" | "7d" | "30d" | "thisMonth" | "lastMonth" | "custom";
export const periodLabels: Record<Period, string> = { all: "Mọi thời gian", today: "Hôm nay", "7d": "7 ngày qua", "30d": "30 ngày qua", thisMonth: "Tháng này", lastMonth: "Tháng trước", custom: "Tùy chọn ngày…" };
const isoDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
const shortDay = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

export function vietnamToday() { return isoDay.format(new Date()); }

function shiftDay(day: string, days: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function periodRange(period: Period, today: string): { from?: string; to?: string } {
  const monthStart = `${today.slice(0, 8)}01`;
  switch (period) {
    case "today": return { from: today, to: today };
    case "7d": return { from: shiftDay(today, -6), to: today };
    case "30d": return { from: shiftDay(today, -29), to: today };
    case "thisMonth": return { from: monthStart, to: today };
    case "lastMonth": { const lastMonthEnd = shiftDay(monthStart, -1); return { from: `${lastMonthEnd.slice(0, 8)}01`, to: lastMonthEnd }; }
    default: return {};
  }
}

export function detectPeriod(from: string | undefined, to: string | undefined, today: string): Period {
  if (!from && !to) return "all";
  const match = (["today", "7d", "30d", "thisMonth", "lastMonth"] as const).find((period) => { const range = periodRange(period, today); return range.from === from && range.to === to; });
  return match ?? "custom";
}

/** Nhãn ngắn cho nhãn bộ lọc đang áp dụng, ví dụ "30 ngày qua" hoặc "01/10/2026 – 18/10/2026". */
export function periodChipLabel(from: string | undefined, to: string | undefined) {
  const period = detectPeriod(from, to, vietnamToday());
  if (period !== "custom") return periodLabels[period];
  const format = (day: string) => shortDay.format(new Date(`${day}T00:00:00Z`));
  return from && to ? `${format(from)} – ${format(to)}` : from ? `Từ ${format(from)}` : `Đến ${format(to!)}`;
}

/** Ô chọn khoảng thời gian; onChange nhận from/to (undefined = bỏ lọc). */
export function AdminPeriodFilter({ from, to, label, disabled, onChange }: { from?: string; to?: string; label: string; disabled?: boolean; onChange: (range: { from?: string; to?: string }) => void }) {
  const today = vietnamToday();
  // Suy ra từ from/to (gỡ nhãn bộ lọc thì ô chọn tự về đúng). "Tùy chọn" được nhớ kèm khoảng ngày lúc chọn,
  // nên khoảng ngày đổi (nhập ngày mới hoặc gỡ nhãn) thì lại suy ra từ from/to.
  const rangeKey = `${from ?? ""}|${to ?? ""}`;
  const [customFor, setCustomFor] = useState<string | null>(null);
  const detected = detectPeriod(from, to, today);
  const period: Period = customFor === rangeKey ? "custom" : detected;
  return <>
    <select aria-label={label} disabled={disabled} onChange={(event) => { const next = event.target.value as Period; setCustomFor(next === "custom" ? rangeKey : null); if (next !== "custom") onChange(periodRange(next, today)); }} value={period}>
      {(Object.keys(periodLabels) as Period[]).map((value) => <option key={value} value={value}>{periodLabels[value]}</option>)}
    </select>
    {period === "custom" ? <>
      <label className="admin-filter-bar__date">Từ<input disabled={disabled} max={to ?? today} onChange={(event) => onChange({ from: event.target.value || undefined, to })} type="date" value={from ?? ""} /></label>
      <label className="admin-filter-bar__date">đến<input disabled={disabled} max={today} min={from} onChange={(event) => onChange({ from, to: event.target.value || undefined })} type="date" value={to ?? ""} /></label>
    </> : null}
  </>;
}
