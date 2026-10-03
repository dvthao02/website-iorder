export type AnalyticsContentReference = {
  contentId: string;
  slug: string;
  url: string;
};

export type AnalyticsOverview = {
  connection: "not_connected";
  periodDays: 7;
  visits: null;
};

export type AnalyticsContentMetric = AnalyticsContentReference & {
  views: number | null;
};

// Analytics sẽ chỉ trả dữ liệu khi có provider thật. Khi tích hợp, provider phải
// đối chiếu URL chuẩn trước, sau đó slug và contentId để tránh gộp nhầm nội dung.
export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  return { connection: "not_connected", periodDays: 7, visits: null };
}
