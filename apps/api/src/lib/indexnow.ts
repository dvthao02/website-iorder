import { getPublishingConfig } from "@iorder/shared/server/settings/publishing.service";
import { indexNowEndpoint, indexNowRequestBody, isPublicSiteUrl, parseIndexNowKey, resolveIndexNowKey, selectIndexNowUrls } from "@iorder/shared/server/publishing/indexnow";
import { logger } from "@iorder/shared/server/shared/logger";

const timeoutMilliseconds = 5_000;
// Lưu liên tiếp một bài đã xuất bản không cần báo lại mỗi lần: mỗi URL tối đa một lần trong khoảng này.
const resubmitAfterMilliseconds = 10 * 60 * 1000;
const lastSubmitted = new Map<string, number>();
let disabledReported = false;

async function fetchWithTimeout(input: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);
  try { return await fetch(input, { ...init, cache: "no-store", signal: controller.signal }); } finally { clearTimeout(timeout); }
}

/**
 * Tự báo IndexNow cho các đường dẫn vừa làm mới khi chúng đã xuất bản và nằm trong sitemap. Tự bật khi có khóa
 * (tự sinh từ PUBLISH_WEB_REVALIDATE_SECRET, xem resolveIndexNowKey; INDEXNOW_DISABLED=true để tắt) và website có địa chỉ công khai, cho phép
 * công cụ tìm kiếm; thiếu một trong các điều kiện đó thì không gọi ra ngoài. Lỗi chỉ ghi log, không ảnh hưởng lưu nội dung.
 */
export async function submitPublishedUrls(paths: readonly string[]) {
  const key = resolveIndexNowKey(process.env);
  if (!key) {
    if (!disabledReported && process.env.INDEXNOW_KEY?.trim() && !parseIndexNowKey(process.env.INDEXNOW_KEY)) logger.warn("INDEXNOW_KEY không hợp lệ (cần 8–128 ký tự chữ, số, gạch ngang): bỏ qua IndexNow.");
    disabledReported = true;
    return;
  }
  const config = await getPublishingConfig();
  if (!config.siteUrl || !config.allowSearchIndexing || !isPublicSiteUrl(config.siteUrl)) return;

  const sitemapResponse = await fetchWithTimeout(new URL("/sitemap.xml", config.siteUrl).toString(), { headers: { accept: "application/xml" } });
  if (!sitemapResponse.ok) { logger.warn("IndexNow: không đọc được sitemap.", { status: sitemapResponse.status }); return; }
  const now = Date.now();
  const urls = selectIndexNowUrls({ paths, siteUrl: config.siteUrl, sitemap: await sitemapResponse.text() }).filter(url => now - (lastSubmitted.get(url) ?? 0) >= resubmitAfterMilliseconds);
  if (!urls.length) return;

  const response = await fetchWithTimeout(indexNowEndpoint, { method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(indexNowRequestBody({ siteUrl: config.siteUrl, key, urls })) });
  // 200: đã nhận; 202: nhận, đang xác minh khóa. Mã khác (403 khóa sai, 422 URL sai host, 429 gửi quá nhiều) thì không đánh dấu đã báo.
  if (response.status === 200 || response.status === 202) {
    for (const url of urls) lastSubmitted.set(url, now);
    logger.info("Đã báo IndexNow cho URL vừa xuất bản.", { count: urls.length, status: response.status });
  } else logger.warn("IndexNow từ chối yêu cầu.", { status: response.status, count: urls.length });
}
