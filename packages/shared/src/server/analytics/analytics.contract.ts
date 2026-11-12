import { z } from "zod";

// Phản hồi Umami v3 (self-hosted). Umami trả số dạng number hoặc chuỗi (bigint) tùy CSDL,
// nên coerce về number; trường thiếu coi là 0.
const count = z.coerce.number().int().nonnegative().catch(0);

export const umamiStatsSchema = z.object({
  pageviews: count,
  visitors: count,
  visits: count,
  bounces: count,
  totaltime: count,
  comparison: z.object({ pageviews: count, visitors: count, visits: count, bounces: count, totaltime: count }).partial().optional(),
});

const point = z.object({ x: z.string(), y: count });
export const umamiPageviewsSchema = z.object({ pageviews: z.array(point), sessions: z.array(point) });
export const umamiMetricsSchema = z.array(z.object({ x: z.string().nullable().transform((value) => value ?? ""), y: count }));

export type AnalyticsTotals = {
  /** Số người truy cập khác nhau (phiên). */
  visitors: number;
  /** Số lượt truy cập. */
  visits: number;
  /** Số lượt xem trang. */
  pageviews: number;
  /** Tỉ lệ thoát, 0–1; null khi chưa có lượt truy cập. */
  bounceRate: number | null;
  /** Thời gian trung bình mỗi lượt truy cập (giây); null khi chưa có lượt truy cập. */
  averageVisitSeconds: number | null;
};

export type AnalyticsOverview =
  | { connection: "not_connected"; periodDays: 7 }
  | { connection: "error"; periodDays: 7; message: string }
  | {
    connection: "connected";
    periodDays: 7;
    totals: AnalyticsTotals;
    /** Cùng chỉ số của 7 ngày liền trước, để so sánh. */
    previous: AnalyticsTotals;
    /** Lượt xem và người truy cập theo ngày (giờ Việt Nam), đủ 7 ngày kể cả ngày 0. */
    daily: Array<{ date: string; pageviews: number; visitors: number }>;
    /** Trang được xem nhiều nhất (đếm theo người truy cập). */
    topPages: Array<{ path: string; visitors: number }>;
  };
