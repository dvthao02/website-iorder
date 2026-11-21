import type { MetadataRoute } from "next";
import { getPublishingConfig, getSiteProfile } from "@/lib/backend";

export const revalidate = 0;

// Tệp kê khai website cho trình duyệt di động: tên, màu thanh địa chỉ và biểu tượng khi lưu về màn hình chính.
// Giữ chế độ "browser": đây là website giới thiệu, không phải ứng dụng cài đặt riêng.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [config, profile] = await Promise.all([getPublishingConfig(), getSiteProfile()]);
  const name = config.defaultTitle ?? profile?.companyName ?? "iOrder";
  return {
    name,
    short_name: profile?.companyName ?? name,
    description: config.defaultDescription ?? undefined,
    lang: "vi",
    start_url: "/",
    scope: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#1570e0",
    icons: [{ src: "/icon.png", sizes: "192x192", type: "image/png" }, { src: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  };
}
