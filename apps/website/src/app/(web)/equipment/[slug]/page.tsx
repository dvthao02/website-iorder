import { notFound } from "next/navigation";
import type { ResolvingMetadata } from "next";
import { contentMetadata } from "@/lib/page-metadata";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { DetailHero } from "@/components/site/detail-hero";
import { FrameSection, Section, SectionHeading, TextLink } from "@/components/ui";
import { sectionFrame } from "@iorder/shared/server/pages/block-layout";
import { ConsultBand } from "@/components/site/consult-band";
import { EquipmentCard } from "@/components/site/collection-list";
import { getEquipment, getPublishingConfig, getSiteProfile } from "@/lib/backend";
import { ContentJsonLd } from "@/components/site/content-json-ld";
import { PageBlockRenderer } from "@/components/site/page-block-renderer";
import { BuilderAnchor } from "@/components/site/builder-anchor";
import { getBuilderPreviewContext } from "@/lib/builder-preview";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/structured-data";
export const revalidate = 0;
type Props = { params: Promise<{ slug: string }> };
const priceFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
export async function generateMetadata({ params }: Props, parent: ResolvingMetadata) {
  const { slug } = await params;
  const item = (await getEquipment(true)).find(row => row.slug === slug);
  return item ? contentMetadata({ title: item.seoTitle || `${item.name} | Thiết bị bán hàng iOrder`, description: item.seoDescription || item.summary, path: `/thiet-bi/${item.slug}`, canonicalUrl: item.canonicalUrl, seo: item.seo, image: item.coverUrl ? { url: item.coverUrl, alt: item.coverAlt } : null }, parent) : { title: "Không tìm thấy thiết bị | iOrder" };
}
// Trang chi tiết thiết bị: phần đầu một màn hình (ảnh trong khung, giá, bảo hành, nút liên hệ) → thông số kỹ thuật theo nhóm
// → thiết bị khác (ưu tiên cùng nhóm, tối đa 4) → dải tư vấn chọn thiết bị (hotline từ Cài đặt).
export default async function EquipmentDetail({ params }: Props) {
  const { slug } = await params;
  const all = await getEquipment(true);
  const item = all.find(row => row.slug === slug);
  if (!item) notFound();
  const others = [...all.filter(row => row.id !== item.id && row.groupName === item.groupName), ...all.filter(row => row.id !== item.id && row.groupName !== item.groupName)].slice(0, 4);
  const [config, profile] = await Promise.all([getPublishingConfig(), getSiteProfile()]);
  const site = config.siteUrl;
  // Trong canvas CMS: phần đầu trang là mục 1 (chỉ số -1), thông số kỹ thuật là mục 2 (chỉ số -2) của trình dựng.
  const inBuilder = Boolean(await getBuilderPreviewContext());
  return <><SiteHeader />{site ? <ContentJsonLd seo={item.seo} title={item.name} description={item.seoDescription || item.summary} path={`/thiet-bi/${item.slug}`} defaults={[productJsonLd(site, { name: item.name, description: item.seoDescription || item.summary, path: `/thiet-bi/${item.slug}`, imagePath: item.coverUrl ?? null, sku: item.modelCode, priceVnd: item.priceVnd, brand: profile?.companyName ?? "iOrder" }), breadcrumbJsonLd(site, [{ name: "Trang chủ", path: "/" }, { name: "Thiết bị", path: "/thiet-bi" }, { name: item.name, path: `/thiet-bi/${item.slug}` }])]} /> : null}
    <main id="noi-dung">
      <BuilderAnchor active={inBuilder} index={-1}>
      <DetailHero background={item.pageLayout?.hero?.background} fill={item.pageLayout?.hero?.height !== "auto"} layout={item.pageLayout?.hero?.layout} back={{ href: "/thiet-bi", label: "Tất cả thiết bị" }} image={item.coverUrl ? { url: item.coverUrl, alt: item.coverAlt ?? item.name } : null} imageStyle="product" label={item.groupName} primary={{ label: "Liên hệ mua hàng", href: "/lien-he" }} secondary={{ label: "Xem thiết bị khác", href: "/thiet-bi" }} summary={item.summary} title={item.name}>
        <p className="mt-6 mb-0 text-3xl font-bold tracking-tight text-brand-700" data-builder-field="priceVnd">{priceFormatter.format(item.priceVnd)}</p>
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          {item.modelCode ? <li className="flex items-center gap-2" data-builder-field="modelCode"><BadgeCheck aria-hidden="true" className="text-brand-600" size={18} />Mã máy: <strong className="font-semibold text-ink">{item.modelCode}</strong></li> : null}
          <li className="flex items-center gap-2" data-builder-field="warrantyMonths"><ShieldCheck aria-hidden="true" className="text-accent-green" size={18} />Bảo hành <strong className="font-semibold text-ink">{item.warrantyMonths} tháng</strong></li>
        </ul>
      </DetailHero>
      </BuilderAnchor>
      {item.specificationGroups.length ? <BuilderAnchor active={inBuilder} index={-2}><FrameSection frame={sectionFrame(item.pageLayout?.specs, { fallback: "white", darkAllowed: false, spacing: "md" })}>
        <SectionHeading align="left" eyebrow="Thông số" title="Thông số kỹ thuật" />
        <div className={`grid items-start gap-5 ${item.specificationGroups.length > 1 ? "lg:grid-cols-2" : "mx-auto max-w-3xl"}`}>{item.specificationGroups.map((group, index) => <section className="rounded-card border border-line bg-white p-6 shadow-card" data-builder-field={`specGroup:${index}`} key={index}>
          <h3 className="mb-4 text-h3 font-bold text-ink">{group.title}</h3>
          <dl className="m-0 divide-y divide-line">{group.items.map((spec, i) => {
            const importedFreeText = /^Thông tin \d+$/.test(spec.label);
            return <div className={`grid gap-1 py-3 ${importedFreeText ? "grid-cols-1" : "sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4"}`} data-builder-field={`spec:${index}:${i}`} key={i}><dt className={importedFreeText ? "sr-only" : "text-muted"}>{importedFreeText ? `${group.title}: thông tin chi tiết` : spec.label}</dt><dd className="m-0 font-medium whitespace-pre-line text-ink">{spec.value}</dd></div>;
          })}</dl>
        </section>)}</div>
      </FrameSection></BuilderAnchor> : null}
      {item.blocks?.length ? <PageBlockRenderer blocks={item.blocks} /> : null}
      {others.length ? <Section tone="tinted">
        <div className="mb-10 flex flex-col gap-5 sm:mb-12 md:flex-row md:items-end md:justify-between">
          <SectionHeading align="left" className="" eyebrow="Thiết bị" title="Thiết bị khác" />
          <TextLink className="button button--secondary shrink-0 self-start md:self-auto" href="/thiet-bi">Xem tất cả →</TextLink>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{others.map(other => <EquipmentCard item={other} key={other.id} />)}</div>
      </Section> : null}
      <ConsultBand actionLabel="Liên hệ mua hàng" description="iOrder tư vấn cấu hình theo mô hình bán hàng, giao máy, cài đặt và hướng dẫn sử dụng tại cửa hàng." hotline={profile?.hotline ?? null} title="Cần tư vấn chọn thiết bị?" />
    </main>
  </>;
}
