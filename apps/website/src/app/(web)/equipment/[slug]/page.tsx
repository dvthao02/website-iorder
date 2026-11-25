import { notFound } from "next/navigation";
import type { ResolvingMetadata } from "next";
import { contentMetadata } from "@/lib/page-metadata";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { getT } from "@/lib/messages";
import { DetailHero } from "@/components/site/detail-hero";
import { loadBlockImages } from "@/components/site/section-blocks";
import { FrameSection, IconTile, SectionHeading, TextLink } from "@/components/ui";
import { withBackgroundImage } from "@/lib/frame-media";
import { sectionFrame } from "@iorder/shared/server/pages/block-layout";
import { ConsultBand } from "@/components/site/consult-band";
import { EquipmentInquiry } from "@/components/site/equipment-inquiry";
import { EquipmentCard } from "@/components/site/collection-list";
import { getEquipment, getPublishingConfig, getSiteProfile } from "@/lib/backend";
import { ContentJsonLd } from "@/components/site/content-json-ld";
import { PageBlockRenderer } from "@/components/site/page-block-renderer";
import { BuilderAnchor } from "@/components/site/builder-anchor";
import { getBuilderPreviewContext } from "@/lib/builder-preview";
import { AvailabilityBadge } from "@/components/site/availability-badge";
import { breadcrumbJsonLd, faqItemsOfBlocks, productJsonLd } from "@/lib/structured-data";
export const revalidate = 0;
type Props = { params: Promise<{ slug: string }> };
const priceFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
export async function generateMetadata({ params }: Props, parent: ResolvingMetadata) {
  const { slug } = await params;
  const item = (await getEquipment(true)).find(row => row.slug === slug);
  return item ? contentMetadata({ title: item.seoTitle || `${item.name} | Thiết bị bán hàng iOrder`, description: item.seoDescription || item.summary, path: `/equipment/${item.slug}`, canonicalUrl: item.canonicalUrl, seo: item.seo, image: item.coverUrl ? { url: item.coverUrl, alt: item.coverAlt } : null }, parent) : { title: (await getT())("equipment.notFoundTitle") };
}
// Trang chi tiết thiết bị: phần đầu một màn hình (ảnh trong khung, giá, bảo hành, nút liên hệ) → thông số kỹ thuật theo nhóm
// → thiết bị khác (ưu tiên cùng nhóm, tối đa 4) → dải tư vấn chọn thiết bị (hotline từ Cài đặt).
export default async function EquipmentDetail({ params }: Props) {
  const t = await getT();
  const { slug } = await params;
  const all = await getEquipment(true);
  const item = all.find(row => row.slug === slug);
  if (!item) notFound();
  const others = [...all.filter(row => row.id !== item.id && row.groupName === item.groupName), ...all.filter(row => row.id !== item.id && row.groupName !== item.groupName)].slice(0, 4);
  const [config, profile] = await Promise.all([getPublishingConfig(), getSiteProfile()]);
  const site = config.siteUrl;
  // Thiết bị đang xem cho nút Liên hệ mua hàng: chỉ mã gửi lên Backend, phần còn lại để hộp thoại hiển thị cho khách.
  const inquiry = { slug: item.slug, name: item.name, modelCode: item.modelCode ?? null, priceVnd: item.priceVnd, availability: item.availability };
  // Trong canvas CMS: phần đầu trang là mục 1 (chỉ số -1), thông số kỹ thuật là mục 2 (chỉ số -2) của trình dựng.
  const inBuilder = Boolean(await getBuilderPreviewContext());
  // Giao diện (Bố cục khối) của các phần cố định; ảnh nền lưu theo mã media nên phải tra thành địa chỉ ảnh.
  const [specsFrame, relatedFrame, consultFrame] = await Promise.all([
    withBackgroundImage(sectionFrame(item.pageLayout?.specs, { fallback: "white", darkAllowed: true, spacing: "md" })),
    withBackgroundImage(sectionFrame(item.pageLayout?.related, { fallback: "tinted", darkAllowed: true, spacing: "md" })),
    withBackgroundImage(sectionFrame(item.pageLayout?.consult, { fallback: "dark", darkAllowed: true, spacing: "sm" })),
  ]);
  const relatedDark = relatedFrame.tone === "dark";
  // Ảnh trượt thêm của phần đầu trang (CMS: Bố cục khối › Ảnh trượt thêm).
  const heroExtraImages = (await loadBlockImages(item.pageLayout?.hero?.extraMediaIds ?? [])).map(media => ({ url: media.url, alt: media.altText ?? item.name, width: media.width, height: media.height }));
  return <><SiteHeader />{site ? <ContentJsonLd seo={item.seo} title={item.name} description={item.seoDescription || item.summary} path={`/equipment/${item.slug}`} faq={faqItemsOfBlocks(item.blocks ?? [])} defaults={[productJsonLd(site, { name: item.name, description: item.seoDescription || item.summary, path: `/equipment/${item.slug}`, imagePath: item.coverUrl ?? null, sku: item.modelCode, priceVnd: item.priceVnd, availability: item.availability, brand: item.brand }), breadcrumbJsonLd(site, [{ name: t("crumb.home"), path: "/" }, { name: t("equipment.title"), path: "/equipment" }, { name: item.name, path: `/equipment/${item.slug}` }])]} /> : null}
    <main id="noi-dung">
      <BuilderAnchor active={inBuilder} index={-1}>
      <DetailHero extraImages={heroExtraImages} background={item.pageLayout?.hero?.background} height={item.pageLayout?.hero?.height} layout={item.pageLayout?.hero?.layout} appearance={item.pageLayout?.hero?.appearance} back={{ href: "/equipment", label: t("equipment.all") }} image={item.coverUrl ? { url: item.coverUrl, alt: item.coverAlt ?? item.name } : null} imageStyle="product" label={item.groupName} primaryNode={<EquipmentInquiry equipment={inquiry} field="primaryAction" hotline={profile?.hotline ?? null} />} secondary={{ label: t("equipment.viewOthers"), href: "/equipment" }} summary={item.summary} title={item.name}>
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="m-0 text-3xl font-bold tracking-tight text-brand-700" data-builder-field="priceVnd">{priceFormatter.format(item.priceVnd)}</p>
          <span data-builder-field="availability"><AvailabilityBadge always availability={item.availability} /></span>
        </div>
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          {item.modelCode ? <li className="flex items-center gap-2" data-builder-field="modelCode"><BadgeCheck aria-hidden="true" className="text-brand-600" size={18} />{t("equipment.modelCode")} <strong className="font-semibold text-ink">{item.modelCode}</strong></li> : null}
          {item.brand ? <li className="flex items-center gap-2" data-builder-field="brand"><BadgeCheck aria-hidden="true" className="text-brand-600" size={18} />{t("equipment.brand")} <strong className="font-semibold text-ink">{item.brand}</strong></li> : null}
          <li className="flex items-center gap-2" data-builder-field="warrantyMonths"><ShieldCheck aria-hidden="true" className="text-accent-green" size={18} />{t("common.warrantyLabel")} <strong className="font-semibold text-ink">{t("common.months", { months: item.warrantyMonths })}</strong></li>
        </ul>
      </DetailHero>
      </BuilderAnchor>
      {item.specificationGroups.length && !specsFrame.hidden ? <BuilderAnchor active={inBuilder} index={-2}><FrameSection frame={specsFrame}>
        <SectionHeading align="left" dark={specsFrame.tone === "dark"} eyebrow={t("equipment.specsEyebrow")} title={t("equipment.specsTitle")} />
        {/* Mỗi nhóm một thẻ cao bằng nhau; đầu thẻ có ô số + tên nhóm và vạch ngăn, cùng kiểu với khối "Danh sách theo nhóm". */}
        <div className={`grid gap-5 ${item.specificationGroups.length > 1 ? "lg:grid-cols-2" : "mx-auto max-w-3xl"}`}>{item.specificationGroups.map((group, index) => <section className="feature-card rounded-card border border-line bg-white p-6 shadow-card sm:p-7" data-builder-field={`specGroup:${index}`} key={index}>
          <div className="mb-2 flex items-center gap-4 border-b border-line pb-5">
            <IconTile>{String(index + 1).padStart(2, "0")}</IconTile>
            <h3 className="mb-0 min-w-0 text-h3 font-bold tracking-tight text-ink">{group.title}</h3>
          </div>
          <dl className="m-0 divide-y divide-line">{group.items.map((spec, i) => {
            const importedFreeText = /^Thông tin \d+$/.test(spec.label);
            return <div className={`grid gap-1 py-3 ${importedFreeText ? "grid-cols-1" : "sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4"}`} data-builder-field={`spec:${index}:${i}`} key={i}><dt className={importedFreeText ? "sr-only" : "text-muted"}>{importedFreeText ? t("equipment.freeTextDetail", { group: group.title }) : spec.label}</dt><dd className="m-0 font-medium whitespace-pre-line text-ink">{spec.value}</dd></div>;
          })}</dl>
        </section>)}</div>
      </FrameSection></BuilderAnchor> : null}
      {item.blocks?.length ? <PageBlockRenderer blocks={item.blocks} /> : null}
      {others.length && !relatedFrame.hidden ? <BuilderAnchor active={inBuilder} index={-11}><FrameSection frame={relatedFrame}>
        <div className="mb-10 flex flex-col gap-5 sm:mb-12 md:flex-row md:items-end md:justify-between">
          <SectionHeading align="left" className="" dark={relatedDark} eyebrow={t("equipment.otherEyebrow")} title={t("equipment.otherTitle")} />
          <TextLink className={`button ${relatedDark ? "button--outline-light" : "button--secondary"} shrink-0 self-start md:self-auto`} href="/equipment">{t("common.viewAll")}</TextLink>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{others.map(other => <EquipmentCard item={other} key={other.id} />)}</div>
      </FrameSection></BuilderAnchor> : null}
      {consultFrame.hidden ? null : <BuilderAnchor active={inBuilder} index={-12}><ConsultBand actionNode={<EquipmentInquiry className={`button ${consultFrame.tone === "dark" ? "button--light" : "button--primary"}`} equipment={inquiry} hotline={profile?.hotline ?? null} />} actionLabel={t("inquiry.contactButton")} description={t("equipment.consultText")} frame={consultFrame} hotline={profile?.hotline ?? null} title={t("equipment.consultTitle")} /></BuilderAnchor>}
    </main>
  </>;
}
