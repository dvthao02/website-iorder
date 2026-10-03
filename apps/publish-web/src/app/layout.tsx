import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { StructuredData } from "@/components/site/structured-data";
import { getMediaById } from "@/lib/backend";
import { getExternalLinks } from "@/lib/backend";
import { getSiteProfile } from "@/lib/backend";
import { getPublishingConfig } from "@/lib/backend";

const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-inter" });

// Content and metadata are database-driven. Rendering at request time keeps a
// container build independent from production data and lets CMS edits publish
// without rebuilding the image.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [config, profile] = await Promise.all([getPublishingConfig(), getSiteProfile()]);
  const image = config.defaultOgMediaId && config.siteUrl ? await getMediaById(config.defaultOgMediaId) : null;
  const title = config.defaultTitle ?? profile?.companyName ?? "iOrder";
  const description = config.defaultDescription ?? "Nền tảng vận hành và giải pháp công nghệ cho doanh nghiệp.";
  return { metadataBase: config.siteUrl ? new URL(config.siteUrl) : undefined, title, description, robots: { index: config.allowSearchIndexing, follow: config.allowSearchIndexing }, openGraph: { title, description, siteName: title, images: image ? [{ url: image.url, alt: image.altText ?? title }] : undefined } };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [config, profile, externalLinks] = await Promise.all([getPublishingConfig(), getSiteProfile(), getExternalLinks()]);
  const logo = profile?.logoMediaId ? await getMediaById(profile.logoMediaId) : null;
  return (
    <html className={inter.variable} data-scroll-behavior="smooth" lang="vi">
      <body suppressHydrationWarning><StructuredData config={config} externalLinks={externalLinks} logoUrl={logo?.url ?? null} profile={profile} />{children}</body>
    </html>
  );
}
