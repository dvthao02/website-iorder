import type { Metadata, ResolvingMetadata } from "next";
import { CircleCheck, Sparkles, UsersRound } from "lucide-react";
import { contentMetadata } from "@/lib/page-metadata";
import { notFound } from "next/navigation";
import { BuilderAnchor } from "@/components/site/builder-anchor";

import { ChipList, DetailHero } from "@/components/site/detail-hero";
import { OfferingContent } from "@/components/site/offering-content";
import { loadBlockImages } from "@/components/site/section-blocks";
import { SiteHeader } from "@/components/site/site-header";
import { getT } from "@/lib/messages";
import { getBuilderPreviewContext } from "@/lib/builder-preview";
import { getOfferingTypeFromCatalogPath, getPublishedOfferingBySlug, getPublishingConfig, getSiteProfile } from "@/lib/backend";
import { ContentJsonLd } from "@/components/site/content-json-ld";
import { breadcrumbJsonLd, lowestPlanPriceVnd, serviceJsonLd, softwareApplicationJsonLd } from "@/lib/structured-data";

export const revalidate = 0;

type OfferingDetailPageProps = {
  params: Promise<{ catalog: string; slug: string }>;
};

const catalogLabelKeys = {
  solutions: "catalog.solutions",
  software: "catalog.software",
} as const;

export async function generateMetadata({ params }: OfferingDetailPageProps, parent: ResolvingMetadata): Promise<Metadata> {
  const { catalog, slug } = await params;
  const type = getOfferingTypeFromCatalogPath(catalog);

  if (!type) {
    return { title: (await getT())("offering.notFoundTitle") };
  }

  const offering = await getPublishedOfferingBySlug(type, slug);

  return offering
    ? contentMetadata({ title: offering.seoTitle ?? offering.title, description: offering.seoDescription ?? offering.summary, path: `/${catalog}/${offering.slug}`, canonicalUrl: offering.canonicalUrl, seo: offering.seo, image: offering.cover ? { url: offering.cover.url, alt: offering.cover.altText } : null }, parent)
    : { title: (await getT())("offering.notFoundTitle") };
}

export default async function OfferingDetailPage({ params }: OfferingDetailPageProps) {
  const t = await getT();
  const { catalog, slug } = await params;
  const type = getOfferingTypeFromCatalogPath(catalog);
  const labelKey = catalogLabelKeys[catalog as keyof typeof catalogLabelKeys];
  const label = labelKey ? t(labelKey) : undefined;

  if (!type || !label) {
    notFound();
  }

  const [offering, config, profile] = await Promise.all([getPublishedOfferingBySlug(type, slug), getPublishingConfig(), getSiteProfile()]);
  const site = config.siteUrl;
  // Trong canvas CMS, phần đầu trang là mục số 1 của trình dựng (chỉ số -1) để bấm chọn được.
  const inBuilder = Boolean(await getBuilderPreviewContext());

  if (!offering) {
    notFound();
  }

  // Phần đầu trang là thành phần "Phần đầu trang" đầu danh sách (cùng loại với trang chủ) thì PageBlockRenderer vẽ nó; không thì dùng khối cố định bên dưới.
  const heroBlock = offering.content.blocks?.[0];
  const heroIsBlock = heroBlock?.type === "hero" && heroBlock.isEnabled;
  // Ảnh trượt thêm của phần đầu trang cố định (CMS: Bố cục khối › Ảnh trượt thêm).
  const heroExtraImages = (await loadBlockImages(offering.content.appearance?.hero?.extraMediaIds ?? [])).map(media => ({ url: media.url, alt: media.altText ?? offering.title, width: media.width, height: media.height }));

  // Phần mềm có giá đọc được từ bảng giá → SoftwareApplication; Google đòi giá hoặc đánh giá thật cho loại này,
  // thiếu thì Search Console báo lỗi, nên phần mềm chưa có giá số, giải pháp và dịch vụ vẫn là Service.
  const offeringJsonLd = () => {
    const input = { name: offering.title, description: offering.seoDescription ?? offering.summary, path: `/${catalog}/${offering.slug}`, imagePath: offering.cover?.url ?? null };
    const priceVnd = type === "software" ? lowestPlanPriceVnd(offering.content.pricing?.plans) : null;
    return priceVnd
      ? softwareApplicationJsonLd(site!, { ...input, publisherName: profile?.companyName ?? "iOrder", category: offering.content.category, priceVnd })
      : serviceJsonLd(site!, { ...input, providerName: profile?.companyName ?? "iOrder" });
  };

  return (
    <>
      <SiteHeader />
      {site ? <ContentJsonLd seo={offering.seo} title={offering.title} description={offering.seoDescription} path={`/${catalog}/${offering.slug}`} faq={offering.content.faq.map(([question, answer]) => ({ question, answer }))} defaults={[offeringJsonLd(), breadcrumbJsonLd(site, [{ name: t("crumb.home"), path: "/" }, { name: label, path: `/${catalog}` }, { name: offering.title, path: `/${catalog}/${offering.slug}` }])]} /> : null}
      {/* Phần đầu chiếm một màn hình như trang chủ; các phần nội dung phía dưới cũng mỗi phần một màn hình. */}
      <main id="noi-dung">
        {heroIsBlock ? null : <BuilderAnchor active={inBuilder} index={-1}>
        <DetailHero
          background={offering.content.appearance?.hero?.background}
          height={offering.content.appearance?.hero?.height}
          layout={offering.content.appearance?.hero?.layout}
          appearance={offering.content.appearance?.hero?.appearance}
          back={{ href: `/${catalog}`, label: t("offering.allOf", { label: label.toLowerCase() }) }}
          extraImages={heroExtraImages}
          image={offering.cover ? { url: offering.cover.url, alt: offering.cover.altText ?? (type === "software" ? t("offering.coverSoftware", { name: offering.title }) : t("offering.coverSolution", { name: offering.title })), width: offering.cover.width, height: offering.cover.height } : null}
          label={offering.content.category ?? label}
          primary={{ label: t("offering.freeAdvice"), href: "/contact" }}
          secondary={offering.content.pricing ? { label: t("offering.viewPricing"), href: "#bang-gia" } : null}
          summary={offering.summary}
          title={offering.title}
        >
          {/* Tạm ẩn số liệu phần mềm vì dữ liệu hiện có chưa được xác nhận. */}
          {type !== "software" && offering.content.metrics.length ? <ul aria-label={t("offering.highlights")} data-builder-field="metrics" className="m-0 mt-6 flex list-none flex-wrap gap-x-6 gap-y-2 p-0">{offering.content.metrics.map(metric => <li className="flex items-center gap-2 font-semibold text-ink" key={metric}><CircleCheck aria-hidden="true" className="shrink-0 text-accent-green" size={20} />{metric}</li>)}</ul> : null}
          {/* Khi nội dung dựng bằng thành phần, "Phù hợp với" và "Giá trị nổi bật" thuộc phần đầu trang (bản cũ hiện trong phần Tổng quan). */}
          {type === "software" && offering.content.blocks && (offering.content.bestFor || offering.content.keyValue) ? <dl className="m-0 mt-6 grid gap-4 text-small text-muted">
            {offering.content.bestFor ? <div className="grid grid-cols-[1.125rem_minmax(0,1fr)] items-start gap-x-3 text-left"><UsersRound aria-hidden="true" className="mt-0.5 text-brand-700" size={18} /><div className="min-w-0"><dt className="font-semibold text-brand-700">{t("offering.bestFor")}</dt><dd className="m-0 mt-1 leading-6 text-ink" data-builder-field="bestFor">{offering.content.bestFor}</dd></div></div> : null}
            {offering.content.keyValue ? <div className="grid grid-cols-[1.125rem_minmax(0,1fr)] items-start gap-x-3 text-left"><Sparkles aria-hidden="true" className="mt-0.5 text-accent-violet" size={18} /><div className="min-w-0"><dt className="font-semibold text-accent-violet">{t("offering.keyValue")}</dt><dd className="m-0 mt-1 leading-6 text-ink" data-builder-field="keyValue">{offering.content.keyValue}</dd></div></div> : null}
          </dl> : null}
          {type !== "software" && offering.content.blocks && (offering.content.bestFor || offering.content.keyValue) ? <dl className="m-0 mt-4 grid gap-2 text-small text-muted">
            {offering.content.bestFor ? <div className="flex flex-wrap items-center gap-x-2"><dt className="flex items-center gap-2 font-semibold text-brand-700"><UsersRound aria-hidden="true" size={18} />{t("offering.bestForColon")}</dt><dd className="m-0 font-semibold text-ink" data-builder-field="bestFor">{offering.content.bestFor}</dd></div> : null}
            {offering.content.keyValue ? <div className="flex flex-wrap items-center gap-x-2"><dt className="flex items-center gap-2 font-semibold text-accent-violet"><Sparkles aria-hidden="true" size={18} />{t("offering.keyValueColon")}</dt><dd className="m-0 font-semibold text-ink" data-builder-field="keyValue">{offering.content.keyValue}</dd></div> : null}
          </dl> : null}
          <ChipList items={offering.content.tags.map(tag => ({ key: tag, text: tag }))} field="tags" label={t("offering.relatedTopics")} />
        </DetailHero>
        </BuilderAnchor>}
        <OfferingContent closing={{ title: offering.title, hotline: profile?.hotline ?? null }} content={offering.content} />
      </main>
    </>
  );
}
