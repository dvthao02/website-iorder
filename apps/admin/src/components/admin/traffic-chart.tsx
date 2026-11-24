"use client";

import { useState } from "react";

type Day = { date: string; pageviews: number; visitors: number };

const dayLabel = new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
const axisFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const number = new Intl.NumberFormat("vi-VN");

function label(date: string) {
  return dayLabel.format(new Date(`${date}T00:00:00Z`));
}

// Nhãn trục chỉ ghi ngày/tháng cho ngắn (thứ trong tuần đã có ở khung số liệu và bảng): nhãn dài làm trục rộng hơn khung trên màn hình hẹp.
function axisLabel(date: string) {
  return axisFormat.format(new Date(`${date}T00:00:00Z`));
}

// Nhãn đặt tuyệt đối theo cột nên không đẩy rộng hàng: nhãn đầu dựa mép trái, nhãn cuối dựa mép phải, còn lại căn giữa cột.
function axisAlign(index: number, count: number) {
  return index === 0 ? "left-0" : index === count - 1 ? "right-0" : "left-1/2 -translate-x-1/2";
}

// Khung số liệu đặt theo vị trí cột nên không được tràn khỏi vùng vẽ: cột sát mép trái/phải thì dịch khung vào trong
// (cùng cách với khung của DayBars). Thiếu bước này, khung ở cột cuối chỉ còn chỗ rộng bằng một cột nên chữ bị bẻ từng từ.
function tipTransform(index: number, count: number) {
  const ratio = count > 1 ? index / (count - 1) : 0.5;
  return ratio < 0.18 ? "translateX(-6px)" : ratio > 0.82 ? "translateX(calc(-100% + 6px))" : "translateX(-50%)";
}

// Biểu đồ cột một chuỗi (lượt xem theo ngày): không cần chú thích vì tiêu đề đã gọi tên chuỗi.
// Cột mảnh, bo 4px đầu dữ liệu, khe 2px; rê chuột hoặc dùng phím Tab để xem số của từng ngày.
export function TrafficChart({ daily, height = 180 }: { daily: Day[]; height?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...daily.map((day) => day.pageviews));
  const labelStep = Math.max(1, Math.ceil(daily.length / 7));
  const current = active === null ? null : daily[active];
  return <figure className="m-0 grid min-w-0 grid-cols-1 gap-3">
    <div className="relative" style={{ height }}>
      <div aria-hidden="true" className="absolute inset-x-0 top-0 flex justify-between text-[.7rem] text-[var(--cms-muted)]"><span>{number.format(max)}</span></div>
      <div className="absolute inset-x-0 bottom-0 flex h-[calc(100%-20px)] items-end gap-[2px] border-b border-[var(--cms-border)]" onMouseLeave={() => setActive(null)}>
        {daily.map((day, index) => {
          const ratio = day.pageviews / max;
          return <button
            aria-label={`${label(day.date)}: ${number.format(day.pageviews)} lượt xem, ${number.format(day.visitors)} người truy cập`}
            className="group relative flex h-full flex-1 cursor-default items-end justify-center rounded-none border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            key={day.date}
            onBlur={() => setActive(null)}
            onFocus={() => setActive(index)}
            onMouseEnter={() => setActive(index)}
            type="button"
          >
            <span className="block w-full max-w-10 rounded-t-[4px]" style={{ height: day.pageviews > 0 ? `max(${ratio * 100}%, 2px)` : 0, background: active === null || active === index ? "var(--cms-primary)" : "color-mix(in srgb, var(--cms-primary) 45%, transparent)" }} />
          </button>;
        })}
      </div>
      {current ? <div className="pointer-events-none absolute top-6 z-10 whitespace-nowrap rounded-[var(--cms-radius-component)] border border-[var(--cms-border)] bg-[var(--cms-card)] px-3 py-2 text-[.72rem] text-[var(--cms-text)] shadow-md" role="status" style={{ left: `${((active! + 0.5) / daily.length) * 100}%`, transform: tipTransform(active!, daily.length) }}>
        <strong className="block">{label(current.date)}</strong>
        <span className="block">{number.format(current.pageviews)} lượt xem</span>
        <span className="block text-[var(--cms-muted)]">{number.format(current.visitors)} người truy cập</span>
      </div> : null}
    </div>
    {/* Khoảng dài (30, 90 ngày) chỉ ghi nhãn mỗi vài cột để chữ không đè lên nhau; bảng bên dưới có đủ từng ngày. */}
    <div aria-hidden="true" className="flex gap-[2px] text-[.68rem] text-[var(--cms-muted)]">{daily.map((day, index) => <span className="relative h-4 min-w-0 flex-1" key={day.date}>{index % labelStep === 0 ? <span className={`absolute top-0 whitespace-nowrap ${axisAlign(index, daily.length)}`}>{axisLabel(day.date)}</span> : null}</span>)}</div>
    <details className="text-[.76rem]">
      <summary className="cursor-pointer text-[var(--cms-muted)]">Xem dạng bảng</summary>
      <table className="mt-2 w-full text-left text-[.76rem]">
        <thead><tr className="text-[var(--cms-muted)]"><th className="py-1 font-semibold">Ngày</th><th className="py-1 text-right font-semibold">Lượt xem</th><th className="py-1 text-right font-semibold">Người truy cập</th></tr></thead>
        <tbody>{daily.map((day) => <tr className="border-t border-[var(--cms-border)]" key={day.date}><td className="py-1">{label(day.date)}</td><td className="py-1 text-right">{number.format(day.pageviews)}</td><td className="py-1 text-right">{number.format(day.visitors)}</td></tr>)}</tbody>
      </table>
    </details>
  </figure>;
}
