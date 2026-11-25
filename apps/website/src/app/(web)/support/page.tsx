import type { Metadata, ResolvingMetadata } from "next";
import { ChevronRight, CircleHelp, Download, Headset, MessageSquareText, MonitorPlay, Phone, type LucideIcon } from "lucide-react";

import { BreadcrumbJsonLd } from "@/components/site/page-hero";
import { SiteHeader } from "@/components/site/site-header";
import { SiteLink as Link } from "@/components/site/site-link";
import { DownloadList } from "@/components/site/download-list";
import { iconFor } from "@/components/site/guide-icons";
import { SupportSearch, type SupportSearchItem } from "@/components/site/support-search";
import { Container, DarkGlow, FaqList, SectionHeading } from "@/components/ui";
import { getEnabledSupportDownloads, getPublishedPage, getPublishedPostSummaries, getSiteProfile } from "@/lib/backend";
import { guideDescription } from "@/lib/guides";
import { getT } from "@/lib/messages";
import { contentMetadata } from "@/lib/page-metadata";

export const revalidate = 0;

export async function generateMetadata(_: unknown, parent: ResolvingMetadata): Promise<Metadata> {
  const t = await getT();
  return contentMetadata({ title: t("support.metaTitle"), description: t("support.metaDescription"), path: "/support" }, parent);
}

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
type Channel = { href: string; title: string; text: string; meta?: string; icon: LucideIcon };

// Trung tâm hỗ trợ (/support): một nơi để tìm mọi kênh hỗ trợ. Toàn bộ nội dung lấy từ CMS — bài hướng dẫn, tệp cài đặt,
// câu hỏi của trang "Câu hỏi thường gặp", trang Video / Hỗ trợ từ xa (chỉ hiện khi đã xuất bản), hotline, email,
// giờ làm việc trong Cài đặt — nên thêm/ẩn nội dung ở CMS là trang tự đổi theo, không cần sửa code.
// Bố cục: phần đầu gọn (tên trang, ô tìm, một dòng hotline) → "Hướng dẫn theo tính năng" (lưới thẻ) → các kênh hỗ trợ
// → tải phần mềm & driver → câu hỏi thường gặp → dải liên hệ.
export default async function SupportCenterPage() {
  const t = await getT();
  const [guides, downloads, faqPage, videosPage, remotePage, profile] = await Promise.all([
    getPublishedPostSummaries("guide"), getEnabledSupportDownloads(), getPublishedPage("support-faq"), getPublishedPage("support-videos"),
    getPublishedPage("remote-support"), getSiteProfile(),
  ]);
  const faqs = (faqPage?.blocks ?? []).flatMap((block) => block.isEnabled && block.type === "faq" ? block.data.items : []);

  const guideDescriptions = await Promise.all(guides.map(guideDescription));
  const guideItems = guides.map((guide, index) => ({ href: `/support/guides/${guide.slug}`, title: guide.title, description: guideDescriptions[index], categories: guide.categories.map((category) => category.name) }));

  const channels: Channel[] = [
    downloads.length ? { href: "/support/setup", title: t("support.setupTitle"), text: t("support.setupText"), meta: t("support.fileCount", { count: downloads.length }), icon: Download } : null,
    videosPage ? { href: "/support/videos", title: videosPage.title, text: t("support.videoText"), icon: MonitorPlay } : null,
    faqPage ? { href: "/support/faq", title: faqPage.title, text: t("support.faqText"), meta: faqs.length ? t("support.questionCount", { count: faqs.length }) : undefined, icon: CircleHelp } : null,
    remotePage ? { href: "/support/remote", title: remotePage.title, text: t("support.remoteText"), icon: Headset } : null,
    { href: "/contact", title: t("support.requestTitle"), text: t("support.requestText"), icon: MessageSquareText },
  ].filter((channel): channel is Channel => channel !== null);

  const searchItems: SupportSearchItem[] = [
    ...guideItems.map((item) => ({ title: item.title, href: item.href, kind: t("support.kindGuide"), text: [item.description, ...item.categories].filter(Boolean).join(" ") })),
    ...downloads.map((download) => ({ title: download.title, href: "/support/setup", kind: t("support.kindDownload"), text: download.description })),
    ...faqs.map((faq) => ({ title: faq.question, href: "/support/faq", kind: t("support.kindFaq"), text: faq.answer })),
  ];

  return <>
    <SiteHeader />
    <BreadcrumbJsonLd crumbs={[{ name: t("crumb.support"), path: "/support" }]} />
    <main id="noi-dung">
      {/* Phần đầu gọn: tên trang + ô tìm + một dòng gọi trực tiếp. Liên hệ đầy đủ (email, Zalo, gửi yêu cầu) nằm ở
          "Chọn cách nhận hỗ trợ" và dải cuối trang nên không lặp lại ở đây. */}
      <header className="support-hero">
        <Container className="flex flex-col items-center py-12 text-center sm:py-16">
          <h1 className="mb-0 text-h2 font-bold tracking-tight text-balance text-ink">{t("support.title")}</h1>
          <p className="mt-3 mb-0 text-lead text-muted">{t("support.lead")}</p>
          <div className="mt-6 w-full max-w-2xl text-left"><SupportSearch items={searchItems} suggestions={[]} /></div>
          {profile?.hotline ? <p className="mt-5 mb-0 text-small text-muted">{t("support.callDirect")} <a className="font-semibold text-ink hover:text-brand-700 hover:underline" href={tel(profile.hotline)}>{profile.hotline}</a>{profile.workingHours ? ` (${profile.workingHours})` : ""}</p> : null}
        </Container>
      </header>

      {/* Hướng dẫn theo tính năng: lưới thẻ gọn (biểu tượng, tên, mô tả ngắn) cùng kiểu trang Hướng dẫn sử dụng; tối đa 8 bài,
          còn lại xem ở trang tổng hợp. */}
      {guideItems.length ? <section aria-labelledby="huong-dan-tinh-nang" className="bg-white"><Container className="py-12 sm:py-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <h2 className="mb-0 text-h2 font-bold tracking-tight text-ink" id="huong-dan-tinh-nang">{t("support.guidesTitle")}</h2>
            <p className="mt-2 mb-0 text-body text-muted">{t("support.guidesText")}</p>
          </div>
          <Link className="text-small font-semibold text-brand-700 hover:underline" href="/support/guides">{t("support.allGuides", { count: guideItems.length })}</Link>
        </div>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">{guideItems.slice(0, 8).map((item) => {
          const Icon = iconFor(item.title);
          return <li key={item.href}><Link className="guide-card group" href={item.href}>
            <Icon aria-hidden="true" className="guide-card__icon" size={20} strokeWidth={1.7} />
            <span className="min-w-0 flex-1">
              <span className="guide-card__title block font-semibold text-ink group-hover:text-brand-700">{item.title}</span>
              {item.description ? <span className="mt-1 line-clamp-2 text-small text-muted">{item.description}</span> : null}
            </span>
          </Link></li>;
        })}</ul>
      </Container></section> : null}

      <section aria-label={t("support.channelsLabel")} className="bg-surface-tinted"><Container className="py-12 sm:py-16">
        <SectionHeading align="left" className="mb-6" description={t("support.channelsText")} title={t("support.channelsTitle")} />
        {/* Số cột theo số kênh để hàng cuối không lẻ một thẻ: 4 kênh → 2 cột, 5–6 kênh → 3 cột. */}
        <ul className={`m-0 grid list-none gap-4 p-0 sm:grid-cols-2 ${channels.length === 4 || channels.length === 2 ? "" : "lg:grid-cols-3"}`}>{channels.map(({ href, title, text, meta, icon: Icon }) => <li key={href}>
          <Link className="support-channel group" href={href}>
            <span aria-hidden="true" className="support-channel__icon"><Icon size={24} strokeWidth={1.8} /></span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2"><span className="text-lead font-bold text-ink group-hover:text-brand-700">{title}</span>{meta ? <span className="text-caption font-semibold text-brand-700">{meta}</span> : null}</span>
              <span className="mt-1 block text-small text-muted">{text}</span>
            </span>
            <ChevronRight aria-hidden="true" className="shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-brand-600" size={20} />
          </Link>
        </li>)}</ul>
      </Container></section>

      {downloads.length ? <section className="bg-white"><Container className="grid gap-8 py-12 sm:py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-12">
        <div>
          <SectionHeading align="left" className="mb-0" description={t("support.downloadsText")} title={t("support.downloadsTitle")} />
          <Link className="mt-5 inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline" href="/support/setup">{downloads.length > 4 ? t("support.allFiles", { count: downloads.length }) : t("support.setupGuide")} <ChevronRight aria-hidden="true" size={16} /></Link>
        </div>
        <DownloadList columns={1} grouped={false} items={downloads.slice(0, 4)} t={t} />
      </Container></section> : null}

      {faqs.length ? <section className="bg-surface-tinted"><Container className="py-12 sm:py-16" width="narrow">
        <SectionHeading align="left" className="mb-6" title={t("support.faqTitle")} />
        <FaqList items={faqs.slice(0, 6)} />
        {faqs.length > 6 ? <p className="mt-6 mb-0 text-center"><Link className="font-semibold text-brand-700 hover:underline" href="/support/faq">{t("support.allQuestions", { count: faqs.length })}</Link></p> : null}
      </Container></section> : null}

      <section aria-label={t("support.bandLabel")} className="support-band relative isolate overflow-clip"><DarkGlow /><Container className="flex flex-col items-start gap-6 py-12 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="mb-0 text-h2 font-bold tracking-tight text-white">{t("support.bandTitle")}</h2>
          <p className="mt-2 mb-0 text-lead text-white/80">{t("support.bandText", { hours: profile?.workingHours ? ` (${profile.workingHours})` : "" })}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {profile?.hotline ? <a className="button button--light" href={tel(profile.hotline)}><Phone aria-hidden="true" size={18} />{t("floating.call", { hotline: profile.hotline })}</a> : null}
          {remotePage ? <Link className="button button--outline-light" href="/support/remote">{t("support.remote")}</Link> : null}
          <Link className="button button--outline-light" href="/contact">{t("support.requestTitle")}</Link>
        </div>
      </Container></section>
    </main>
  </>;
}
