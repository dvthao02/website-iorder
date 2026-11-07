import { SiteLink as Link } from "@/components/site/site-link";
import { ArrowRight, Check, Sparkles, UsersRound } from "lucide-react";
import type { OfferingContent, OfferingSectionKey } from "@iorder/core/server/offerings/offering-content.contract";
import { sectionFrame, type BlockFrame, type SectionSurface } from "@iorder/core/server/pages/block-layout";
import { resolveSettingLinks } from "@iorder/core/server/pages/setting-links";
import { getExternalLinks, getMediaById } from "@/lib/backend";
import { FaqList, FrameSection, SectionHeading, gridColumns } from "@/components/ui";
import { ConsultBand } from "./consult-band";
import { PricingSection } from "./section-blocks";

type Closing = { title: string; hotline: string | null };

// Nội dung trang chi tiết sản phẩm/giải pháp/dịch vụ (dữ liệu từ CMS › Sản phẩm), cùng hệ thống với trang chủ:
// tổng quan + tính năng (hai cột) → lợi ích (thẻ) → bảng giá → nội dung liên quan + hỏi đáp (hai cột) → dải tư vấn cuối trang.
// Mỗi phần một bố cục khác nhau thay vì chuỗi "tiêu đề giữa + hàng thẻ" giống hệt; nền trắng / xanh nhạt xen kẽ.
// Nền, màu tự chọn, ảnh nền, độ rộng, khoảng cách của từng phần chỉnh ở CMS › Sản phẩm › Giao diện các phần (cùng vỏ chung với khối trang).
export async function OfferingContent({ content, closing = null }: { content: OfferingContent; closing?: Closing | null }) {
  const pricing = content.pricing ? resolveSettingLinks(content.pricing, await getExternalLinks()) : null;
  const related = content.items.length > 0 || content.faq.length > 0;
  const present = (["overview", content.benefits.length ? "benefits" : null, pricing ? "pricing" : null, related ? "related" : null] as const).filter((key): key is OfferingSectionKey => key !== null);
  // "Tự động" xen kẽ trắng / xanh nhạt bắt đầu bằng trắng; phần chọn nền riêng vẫn làm mốc cho phần sau.
  let last: SectionSurface = "tinted";
  const frames = {} as Record<OfferingSectionKey, BlockFrame>;
  for (const key of present) {
    const frame = sectionFrame(content.appearance?.[key], { fallback: last === "white" ? "tinted" : "white", darkAllowed: true, spacing: "md", anchor: key === "pricing" ? "bang-gia" : null });
    last = frame.tone;
    const media = frame.background?.mediaId ? await getMediaById(frame.background.mediaId) : null;
    frames[key] = frame.background ? { ...frame, background: { ...frame.background, imageUrl: media?.mimeType.startsWith("image/") ? media.url : null } } : frame;
  }
  const dark = (key: OfferingSectionKey) => frames[key]?.tone === "dark";
  return <>
    {/* Tổng quan bên trái, tính năng chính là một thẻ danh sách đánh số bên phải (không còn 5 thẻ giống hệt nhau). */}
    <FrameSection frame={frames.overview}>
      <div className={`grid gap-10 ${content.features.length ? "lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-16" : "max-w-3xl"}`}>
        <div>
          <SectionHeading align="left" className="mb-6" dark={dark("overview")} title="Tổng quan" />
          <p className={`mb-0 text-lead whitespace-pre-line ${dark("overview") ? "text-white/85" : "text-ink/80"}`}>{content.description}</p>
          {/* "Phù hợp với" và "Giá trị nổi bật" (CMS › Sản phẩm): người đọc biết ngay giải pháp có dành cho mình không. */}
          {content.bestFor || content.keyValue ? <dl className="m-0 mt-8 grid gap-4 sm:grid-cols-2">
            {content.bestFor ? <div className="rounded-card border border-line bg-white p-5 shadow-card">
              <dt className="flex items-center gap-2 text-small font-bold tracking-wide text-brand-700 uppercase"><UsersRound aria-hidden="true" size={18} />Phù hợp với</dt>
              <dd className="m-0 mt-2 text-body font-semibold text-ink">{content.bestFor}</dd>
            </div> : null}
            {content.keyValue ? <div className="rounded-card border border-line bg-white p-5 shadow-card">
              <dt className="flex items-center gap-2 text-small font-bold tracking-wide text-accent-violet uppercase"><Sparkles aria-hidden="true" size={18} />Giá trị nổi bật</dt>
              <dd className="m-0 mt-2 text-body font-semibold text-ink">{content.keyValue}</dd>
            </div> : null}
          </dl> : null}
        </div>
        {content.features.length ? <div className="self-start rounded-card border border-line bg-white p-6 shadow-card sm:p-8">
          <h2 className="mb-2 text-h3 font-bold tracking-tight text-ink">Tính năng chính</h2>
          <ol className="m-0 list-none p-0">{content.features.map((feature, index) => <li className="flex items-start gap-4 border-b border-line py-4 last:border-b-0 last:pb-0" key={`${feature}-${index}`}>
            <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-control bg-brand-50 text-small font-bold text-brand-700">{String(index + 1).padStart(2, "0")}</span>
            <span className="pt-1 text-body font-semibold text-ink">{feature}</span>
          </li>)}</ol>
        </div> : null}
      </div>
    </FrameSection>

    {content.benefits.length ? <FrameSection frame={frames.benefits}>
      <SectionHeading align="left" dark={dark("benefits")} eyebrow="Lợi ích" title="Lợi ích mang lại" />
      <ul className={`m-0 grid list-none gap-5 p-0 ${content.benefits.length === 1 ? "max-w-xl" : content.benefits.length === 2 ? "md:grid-cols-2" : gridColumns(content.benefits.length)}`}>{content.benefits.map((benefit, index) => <li className="flex items-center gap-4 rounded-card border border-line bg-white p-5 shadow-card sm:p-6" key={`${benefit}-${index}`}>
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-600 text-white"><Check size={20} strokeWidth={3} /></span>
        <span className="text-lead font-semibold text-ink">{benefit}</span>
      </li>)}</ul>
    </FrameSection> : null}

    {pricing ? <PricingSection data={pricing} frame={frames.pricing} /> : null}

    {/* Nội dung liên quan và hỏi đáp đặt cạnh nhau trên máy tính để trang ngắn lại và không lặp tiêu đề giữa. */}
    {related ? <FrameSection frame={frames.related}>
      <div className={`grid gap-12 ${content.items.length && content.faq.length ? "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16" : "mx-auto max-w-4xl"}`}>
        {content.items.length ? <div>
          <SectionHeading align="left" className="mb-6" dark={dark("related")} eyebrow="Xem thêm" title="Nội dung liên quan" />
          <ul className="m-0 grid list-none gap-3 p-0">{content.items.map((item, index) => <li key={index}>{typeof item === "string"
            ? <span className="flex h-full items-center rounded-card border border-line bg-white px-5 py-4 text-ink shadow-card">{item}</span>
            : <Link className="group flex h-full items-center justify-between gap-3 rounded-card border border-line bg-white px-5 py-4 font-semibold text-ink shadow-card transition hover:border-brand-200 hover:text-brand-700" href={item.href}>{item.title}<ArrowRight aria-hidden="true" className="shrink-0 text-brand-600 transition group-hover:translate-x-0.5" size={18} /></Link>}</li>)}</ul>
        </div> : null}
        {content.faq.length ? <div>
          <SectionHeading align="left" className="mb-6" dark={dark("related")} eyebrow="Hỏi đáp" title="Câu hỏi thường gặp" />
          <FaqList items={content.faq.map(([question, answer]) => ({ question, answer }))} />
        </div> : null}
      </div>
    </FrameSection> : null}

    {/* Dải tư vấn cuối trang: người đọc hết trang có lối đi tiếp ngay (tư vấn hoặc gọi), hotline lấy từ Cài đặt. */}
    {closing ? <ConsultBand description="Để lại thông tin hoặc gọi trực tiếp — iOrder khảo sát nhu cầu và đề xuất phương án phù hợp với mô hình của bạn." hotline={closing.hotline} title={`Bắt đầu với ${closing.title}`} /> : null}
  </>;
}
