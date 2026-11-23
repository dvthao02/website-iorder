import type { ReactNode } from "react";
import { draftMode } from "next/headers";
import { defaultConsultPopup } from "@iorder/shared/server/settings/consult-popup.contract";
import { getConsultPopup, getExternalLinks, getNavigation, getPublishingConfig, getSiteProfile } from "@/lib/backend";
import { ConsultPopup } from "@/components/site/consult-popup";
import { FloatingActions } from "@/components/site/floating-actions";
import { PreviewBanner } from "@/components/site/preview-banner";
import { loadBlockImages } from "@/components/site/section-blocks";
import { SiteFooter } from "@/components/site/site-footer";
import { getBuilderPreviewContext } from "@/lib/builder-preview";
import { BuilderPreviewBridge } from "@/components/site/builder-preview-bridge";

export const revalidate = 0;

// Khung chung của website: nội dung trang (mỗi trang tự gọi SiteHeader), chân trang và nút liên hệ nổi.
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [profile, footerNavigation, externalLinks, publishing, storedPopup, draft] = await Promise.all([getSiteProfile(), getNavigation("footer"), getExternalLinks(), getPublishingConfig(), getConsultPopup(), draftMode()]);
  const builder = await getBuilderPreviewContext();
  // Biểu mẫu tư vấn và quảng cáo tự hiện (hai cấu hình độc lập): chưa cấu hình trong CMS thì dùng mặc định; không hiện khi xem trước bản nháp hoặc trong trình dựng trang.
  const popup = storedPopup ?? defaultConsultPopup;
  const popupEnabled = popup.form.enabled || popup.promo.enabled;
  const popupMedia = popup.promo.enabled && !builder && !draft.isEnabled ? (await loadBlockImages([popup.promo.mediaId]))[0] : undefined;
  return <div className="site-shell">
    {builder ? <BuilderPreviewBridge parentOrigin={builder.parentOrigin} /> : null}
    {draft.isEnabled ? <PreviewBanner /> : null}
    {children}
    <SiteFooter externalLinks={externalLinks} navigation={footerNavigation ?? []} profile={profile} tagline={publishing.defaultDescription} />
    {popupEnabled && !builder && !draft.isEnabled ? <ConsultPopup hotline={profile?.hotline ?? null} image={popupMedia ? { url: popupMedia.url, alt: popupMedia.altText ?? popup.promo.title, width: popupMedia.width ?? null, height: popupMedia.height ?? null } : null} popup={popup} /> : null}
    <FloatingActions email={profile?.supportEmail ?? profile?.salesEmail ?? null} facebook={externalLinks?.facebook ?? null} hotline={profile?.hotline ?? null} zalo={externalLinks?.zalo ?? null} />
  </div>;
}
