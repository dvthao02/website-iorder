// IndexNow (Bing, Yandex, Seznam, Naver…): báo cho công cụ tìm kiếm biết URL vừa được xuất bản hoặc sửa
// thay vì chờ họ tự quét lại sitemap. Chỉ là hàm thuần; việc gọi mạng nằm ở backend (apps/api/src/lib/indexnow.ts).

import { createHmac } from "node:crypto";

export const indexNowEndpoint = "https://api.indexnow.org/indexnow";
/** Website phục vụ khóa ở đường dẫn này; `keyLocation` trong yêu cầu trỏ về đây. */
export const indexNowKeyPath = "/indexnow.txt";
/** Tối đa của giao thức là 10.000 URL mỗi lần; một lần lưu nội dung chỉ chạm vài trang. */
export const indexNowMaxUrls = 100;

/** Khóa do người vận hành đặt (INDEXNOW_KEY): 8–128 ký tự chữ, số, gạch ngang. Sai định dạng thì coi như tắt tính năng. */
export function parseIndexNowKey(value: string | undefined) {
  const key = value?.trim();
  return key && /^[A-Za-z0-9-]{8,128}$/.test(key) ? key : null;
}

// Nhận cả process.env lẫn đối tượng thử; chỉ đọc INDEXNOW_KEY, INDEXNOW_DISABLED, PUBLISH_WEB_REVALIDATE_SECRET.
type IndexNowEnvironment = Readonly<Record<string, string | undefined>>;

/**
 * Khóa IndexNow dùng cho cả backend (gửi) và website (phục vụ /indexnow.txt) nên hai bên phải ra cùng một giá trị:
 * 1) INDEXNOW_DISABLED=true thì tắt; 2) có INDEXNOW_KEY hợp lệ thì dùng; 3) không thì tự sinh từ PUBLISH_WEB_REVALIDATE_SECRET
 * (HMAC một chiều, không lộ secret; khóa vốn công khai theo giao thức). Không có secret (máy local chưa cấu hình) thì tắt.
 */
export function resolveIndexNowKey(env: IndexNowEnvironment) {
  if (/^(1|true|yes)$/i.test(env.INDEXNOW_DISABLED?.trim() ?? "")) return null;
  if (env.INDEXNOW_KEY?.trim()) return parseIndexNowKey(env.INDEXNOW_KEY);
  const secret = env.PUBLISH_WEB_REVALIDATE_SECRET?.trim();
  return secret ? createHmac("sha256", secret).update("iorder:indexnow-key").digest("hex").slice(0, 32) : null;
}

function decodeXml(text: string) {
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

/** Các địa chỉ `<loc>` trong sitemap.xml. */
export function sitemapLocations(xml: string) {
  return Array.from(xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g), match => decodeXml(match[1]));
}

/** Máy chủ nội bộ không thể được công cụ tìm kiếm truy cập để xác minh khóa. */
export function isPublicSiteUrl(siteUrl: string) {
  try {
    const { hostname, protocol } = new URL(siteUrl);
    if (protocol !== "https:" && protocol !== "http:") return false;
    return hostname !== "localhost" && !hostname.endsWith(".local") && !hostname.endsWith(".internal") && !/^(127\.|10\.|192\.168\.|0\.0\.0\.0$|\[?::1\]?$)/.test(hostname);
  } catch { return false; }
}

/**
 * Chọn URL cần báo: chỉ những đường dẫn vừa được làm mới mà đang có trong sitemap. Sitemap đã loại bản nháp, trang bị
 * noindex/ẩn khỏi sitemap và trang chưa xuất bản, nên không cần lặp lại các quy tắc đó ở đây.
 */
export function selectIndexNowUrls(input: { paths: readonly string[]; siteUrl: string; sitemap: string }) {
  const listed = new Set(sitemapLocations(input.sitemap));
  const urls = new Set<string>();
  for (const path of input.paths) {
    if (!path.startsWith("/") || path.includes("[")) continue;
    const url = new URL(path, input.siteUrl).toString();
    if (listed.has(url)) urls.add(url);
    if (urls.size >= indexNowMaxUrls) break;
  }
  return [...urls];
}

export function indexNowRequestBody(input: { siteUrl: string; key: string; urls: readonly string[] }) {
  const origin = new URL(input.siteUrl).origin;
  return { host: new URL(input.siteUrl).host, key: input.key, keyLocation: `${origin}${indexNowKeyPath}`, urlList: [...input.urls] };
}
