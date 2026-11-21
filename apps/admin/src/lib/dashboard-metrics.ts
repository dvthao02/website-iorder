import type { DashboardContentSummary } from "@iorder/shared/server/dashboard/dashboard-content.service";
import type { SeoAuditResult } from "@iorder/shared/server/seo-audit/seo-audit";

type DashboardContentStat = DashboardContentSummary["pages"];
type DailyPoint = DashboardContentSummary["activity"][number];

// Số liệu thuần cho các biểu đồ ở Tổng quan, tách khỏi giao diện để kiểm thử được.

export type ContentSegmentKey = "published" | "pending" | "scheduled" | "archived";
export type ContentSegment = { key: ContentSegmentKey; value: number };

export const contentSegmentLabels: Record<ContentSegmentKey, string> = {
  published: "Đã xuất bản",
  pending: "Bản nháp / chờ duyệt",
  scheduled: "Hẹn giờ",
  archived: "Đã lưu trữ",
};

/** Các phần của một loại nội dung theo trạng thái. Lưu trữ = phần còn lại của tổng (các trạng thái khác đã được đếm riêng). */
export function contentSegments(stat: Pick<DashboardContentStat, "total" | "published" | "pending" | "scheduled">): ContentSegment[] {
  const archived = Math.max(stat.total - stat.published - stat.pending - stat.scheduled, 0);
  return [
    { key: "published", value: stat.published },
    { key: "pending", value: stat.pending },
    { key: "scheduled", value: stat.scheduled },
    { key: "archived", value: archived },
  ];
}

export function sumDays(points: readonly DailyPoint[]) {
  return points.reduce((total, point) => total + point.count, 0);
}

/** Điểm SEO trung bình (0–100) của mọi nội dung đang hiển thị: tổng mục đạt / tổng mục áp dụng. null khi chưa có nội dung nào để chấm. */
export function seoAverageScore(audit: Pick<SeoAuditResult, "rows" | "healthy">): number | null {
  let passed = 0;
  let total = 0;
  for (const row of [...audit.rows, ...audit.healthy]) { passed += row.score.passed; total += row.score.total; }
  return total ? Math.round((passed / total) * 100) : null;
}

/** Chỉ số điểm gần nhất với vị trí con trỏ trên một đường/dải có `count` điểm trải đều theo chiều ngang (`offset` tính từ mép trái, `width` là bề rộng). */
export function indexFromPosition(offset: number, width: number, count: number) {
  if (count <= 0 || width <= 0) return null;
  if (count === 1) return 0;
  return Math.min(Math.max(Math.round((offset / width) * (count - 1)), 0), count - 1);
}

const longDate = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
/** "2026-11-19" → "Thứ Năm, 19/11/2026" (ngày đã là giờ Việt Nam nên đọc ở UTC để không lệch ngày). */
export function formatLongDate(date: string) {
  return longDate.format(new Date(`${date}T00:00:00Z`));
}
