import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import type { AnalyticsOverview, AnalyticsTotals } from "@iorder/core/server/analytics/analytics.service";

import { TrafficChart } from "./traffic-chart";
import { AdminCard } from "./ui/admin-card";
import { AdminNotice } from "./ui/admin-feedback";
import { AdminPageBarMeta } from "./ui/admin-page-bar";

type Connected = Extract<AnalyticsOverview, { connection: "connected" }>;

const number = new Intl.NumberFormat("vi-VN");
const percent = new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 1 });
const metricLabels = ["Người truy cập", "Lượt xem trang", "Tỉ lệ thoát", "Thời gian trung bình"] as const;

function duration(seconds: number | null) {
  if (seconds === null) return "—";
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes} phút ${seconds % 60} giây` : `${seconds} giây`;
}

// So với 7 ngày liền trước. Chữ dùng màu chữ thường; mũi tên chỉ hướng, không dùng màu trạng thái.
function change(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return "Chưa đủ dữ liệu để so sánh";
  const ratio = (current - previous) / previous;
  return <>{ratio >= 0 ? <ArrowUpRight aria-hidden="true" size={12} /> : <ArrowDownRight aria-hidden="true" size={12} />}{ratio >= 0 ? "+" : "−"}{percent.format(Math.abs(ratio))} so với 7 ngày trước</>;
}

function metrics(totals: AnalyticsTotals, previous: AnalyticsTotals) {
  return [
    { value: number.format(totals.visitors), note: change(totals.visitors, previous.visitors) },
    { value: number.format(totals.pageviews), note: change(totals.pageviews, previous.pageviews) },
    { value: totals.bounceRate === null ? "—" : percent.format(totals.bounceRate), note: change(totals.bounceRate, previous.bounceRate) },
    { value: duration(totals.averageVisitSeconds), note: change(totals.averageVisitSeconds, previous.averageVisitSeconds) },
  ];
}

/** Dải bốn chỉ số 7 ngày, dùng chung ở Tổng quan và Thống kê truy cập. */
export function AnalyticsMetricTiles({ overview }: { overview: AnalyticsOverview }) {
  const items = overview.connection === "connected"
    ? metrics(overview.totals, overview.previous)
    : metricLabels.map(() => ({ value: "—", note: overview.connection === "error" ? "Không lấy được số liệu" : "Chưa kết nối thống kê" }));
  return <section aria-label="Tóm tắt truy cập 7 ngày" className="admin-metric-grid">
    {items.map((item, index) => <div className="admin-metric-card" key={metricLabels[index]}><small>{metricLabels[index]}</small><strong>{item.value}</strong><span className="admin-metric-card__note">{item.note}</span></div>)}
  </section>;
}

/** Trang xem nhiều nhất: thanh ngang cùng một màu, độ dài theo số người truy cập. */
export function TopPagesList({ pages }: { pages: Connected["topPages"] }) {
  if (!pages.length) return <p className="admin-dashboard__empty">Chưa có lượt xem trang nào trong 7 ngày qua.</p>;
  const max = Math.max(...pages.map((page) => page.visitors));
  return <ol className="m-0 grid list-none gap-2.5 p-0">{pages.map((page) => <li className="admin-field" key={page.path}>
    <div className="flex items-baseline justify-between gap-3 text-[13px]"><span className="truncate" title={page.path}>{page.path}</span><span className="admin-text-muted shrink-0 text-xs">{number.format(page.visitors)}</span></div>
    <span aria-hidden="true" className="block h-1 rounded-full bg-[var(--cms-hover)]"><span className="block h-full rounded-full bg-[var(--cms-primary)]" style={{ width: `${(page.visitors / max) * 100}%` }} /></span>
  </li>)}</ol>;
}

/** Biểu đồ lượt xem 7 ngày, hoặc trạng thái chưa kết nối/lỗi. */
export function AnalyticsTrafficPanel({ overview, height }: { overview: AnalyticsOverview; height?: number }) {
  if (overview.connection === "connected") return <TrafficChart daily={overview.daily} height={height} />;
  return <div className="admin-dashboard__analytics-empty">
    <strong>{overview.connection === "error" ? "Không lấy được số liệu truy cập" : "Chưa kết nối công cụ thống kê"}</strong>
    <span>{overview.connection === "error" ? overview.message : "Biểu đồ 7 ngày sẽ hiển thị khi Umami được cấu hình."}</span>
    <Link className="admin-link" href="/admin/analytics">Xem hướng dẫn kết nối</Link>
  </div>;
}

/** Trang "Thống kê truy cập": cùng dải chỉ số và biểu đồ với Tổng quan. */
export function AnalyticsStatus({ overview }: { overview: AnalyticsOverview }) {
  return <main className="admin-page">
    <h1 className="sr-only">Thống kê truy cập</h1>
    <AdminPageBarMeta>7 ngày gần nhất, so với 7 ngày liền trước</AdminPageBarMeta>
    <AnalyticsMetricTiles overview={overview} />
    {overview.connection === "connected" ? <section aria-label="Dữ liệu truy cập" className="admin-dashboard__analytics-grid">
      <AdminCard><header><h2>Lượt xem trang theo ngày</h2></header><AnalyticsTrafficPanel height={240} overview={overview} /></AdminCard>
      <AdminCard><header><h2>Trang xem nhiều nhất</h2></header><TopPagesList pages={overview.topPages} /></AdminCard>
    </section> : <AdminCard>
      <header><div><h2>{overview.connection === "error" ? "Kết nối Umami đang lỗi" : "Kết nối Umami"}</h2><p>Số liệu đo bằng Umami tự host, không dùng cookie, tính theo giờ Việt Nam.</p></div></header>
      {overview.connection === "error" ? <div className="mb-3"><AdminNotice tone="warning">{overview.message}</AdminNotice></div> : null}
      <ol className="m-0 grid gap-1.5 pl-5 text-[13px]">
        <li>Chạy dịch vụ <code>umami</code> (Compose production đã có; local: <code>docker compose --profile analytics up -d</code>).</li>
        <li>Đăng nhập giao diện Umami, đổi mật khẩu mặc định, thêm website và tạo API key.</li>
        <li>Điền <code>UMAMI_WEBSITE_ID</code>, <code>UMAMI_API_KEY</code> vào cấu hình môi trường rồi khởi động lại Backend và website.</li>
      </ol>
    </AdminCard>}
  </main>;
}
