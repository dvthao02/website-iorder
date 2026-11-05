import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import type { OfferingContent } from "@iorder/core/server/offerings/offering-content.contract";
import { resolveSettingLinks } from "@iorder/core/server/pages/setting-links";
import { getExternalLinks } from "@/lib/backend";
import { Card, FaqList, IconTile, Section, SectionHeading } from "@/components/ui";
import { PricingSection } from "./section-blocks";

// Nội dung trang chi tiết sản phẩm/giải pháp/dịch vụ, cùng nhịp với khối trang (nền trắng / xanh nhạt xen kẽ,
// khoảng cách chuẩn): tổng quan → tính năng → lợi ích → bảng giá → nội dung liên quan + câu hỏi thường gặp.
export async function OfferingContent({ content }: { content: OfferingContent }) {
  const pricing = content.pricing ? resolveSettingLinks(content.pricing, await getExternalLinks()) : null;
  const present = ["overview", content.features.length ? "features" : null, content.benefits.length ? "benefits" : null, content.pricing ? "pricing" : null, content.items.length || content.faq.length ? "related" : null].filter(Boolean);
  const tone = (section: string): "white" | "tinted" => present.indexOf(section) % 2 === 0 ? "white" : "tinted";
  return <>
    <Section tone={tone("overview")} width="text">
      <SectionHeading className="mb-8" title="Tổng quan" />
      <p className="mb-0 text-lead whitespace-pre-line text-ink/80">{content.description}</p>
    </Section>

    {content.features.length ? <Section tone={tone("features")}>
      <SectionHeading eyebrow="Tính năng" title="Tính năng chính" />
      <ul className={`grid gap-4 ${content.features.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}>{content.features.map((feature, index) => <li key={`${feature}-${index}`}>
        <Card as="div"><span className="mb-4"><IconTile><Sparkles size={20} /></IconTile></span><p className="mb-0 text-lead font-semibold text-ink">{feature}</p></Card>
      </li>)}</ul>
    </Section> : null}

    {content.benefits.length ? <Section tone={tone("benefits")} width="narrow">
      <SectionHeading eyebrow="Lợi ích" title="Lợi ích mang lại" />
      <ul className="grid gap-3">{content.benefits.map((benefit, index) => <li className="flex items-start gap-4 rounded-card border border-line bg-white p-5 shadow-card" key={`${benefit}-${index}`}>
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-600 text-white"><Check size={16} strokeWidth={3} /></span><span className="pt-1 text-lead text-ink">{benefit}</span>
      </li>)}</ul>
    </Section> : null}

    {pricing ? <PricingSection data={pricing} frame={{ tone: tone("pricing"), spacing: "md", anchor: "bang-gia" }} /> : null}

    {content.items.length || content.faq.length ? <Section tone={tone("related")} width="narrow">
      {content.items.length ? <div className={content.faq.length ? "mb-16" : ""}>
        <SectionHeading className="mb-8" title="Nội dung liên quan" />
        <ul className="grid gap-3 sm:grid-cols-2">{content.items.map((item, index) => <li key={index}>{typeof item === "string"
          ? <span className="flex h-full items-center rounded-card border border-line bg-white px-5 py-4 text-ink shadow-card">{item}</span>
          : <Link className="group flex h-full items-center justify-between gap-3 rounded-card border border-line bg-white px-5 py-4 font-semibold text-ink shadow-card transition hover:border-brand-200 hover:text-brand-700" href={item.href}>{item.title}<ArrowRight aria-hidden="true" className="shrink-0 text-brand-600 transition group-hover:translate-x-0.5" size={18} /></Link>}</li>)}</ul>
      </div> : null}
      {content.faq.length ? <><SectionHeading className="mb-8" eyebrow="Hỏi đáp" title="Câu hỏi thường gặp" /><FaqList items={content.faq.map(([question, answer]) => ({ question, answer }))} /></> : null}
    </Section> : null}
  </>;
}
