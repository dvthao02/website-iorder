"use client";

import React, { useState } from "react";
import Link from "next/link";

import { contentSegmentLabels, formatLongDate, indexFromPosition, type ContentSegment, type ContentSegmentKey } from "../../lib/dashboard-metrics";

// Biểu đồ Tổng quan vẽ bằng SVG/CSS thuần (không thêm thư viện), dùng token màu của CMS nên đổi bảng màu hoặc chế độ tối là tự theo.
// Rê chuột vào bất kỳ biểu đồ nào cũng ra khung số liệu ngay: cột/đường theo ngày có khung riêng, các hình còn lại dùng `data-tip` (CSS thuần).
// Có nhãn chữ cho trình đọc màn hình; số theo ngày còn có bảng "Xem dạng bảng" để dùng được trên màn cảm ứng và bàn phím.

export type ChartTone = "primary" | "success" | "warning" | "info" | "neutral";

const number = new Intl.NumberFormat("vi-VN");
const percent = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

function dayLabel(date: string) {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

type DayPoint = { date: string; count: number };

/** Khung số liệu của một ngày: thứ ngày tháng năm, số lớn, và phần trăm trên tổng (nếu có). */
function DayTip({ point, unit, total, className, style }: { point: DayPoint; unit: string; total: number; className: string; style: React.CSSProperties }) {
  return <span className={className} role="status" style={style}>
    <small>{formatLongDate(point.date)}</small>
    <strong>{number.format(point.count)} {unit}</strong>
    {total > 0 && point.count > 0 ? <small>{percent.format((point.count / total) * 100)}% tổng của khoảng này</small> : null}
  </span>;
}

/** Cạnh nào của khung số liệu sát mép: dịch khung vào trong để không bị cắt. */
function tipAlign(index: number, count: number) {
  const ratio = count > 1 ? index / (count - 1) : 0.5;
  return ratio < 0.18 ? "start" : ratio > 0.82 ? "end" : "center";
}

/** Đường xu hướng nhỏ (sparkline) cho ô chỉ số: rê chuột để xem số của từng ngày; vùng tô nhạt dưới đường, điểm đang chọn được đánh dấu. */
export function Sparkline({ points, unit, label, tone = "primary" }: { points: readonly DayPoint[]; unit: string; label: string; tone?: ChartTone }) {
  const [active, setActive] = useState<number | null>(null);
  const width = 120;
  const height = 36;
  const values = points.map((point) => point.count);
  const total = values.reduce((sum, value) => sum + value, 0);
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const coords = values.map((value, index) => [index * step, height - 3 - (value / max) * (height - 8)] as const);
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const shown = coords[active ?? coords.length - 1];
  const current = active === null ? null : points[active];
  return <span className="admin-spark-wrap" onPointerLeave={() => setActive(null)}>
    <svg
      aria-label={label}
      className={`admin-spark admin-chart--${tone}`}
      onPointerMove={(event) => { const box = event.currentTarget.getBoundingClientRect(); setActive(indexFromPosition(event.clientX - box.left, box.width, points.length)); }}
      preserveAspectRatio="none"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      {coords.length ? <polygon className="admin-spark__area" points={`0,${height} ${line} ${width},${height}`} /> : null}
      <polyline className="admin-spark__line" points={line} />
      {shown ? <circle className="admin-spark__dot" cx={Math.min(Math.max(shown[0], 2.5), width - 2.5)} cy={shown[1]} r={active === null ? 2.5 : 3.4} /> : null}
    </svg>
    {current ? <DayTip className="admin-tip admin-tip--right" point={current} style={{}} total={total} unit={unit} /> : null}
  </span>;
}

/** Vòng tròn phần trăm (giá trị/tối đa) với số ở giữa; `tip` (nhiều dòng) hiện khi rê chuột, nhãn chữ cho trình đọc màn hình. */
export function RingGauge({ value, max, label, tip, tone = "primary", size = 64 }: { value: number; max: number; label: string; tip?: string; tone?: ChartTone; size?: number }) {
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  const radius = 15.9155; // chu vi = 100, nên độ dài nét là phần trăm
  return <span className="admin-ring-wrap" data-tip={tip ?? label}>
    <svg aria-label={label} className={`admin-ring admin-chart--${tone}`} height={size} role="img" viewBox="0 0 36 36" width={size}>
      <circle className="admin-ring__track" cx="18" cy="18" fill="none" r={radius} strokeWidth="3.4" />
      <circle className="admin-ring__value" cx="18" cy="18" fill="none" r={radius} strokeDasharray={`${(ratio * 100).toFixed(1)} 100`} strokeLinecap="round" strokeWidth="3.4" transform="rotate(-90 18 18)" />
      <text className="admin-ring__text" dominantBaseline="central" textAnchor="middle" x="18" y="18.5">{percent.format(ratio * 100)}%</text>
    </svg>
  </span>;
}

/** Biểu đồ cột theo ngày: rê chuột vào cột (cả khoảng trống phía trên) để xem ngày, số và tỉ lệ trên tổng; có bảng số bên dưới. */
export function DayBars({ days, unit, tone = "primary", emptyText }: { days: ReadonlyArray<DayPoint>; unit: string; tone?: ChartTone; emptyText: string }) {
  const [active, setActive] = useState<number | null>(null);
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const max = Math.max(1, ...days.map((day) => day.count));
  const peak = days.reduce((best, day) => day.count > best.count ? day : best, days[0] ?? { date: "", count: 0 });
  const width = 300;
  const height = 100;
  const slot = days.length ? width / days.length : width;
  const summary = total ? `${number.format(total)} ${unit} trong ${days.length} ngày, nhiều nhất ${number.format(peak.count)} vào ${dayLabel(peak.date)}` : `Chưa có ${unit} nào trong ${days.length} ngày`;
  const current = active === null ? null : days[active];
  return <figure className={`admin-daybars admin-chart--${tone}`}>
    <div className="admin-daybars__scale" aria-hidden="true"><span>{number.format(max)}</span><span>0</span></div>
    <div className="admin-daybars__plot" onPointerLeave={() => setActive(null)}>
      <svg aria-label={summary} className="admin-daybars__svg" preserveAspectRatio="none" role="img" viewBox={`0 0 ${width} ${height}`}>
        {[height / 2, height - 0.5].map((y) => <line className="admin-daybars__grid" key={y} x1="0" x2={width} y1={y} y2={y} />)}
        {days.map((day, index) => {
          const barHeight = day.count > 0 ? Math.max((day.count / max) * (height - 2), 3) : 0;
          return <g className={active === index ? "admin-daybars__bar admin-daybars__bar--active" : "admin-daybars__bar"} key={day.date}>
            <rect className="admin-daybars__hit" height={height} onPointerEnter={() => setActive(index)} onPointerMove={() => setActive(index)} width={slot} x={index * slot} y="0" />
            {barHeight ? <rect className="admin-daybars__fill" height={barHeight} rx="1.2" width={Math.max(slot - 2.4, 1)} x={index * slot + 1.2} y={height - barHeight} /> : null}
          </g>;
        })}
      </svg>
      {current ? <DayTip className={`admin-tip admin-tip--${tipAlign(active ?? 0, days.length)}`} point={current} style={{ left: `${(((active ?? 0) + 0.5) / days.length) * 100}%` }} total={total} unit={unit} /> : null}
    </div>
    <div className="admin-daybars__axis" aria-hidden="true"><span>{days[0] ? dayLabel(days[0].date) : ""}</span><span>{days.length ? dayLabel(days[Math.floor(days.length / 2)].date) : ""}</span><span>{days.length ? dayLabel(days[days.length - 1].date) : ""}</span></div>
    <figcaption>{total ? <><strong>{number.format(total)}</strong> {unit} · nhiều nhất {number.format(peak.count)} ngày {dayLabel(peak.date)}</> : emptyText}</figcaption>
    {total ? <details className="admin-daybars__table">
      <summary>Xem dạng bảng</summary>
      <table><thead><tr><th>Ngày</th><th>{unit[0].toLocaleUpperCase("vi") + unit.slice(1)}</th></tr></thead><tbody>{days.map((day) => <tr key={day.date}><td>{formatLongDate(day.date)}</td><td>{number.format(day.count)}</td></tr>)}</tbody></table>
    </details> : null}
  </figure>;
}

const segmentTone: Record<ContentSegmentKey, ChartTone> = { published: "success", pending: "warning", scheduled: "info", archived: "neutral" };

/** Chú giải màu cho các thanh trạng thái nội dung. */
export function SegmentLegend({ keys = ["published", "pending", "scheduled", "archived"] }: { keys?: readonly ContentSegmentKey[] }) {
  return <ul aria-label="Chú giải trạng thái" className="admin-legend">{keys.map((key) => <li key={key}><i className={`admin-legend__dot admin-chart--${segmentTone[key]}`} />{contentSegmentLabels[key]}</li>)}</ul>;
}

/** Một hàng thanh xếp chồng: loại nội dung, cơ cấu trạng thái, tổng. Rê chuột vào từng đoạn để xem trạng thái, số lượng và phần trăm; bấm để mở module. */
export function StackedRow({ label, href, segments }: { label: string; href: string; segments: readonly ContentSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const shown = segments.filter((segment) => segment.value > 0);
  const detail = shown.map((segment) => `${contentSegmentLabels[segment.key]}: ${number.format(segment.value)}`).join(" · ");
  return <Link className="admin-stack-row" href={href}>
    <span className="admin-stack-row__label">{label}</span>
    <span aria-hidden="true" className="admin-stack-row__bar">{shown.map((segment) => <i className={`admin-chart--${segmentTone[segment.key]}`} data-tip={`${label}\n${contentSegmentLabels[segment.key]}: ${number.format(segment.value)} (${percent.format((segment.value / total) * 100)}%)`} key={segment.key} style={{ flexGrow: segment.value }} />)}</span>
    <strong className="admin-stack-row__total" data-tip={detail ? `${label}: ${number.format(total)} mục\n${shown.map((segment) => `${contentSegmentLabels[segment.key]}: ${number.format(segment.value)}`).join("\n")}` : `${label}: chưa có nội dung`}>{number.format(total)}</strong>
    <span className="sr-only">{detail}</span>
  </Link>;
}

/** Ô chỉ số: nhãn, số lớn, ghi chú và một hình nhỏ (đường xu hướng hoặc vòng phần trăm) bên phải. */
export function KpiTile({ label, value, note, href, visual }: { label: string; value: string; note: string; href: string; visual: React.ReactNode }) {
  return <Link className="admin-kpi" href={href}>
    <span className="admin-kpi__text"><small>{label}</small><strong>{value}</strong><span>{note}</span></span>
    <span className="admin-kpi__visual">{visual}</span>
  </Link>;
}
