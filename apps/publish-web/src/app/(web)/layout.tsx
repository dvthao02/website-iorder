import type { ReactNode } from "react";
import { draftMode } from "next/headers";
import { getExternalLinks, getNavigation, getPublishingConfig, getSiteProfile } from "@/lib/backend";
import { FloatingActions } from "@/components/site/floating-actions";
import { PreviewBanner } from "@/components/site/preview-banner";
import { SiteFooter } from "@/components/site/site-footer";

export const revalidate = 0;

// Khung chung của website: nội dung trang (mỗi trang tự gọi SiteHeader), chân trang và nút liên hệ nổi.
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [profile, footerNavigation, externalLinks, publishing, draft] = await Promise.all([getSiteProfile(), getNavigation("footer"), getExternalLinks(), getPublishingConfig(), draftMode()]);
  return <div className="site-shell">
    {draft.isEnabled ? <PreviewBanner /> : null}
    {children}
    <SiteFooter externalLinks={externalLinks} navigation={footerNavigation ?? []} profile={profile} tagline={publishing.defaultDescription} />
    <FloatingActions email={profile?.supportEmail ?? profile?.salesEmail ?? null} facebook={externalLinks?.facebook ?? null} hotline={profile?.hotline ?? null} zalo={externalLinks?.zalo ?? null} />
  </div>;
}
