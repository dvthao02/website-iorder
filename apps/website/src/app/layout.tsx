import { draftMode, headers } from "next/headers";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Google_Sans_Flex } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { StructuredData } from "@/components/site/structured-data";
import { getMediaById, getUiMessageOverrides } from "@/lib/backend";
import { getExternalLinks } from "@/lib/backend";
import { getSiteProfile } from "@/lib/backend";
import { getPublishingConfig } from "@/lib/backend";
import { getUmamiWebsiteId } from "@/lib/backend";
import { MessagesProvider } from "@/components/site/messages-provider";
import { getLocale } from "@/lib/locale";
import { robotsDirectives } from "@/lib/robots-meta";
import { localeTags } from "@iorder/shared/server/translations/locales";

// Font tròn, dễ đọc như các website phần mềm bán hàng phổ biến (KiotViet); có đủ dấu tiếng Việt.
// Next chưa có số đo của Google Sans Flex để tự tạo font dự phòng (báo "Failed to find font override values"),
// nên tắt hẳn bước đó và nêu rõ font hệ thống dùng trong lúc chờ tải.
const sans = Google_Sans_Flex({ subsets: ["latin", "vietnamese"], variable: "--font-brand", display: "swap", adjustFontFallback: false, fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"] });

// Content and metadata are database-driven. Rendering at request time keeps a
// container build independent from production data and lets CMS edits publish
// without rebuilding the image.
export const revalidate = 0;

/** Bản xem trước (khung xem trước của trình dựng trong CMS, bản nháp): không cho công cụ tìm kiếm lập chỉ mục và không tính vào thống kê truy cập. */
async function isPreviewRequest() {
  return (await draftMode()).isEnabled || Boolean((await headers()).get("x-iorder-builder-preview"));
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const [config, profile] = await Promise.all([getPublishingConfig(), getSiteProfile()]);
  const image = config.defaultOgMediaId && config.siteUrl ? await getMediaById(config.defaultOgMediaId) : null;
  const title = config.defaultTitle ?? profile?.companyName ?? "iOrder";
  const description = config.defaultDescription ?? "Nền tảng vận hành và giải pháp công nghệ cho doanh nghiệp.";
  const preview = await isPreviewRequest();
  return { metadataBase: config.siteUrl ? new URL(config.siteUrl) : undefined, title, description, robots: robotsDirectives(!preview && config.allowSearchIndexing, !preview && config.allowSearchIndexing), alternates: config.siteUrl && config.allowSearchIndexing ? { types: { "application/rss+xml": [{ url: "/feed.xml", title: `${title} – Tin tức` }] } } : undefined, openGraph: { type: "website", locale: localeTags[locale].openGraph, title, description, siteName: title, images: image ? [{ url: image.url, alt: image.altText ?? title }] : undefined } };
}

// Umami (tự host, không cookie). Script và điểm nhận sự kiện đi qua cùng domain website ở /stats/*
// (Caddy ở production, rewrite của Next ở local), nên không cần domain riêng hay cấu hình CORS.
// Mã website lấy từ Backend (biến môi trường UMAMI_WEBSITE_ID thắng, không có thì mã nhập ở CMS → Kết nối & khóa API).

// Không nạp Umami ở bản xem trước: mỗi lần người vận hành mở khung xem trước trong CMS sẽ không bị tính là một lượt xem trang /cms-preview.
export default async function RootLayout({ children }: { children: ReactNode }) {
  const [config, profile, externalLinks, umamiWebsiteId, preview] = await Promise.all([getPublishingConfig(), getSiteProfile(), getExternalLinks(), getUmamiWebsiteId(), isPreviewRequest()]);
  const logo = profile?.logoMediaId ? await getMediaById(profile.logoMediaId) : null;
  const [locale, messages] = await Promise.all([getLocale(), getUiMessageOverrides()]);
  return (
    <html className={sans.variable} data-scroll-behavior="smooth" lang={localeTags[locale].html}>
      <body suppressHydrationWarning><StructuredData config={config} externalLinks={externalLinks} logoUrl={logo?.url ?? null} profile={profile} /><MessagesProvider messages={messages}>{children}</MessagesProvider>{umamiWebsiteId && !preview ? <Script data-website-id={umamiWebsiteId} src="/stats/script.js" strategy="afterInteractive" /> : null}</body>
    </html>
  );
}
