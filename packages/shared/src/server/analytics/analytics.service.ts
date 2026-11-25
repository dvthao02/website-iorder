import { z } from "zod";

import { umamiMetricsSchema, umamiPageviewsSchema, umamiStatsSchema, type AnalyticsOverview, type AnalyticsTotals } from "./analytics.contract";
import { getCmsSecret } from "../secrets/secrets";
import { logger } from "../shared/logger";
import type { DashboardRange } from "../dashboard/dashboard-range";

export type { AnalyticsOverview, AnalyticsTotals } from "./analytics.contract";

const defaultPeriodDays: DashboardRange = 7;
const dayMilliseconds = 86_400_000;
// Việt Nam không có giờ mùa hè: UTC+7 cố định, nên mốc đầu ngày tính được không cần thư viện múi giờ.
const vietnamOffsetMilliseconds = 7 * 3_600_000;
const timezone = "Asia/Ho_Chi_Minh";
const requestTimeoutMilliseconds = 4_000;

type AnalyticsDependencies = {
  fetch: typeof fetch;
  env: Record<string, string | undefined>;
  now: () => Date;
  /** Biến kết nối Umami do Super Admin nhập ở CMS; chỉ dùng cho biến môi trường chưa đặt (biến môi trường luôn thắng). */
  cmsSecret?: (key: UmamiSecretKey) => Promise<string | undefined>;
};

type UmamiSecretKey = "umami_api_url" | "umami_api_key" | "umami_website_id";

type UmamiConfig = { apiUrl: string; apiKey: string; websiteId: string };

function readConfig(env: AnalyticsDependencies["env"], stored: Partial<Record<UmamiSecretKey, string>>): UmamiConfig | undefined {
  const apiUrl = (env.UMAMI_API_URL?.trim() || stored.umami_api_url?.trim())?.replace(/\/$/, "");
  const apiKey = env.UMAMI_API_KEY?.trim() || stored.umami_api_key?.trim();
  const websiteId = env.UMAMI_WEBSITE_ID?.trim() || stored.umami_website_id?.trim();
  if (!apiUrl || !apiKey || !websiteId || !z.string().uuid().safeParse(websiteId).success) return undefined;
  return { apiUrl, apiKey, websiteId };
}

function totalsFrom(stats: { pageviews?: number; visitors?: number; visits?: number; bounces?: number; totaltime?: number }): AnalyticsTotals {
  const visits = stats.visits ?? 0;
  return {
    visitors: stats.visitors ?? 0,
    visits,
    pageviews: stats.pageviews ?? 0,
    bounceRate: visits > 0 ? Math.min(1, (stats.bounces ?? 0) / visits) : null,
    averageVisitSeconds: visits > 0 ? Math.round((stats.totaltime ?? 0) / visits) : null,
  };
}

/** Ngày (YYYY-MM-DD, giờ Việt Nam) của một thời điểm. */
function vietnamDate(instant: number) {
  return new Date(instant + vietnamOffsetMilliseconds).toISOString().slice(0, 10);
}

const topPagesLimit = 8;
// Đường dẫn nội bộ không phải trang khách xem (khung xem trước CMS, API, thống kê): không đưa vào "Trang xem nhiều nhất",
// kể cả lượt đã ghi từ trước khi website thôi nạp Umami ở bản xem trước.
const internalPathPrefixes = ["/cms-preview", "/api", "/admin", "/stats"];
export const isInternalPath = (path: string) => internalPathPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`));

export function createAnalyticsService({ fetch: fetcher, env, now, cmsSecret }: AnalyticsDependencies) {
  const envNames: Record<UmamiSecretKey, string> = { umami_api_url: "UMAMI_API_URL", umami_api_key: "UMAMI_API_KEY", umami_website_id: "UMAMI_WEBSITE_ID" };
  // Chỉ hỏi CMS những biến mà môi trường chưa đặt; CMS lỗi hoặc chưa giải mã được thì coi như chưa có.
  async function readStored() {
    const stored: Partial<Record<UmamiSecretKey, string>> = {};
    for (const key of Object.keys(envNames) as UmamiSecretKey[]) {
      if (env[envNames[key]]?.trim() || !cmsSecret) continue;
      stored[key] = await cmsSecret(key).catch(() => undefined);
    }
    return stored;
  }

  async function request<T>(config: UmamiConfig, path: string, params: Record<string, string | number>, schema: z.ZodType<T>): Promise<T> {
    const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
    const response = await fetcher(`${config.apiUrl}/api/websites/${config.websiteId}/${path}?${query}`, {
      headers: { authorization: `Bearer ${config.apiKey}`, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(requestTimeoutMilliseconds),
    });
    if (!response.ok) throw new Error(`Umami trả HTTP ${response.status} cho ${path}.`);
    return schema.parse(await response.json());
  }

  // `periodDays`: số ngày gần nhất tính cả hôm nay (7, 30 hoặc 90); số liệu so sánh của Umami là khoảng liền trước cùng độ dài.
  // Không bao giờ ném lỗi: lỗi Umami được đổi thành `connection: "error"`.
  async function loadOverview(config: UmamiConfig, periodDays: DashboardRange): Promise<AnalyticsOverview> {
    // Số ngày đã chọn theo giờ Việt Nam, tính cả hôm nay: từ 0h ngày đầu đến hiện tại.
    const endAt = now().getTime();
    const todayStart = Date.parse(`${vietnamDate(endAt)}T00:00:00+07:00`);
    const startAt = todayStart - (periodDays - 1) * dayMilliseconds;
    const range = { startAt, endAt };

    try {
      const [stats, series, pages] = await Promise.all([
        request(config, "stats", range, umamiStatsSchema),
        request(config, "pageviews", { ...range, unit: "day", timezone }, umamiPageviewsSchema),
        request(config, "metrics", { ...range, type: "path", limit: topPagesLimit * 2 }, umamiMetricsSchema),
      ]);

      // Umami bỏ qua ngày không có dữ liệu: điền đủ số ngày để biểu đồ không bị thiếu cột.
      const byDate = (points: Array<{ x: string; y: number }>) => new Map(points.map((point) => [point.x.slice(0, 10), point.y]));
      const pageviews = byDate(series.pageviews);
      const visitors = byDate(series.sessions);
      const daily = Array.from({ length: periodDays }, (_, index) => {
        const date = vietnamDate(startAt + index * dayMilliseconds);
        return { date, pageviews: pageviews.get(date) ?? 0, visitors: visitors.get(date) ?? 0 };
      });

      return {
        connection: "connected",
        periodDays,
        totals: totalsFrom(stats),
        previous: totalsFrom(stats.comparison ?? {}),
        daily,
        topPages: pages.filter((page) => page.x && !isInternalPath(page.x)).slice(0, topPagesLimit).map((page) => ({ path: page.x, visitors: page.y })),
      };
    } catch (error) {
      logger.error("Không lấy được số liệu truy cập từ Umami.", { periodDays, error });
      return { connection: "error", periodDays, message: "Không lấy được số liệu từ công cụ thống kê. Kiểm tra dịch vụ Umami, API key và mã website." };
    }
  }

  // Tổng quan và Thống kê truy cập đều gọi hàm này ở MỖI lần mở trang và chờ Umami (ba truy vấn song song, tối đa 4 giây mỗi truy vấn): Umami chậm
  // hay ngừng thì trang nào cũng đứng 4 giây (đo: /admin và /admin/analytics ~4,0 giây mỗi lần, các trang khác 50–100 ms). Nên giữ kết quả theo
  // (kết nối, số ngày): thành công 60 giây, lỗi 30 giây (ngắn hơn để sửa xong cấu hình thì thấy sớm). Đổi khóa/địa chỉ Umami ở CMS đổi luôn khóa bộ đệm.
  // Hết hạn thì trả ngay bản cũ (tối đa 10 phút tuổi) và làm mới ở nền, nên không ai phải chờ lượt làm mới; chỉ lần đầu (hoặc sau hơn 10 phút
  // không ai mở) mới chờ Umami.
  const successCacheMilliseconds = 60_000;
  const errorCacheMilliseconds = 30_000;
  const staleCacheMilliseconds = 600_000;
  type CacheEntry = { storedAt: number; expiresAt: number; value: Promise<AnalyticsOverview>; refreshing: boolean };
  const cache = new Map<string, CacheEntry>();

  function remember(key: string, storedAt: number, value: Promise<AnalyticsOverview>) {
    const entry: CacheEntry = { storedAt, expiresAt: storedAt + successCacheMilliseconds, value, refreshing: false };
    if (cache.size >= 12 && !cache.has(key)) cache.clear();
    cache.set(key, entry);
    void value.then((overview) => { if (overview.connection === "error") entry.expiresAt = storedAt + errorCacheMilliseconds; });
    return entry;
  }

  async function getAnalyticsOverview(periodDays: DashboardRange = defaultPeriodDays): Promise<AnalyticsOverview> {
    const config = readConfig(env, await readStored());
    if (!config) return { connection: "not_connected", periodDays };

    const started = now().getTime();
    const key = [config.apiUrl, config.websiteId, config.apiKey, periodDays].join("\n");
    const hit = cache.get(key);
    if (hit && hit.expiresAt > started) return hit.value;
    if (hit && started - hit.storedAt < staleCacheMilliseconds) {
      // Bản cũ vẫn dùng được: trả ngay, làm mới ở nền (mỗi khóa một lượt làm mới tại một thời điểm).
      if (!hit.refreshing) {
        hit.refreshing = true;
        void loadOverview(config, periodDays).then((overview) => { remember(key, now().getTime(), Promise.resolve(overview)); });
      }
      return hit.value;
    }
    return remember(key, started, loadOverview(config, periodDays)).value;
  }

  return { getAnalyticsOverview };
}

const analyticsService = createAnalyticsService({ fetch: (...args) => fetch(...args), env: process.env, now: () => new Date(), cmsSecret: getCmsSecret });

/** Số liệu truy cập 7 ngày gần nhất từ Umami tự host; chưa cấu hình thì trả `not_connected`. */
export const getAnalyticsOverview = analyticsService.getAnalyticsOverview;
