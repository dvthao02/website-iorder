import { createHmac, timingSafeEqual } from "node:crypto";

// Ảnh chia sẻ tự sinh (Facebook/Zalo/LinkedIn) cho trang không có ảnh bìa và chưa đặt ảnh chia sẻ mặc định.
// Địa chỉ ảnh được ký: chỉ website này tạo được liên kết hợp lệ, nên không ai dùng /og để tạo ảnh có chữ tùy ý trên domain của bạn.

export const ogImageSize = { width: 1200, height: 630 } as const;
const maxTitleLength = 120;

function secret() {
  // Production bắt buộc có PUBLISH_WEB_REVALIDATE_SECRET (compose). Local không đặt thì dùng khóa cố định để vẫn xem được.
  return process.env.PREVIEW_SECRET?.trim() || process.env.PUBLISH_WEB_REVALIDATE_SECRET?.trim() || "iorder-local-og-image";
}

/** Chuẩn hóa tiêu đề trước khi ký và vẽ: gọn khoảng trắng, cắt ở độ dài tối đa. */
export function ogTitle(title: string) {
  const clean = title.replace(/\s+/g, " ").trim();
  return clean.length > maxTitleLength ? `${clean.slice(0, maxTitleLength - 1).trimEnd()}…` : clean;
}

export function signOgTitle(title: string) {
  return createHmac("sha256", secret()).update(`og:${ogTitle(title)}`).digest("hex").slice(0, 32);
}

export function verifyOgTitle(title: string, signature: string | null | undefined) {
  if (!signature || !/^[0-9a-f]{32}$/.test(signature)) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(signOgTitle(title)));
}

/** Đường dẫn tương đối tới ảnh (metadataBase của Next biến thành URL tuyệt đối). */
export function ogImagePath(title: string) {
  const clean = ogTitle(title);
  return `/og?${new URLSearchParams({ title: clean, sig: signOgTitle(clean) }).toString()}`;
}

/** Cỡ chữ theo độ dài tiêu đề để tiêu đề dài vẫn gọn trong khung 1200×630. */
export function ogTitleFontSize(title: string) {
  return title.length <= 32 ? 88 : title.length <= 60 ? 72 : title.length <= 90 ? 60 : 52;
}
