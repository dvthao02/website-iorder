import { fixedWebsitePages } from "@iorder/shared/server/pages/pages.contract";

// Trang không nằm trong danh sách trang hệ thống nhưng có đường dẫn cố định trên website.
const extraLabels: Record<string, string> = { "/support": "Trung tâm hỗ trợ" };

/**
 * Tên dễ đọc của một đường dẫn trong báo cáo truy cập của CMS: "/" thành "Trang chủ", các trang hệ thống (Giới thiệu, Liên hệ, danh sách…)
 * lấy đúng tên đang dùng trong CMS. Đường dẫn khác (bài viết, sản phẩm…) giữ nguyên. Chỉ đổi cách hiện trong báo cáo: URL công khai không đổi.
 */
export function analyticsPageLabel(path: string): string {
  const normalized = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return fixedWebsitePages.find((page) => page.publicPath === normalized)?.label ?? extraLabels[normalized] ?? path;
}
