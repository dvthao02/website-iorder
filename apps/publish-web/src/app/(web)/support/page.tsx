import type { Metadata, ResolvingMetadata } from "next";
import { BookOpen, ChevronRight, CircleHelp, Clock, Download, Headset, Mail, MessageSquareText, MonitorPlay, Phone, type LucideIcon } from "lucide-react";

import { BreadcrumbJsonLd } from "@/components/site/page-hero";
import { SiteHeader } from "@/components/site/site-header";
import { SiteLink as Link } from "@/components/site/site-link";
import { SupportQuickStart, type QuickStartGroup } from "@/components/site/support-quickstart";
import { SupportSearch, type SupportSearchItem } from "@/components/site/support-search";
import { Container, FaqList, SectionHeading } from "@/components/ui";
import { getEnabledSupportDownloads, getExternalLinks, getPublishedPage, getPublishedPostSummaries, getSiteProfile } from "@/lib/backend";
import { guideDescription } from "@/lib/guides";
import { contentMetadata } from "@/lib/page-metadata";

export const revalidate = 0;

const description = "Tra cứu hướng dẫn sử dụng, tải phần mềm và driver cài đặt, xem câu hỏi thường gặp hoặc liên hệ đội ngũ kỹ thuật iOrder để được hỗ trợ nhanh.";
export async function generateMetadata(_: unknown, parent: ResolvingMetadata): Promise<Metadata> {
  return contentMetadata({ title: "Trung tâm hỗ trợ iOrder", description, path: "/ho-tro" }, parent);
}

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
type Channel = { href: string; title: string; text: string; meta?: string; icon: LucideIcon };

// Trung tâm hỗ trợ (/ho-tro): một nơi để tìm mọi kênh hỗ trợ. Toàn bộ nội dung lấy từ CMS — bài hướng dẫn, tệp cài đặt,
// câu hỏi của trang "Câu hỏi thường gặp", trang Video / Hỗ trợ từ xa (chỉ hiện khi đã xuất bản), hotline, email,
// giờ làm việc trong Cài đặt — nên thêm/ẩn nội dung ở CMS là trang tự đổi theo, không cần sửa code.
// Bố cục: phần đầu căn giữa (tìm nhanh + liên hệ nhanh) → "Làm quen với iOrder" (thẻ trượt theo nhóm) → các kênh hỗ trợ
// → tải phần mềm & driver → câu hỏi thường gặp → dải liên hệ.
export default async function SupportCenterPage() {
  const [guides, downloads, faqPage, videosPage, remotePage, profile, links] = await Promise.all([
    getPublishedPostSummaries("guide"), getEnabledSupportDownloads(), getPublishedPage("support-faq"), getPublishedPage("support-videos"),
    getPublishedPage("remote-support"), getSiteProfile(), getExternalLinks(),
  ]);
  const faqs = (faqPage?.blocks ?? []).flatMap((block) => block.isEnabled && block.type === "faq" ? block.data.items : []);
  const supportEmail = profile?.supportEmail ?? profile?.salesEmail ?? null;

  const guideDescriptions = await Promise.all(guides.map(guideDescription));
  const guideItems = guides.map((guide, index) => ({ href: `/ho-tro/huong-dan/${guide.slug}`, title: guide.title, description: guideDescriptions[index], cover: guide.cover ? { url: guide.cover.url, alt: guide.cover.altText } : null, category: guide.categories[0]?.name ?? null, categories: guide.categories.map((category) => category.name) }));
  // Nhóm theo chuyên mục: "Tất cả" + từng chuyên mục có bài (chỉ hiện thanh chọn khi có từ hai nhóm).
  const categoryNames = [...new Set(guideItems.flatMap((item) => item.categories))];
  const quickStartGroups: QuickStartGroup[] = guideItems.length ? [
    { key: "tat-ca", label: "Tất cả", items: guideItems },
    ...categoryNames.map((name) => ({ key: name, label: name, items: guideItems.filter((item) => item.categories.includes(name)) })),
  ] : [];

  const channels: Channel[] = [
    // "Hướng dẫn sử dụng" chỉ là kênh riêng khi chưa có mục "Làm quen" (đã liệt kê bài và link Tất cả bài hướng dẫn).
    guides.length && !quickStartGroups.length ? { href: "/ho-tro/huong-dan", title: "Hướng dẫn sử dụng", text: "Từng bước thiết lập, bán hàng, kho, báo cáo và kết ca.", meta: `${guides.length} bài`, icon: BookOpen } : null,
    downloads.length ? { href: "/ho-tro/cai-dat", title: "Hỗ trợ cài đặt", text: "Tải phần mềm, driver máy in, máy quét và công cụ cài đặt.", meta: `${downloads.length} tệp`, icon: Download } : null,
    videosPage ? { href: "/ho-tro/video", title: videosPage.title, text: "Xem thao tác trực quan qua video ngắn.", icon: MonitorPlay } : null,
    faqPage ? { href: "/ho-tro/faq", title: faqPage.title, text: "Câu trả lời nhanh cho các thắc mắc hay gặp.", meta: faqs.length ? `${faqs.length} câu hỏi` : undefined, icon: CircleHelp } : null,
    remotePage ? { href: "/ho-tro-tu-xa", title: remotePage.title, text: "Kỹ thuật viên kết nối vào máy để xử lý giúp bạn.", icon: Headset } : null,
    { href: "/lien-he", title: "Gửi yêu cầu hỗ trợ", text: "Để lại thông tin, iOrder liên hệ lại trong giờ làm việc.", icon: MessageSquareText },
  ].filter((channel): channel is Channel => channel !== null);

  const searchItems: SupportSearchItem[] = [
    ...guideItems.map((item) => ({ title: item.title, href: item.href, kind: "Hướng dẫn", text: [item.description, ...item.categories].filter(Boolean).join(" ") })),
    ...downloads.map((download) => ({ title: download.title, href: "/ho-tro/cai-dat", kind: "Tệp cài đặt", text: download.description })),
    ...faqs.map((faq) => ({ title: faq.question, href: "/ho-tro/faq", kind: "Câu hỏi", text: faq.answer })),
  ];
  // Gợi ý nhanh: tên các bài hướng dẫn ngắn (thường là tên chức năng: Bán hàng, Kết ca…).
  const suggestions = guides.map((guide) => guide.title).filter((title) => title.length <= 18).slice(0, 5);

  return <>
    <SiteHeader />
    <BreadcrumbJsonLd crumbs={[{ name: "Hỗ trợ", path: "/ho-tro" }]} />
    <main id="noi-dung">
      <header className="support-hero">
        <Container className="flex flex-col items-center py-10 text-center sm:py-14">
          <nav aria-label="Đường dẫn"><ol className="m-0 flex list-none items-center gap-1.5 p-0 text-small text-muted">
            <li><Link className="transition hover:text-brand-700" href="/">Trang chủ</Link></li>
            <li className="flex items-center gap-1.5"><ChevronRight aria-hidden="true" size={14} /><span aria-current="page" className="font-semibold text-ink">Hỗ trợ</span></li>
          </ol></nav>
          <p className="mt-6 mb-0 inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-small font-semibold text-brand-700">Trung tâm hỗ trợ iOrder</p>
          <h1 className="mt-3 mb-0 text-[2rem] leading-[1.15] font-bold tracking-tight text-balance text-ink sm:text-[2.5rem] xl:text-[2.75rem]">Chúng tôi có thể giúp gì cho bạn?</h1>
          <p className="mt-3 mb-7 max-w-2xl text-lead text-muted">{description}</p>
          <div className="w-full max-w-2xl text-left"><SupportSearch items={searchItems} suggestions={suggestions} /></div>
          {profile?.hotline || supportEmail || profile?.workingHours ? <ul aria-label="Liên hệ hỗ trợ nhanh" className="support-hero__contacts">
            {profile?.hotline ? <li><a href={tel(profile.hotline)}><Phone aria-hidden="true" size={16} /><strong>{profile.hotline}</strong></a></li> : null}
            {profile?.workingHours ? <li><Clock aria-hidden="true" size={16} />{profile.workingHours}</li> : null}
            {supportEmail ? <li><a href={`mailto:${supportEmail}`}><Mail aria-hidden="true" size={16} />{supportEmail}</a></li> : null}
            {links?.zalo ? <li><a href={links.zalo} rel="noopener noreferrer" target="_blank"><MessageSquareText aria-hidden="true" size={16} />Chat Zalo</a></li> : null}
          </ul> : null}
        </Container>
      </header>

      {quickStartGroups.length ? <section aria-label="Làm quen với iOrder" className="bg-white"><Container className="py-12 sm:py-16">
        <SectionHeading description={`${guideItems.length} bài hướng dẫn theo từng bước để vận hành cửa hàng cùng iOrder ngay từ ngày đầu.`} eyebrow="Bắt đầu nhanh" title="Làm quen với iOrder" />
        <SupportQuickStart groups={quickStartGroups} />
        <p className="mt-8 mb-0 text-center text-small text-muted">Xem thêm: <Link className="font-semibold text-brand-700 hover:underline" href="/ho-tro/huong-dan">Tất cả bài hướng dẫn →</Link></p>
      </Container></section> : null}

      <section aria-label="Các kênh hỗ trợ" className="bg-surface-tinted"><Container className="py-12 sm:py-16">
        <SectionHeading className="mb-8" description="Chọn kênh phù hợp, đội ngũ kỹ thuật iOrder luôn sẵn sàng đồng hành." eyebrow="Kênh hỗ trợ" title="Chọn cách nhận hỗ trợ" />
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
          <SectionHeading align="left" className="mb-0" description="Phần mềm, driver và công cụ cần cho máy bán hàng, máy in, máy quét." eyebrow="Hỗ trợ cài đặt" title="Tải phần mềm & driver" />
          <Link className="mt-5 inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline" href="/ho-tro/cai-dat">{downloads.length > 4 ? `Xem tất cả ${downloads.length} tệp` : "Xem hướng dẫn cài đặt"} <ChevronRight aria-hidden="true" size={16} /></Link>
        </div>
        <ul className="m-0 grid list-none gap-3 p-0">{downloads.slice(0, 4).map((download) => <li className="flex items-center gap-4 rounded-card border border-line bg-white p-5 shadow-card" key={download.id}>
          <span aria-hidden="true" className="support-channel__icon"><Download size={22} /></span>
          <span className="min-w-0 flex-1"><span className="block font-bold text-ink">{download.title}</span>{download.description || download.meta ? <span className="mt-0.5 block truncate text-small text-muted">{download.description ?? download.meta}</span> : null}</span>
          <a className="button button--primary shrink-0" download href={download.downloadUrl}>Tải xuống</a>
        </li>)}</ul>
      </Container></section> : null}

      {faqs.length ? <section className="bg-surface-tinted"><Container className="py-12 sm:py-16" width="narrow">
        <SectionHeading eyebrow="Câu hỏi thường gặp" title="Thắc mắc hay gặp" />
        <FaqList items={faqs.slice(0, 6)} />
        {faqs.length > 6 ? <p className="mt-6 mb-0 text-center"><Link className="font-semibold text-brand-700 hover:underline" href="/ho-tro/faq">Xem tất cả {faqs.length} câu hỏi →</Link></p> : null}
      </Container></section> : null}

      <section aria-label="Liên hệ đội ngũ hỗ trợ" className="support-band"><Container className="flex flex-col items-start gap-6 py-12 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="mb-0 text-h2 font-bold tracking-tight text-white">Chưa tìm thấy câu trả lời?</h2>
          <p className="mt-2 mb-0 text-lead text-white/80">Đội ngũ kỹ thuật iOrder sẵn sàng hỗ trợ{profile?.workingHours ? ` (${profile.workingHours})` : ""}.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {profile?.hotline ? <a className="button button--light" href={tel(profile.hotline)}><Phone aria-hidden="true" size={18} />Gọi {profile.hotline}</a> : null}
          {remotePage ? <Link className="button button--outline-light" href="/ho-tro-tu-xa">Hỗ trợ từ xa</Link> : null}
          <Link className="button button--outline-light" href="/lien-he">Gửi yêu cầu hỗ trợ</Link>
        </div>
      </Container></section>
    </main>
  </>;
}
