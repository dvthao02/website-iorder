import type { Metadata, ResolvingMetadata } from "next";
import { CircleCheck, Sparkles, UsersRound } from "lucide-react";
import { contentMetadata } from "@/lib/page-metadata";
import { notFound } from "next/navigation";
import { BuilderAnchor } from "@/components/site/builder-anchor";

import { ChipList, DetailHero } from "@/components/site/detail-hero";
import { OfferingContent } from "@/components/site/offering-content";
import { SiteHeader } from "@/components/site/site-header";
import { getBuilderPreviewContext } from "@/lib/builder-preview";
import { getOfferingTypeFromCatalogPath, getPublishedOfferingBySlug, getPublishingConfig, getSiteProfile } from "@/lib/backend";
import { ContentJsonLd } from "@/components/site/content-json-ld";
import { breadcrumbJsonLd, serviceJsonLd } from "@/lib/structured-data";

export const revalidate = 0;

type OfferingDetailPageProps = {
  params: Promise<{ catalog: string; slug: string }>;
};

const catalogLabel = {
  "dich-vu": "Dịch vụ",
  "giai-phap": "Giải pháp",
  "phan-mem": "Phần mềm",
} as const;

export async function generateMetadata({ params }: OfferingDetailPageProps, parent: ResolvingMetadata): Promise<Metadata> {
  const { catalog, slug } = await params;
  const type = getOfferingTypeFromCatalogPath(catalog);

  if (!type) {
    return { title: "Không tìm thấy nội dung | iOrder" };
  }

  const offering = await getPublishedOfferingBySlug(type, slug);

  return offering
    ? contentMetadata({ title: `${offering.seoTitle ?? offering.title} | iOrder`, description: offering.seoDescription ?? offering.summary, path: `/${catalog}/${offering.slug}`, canonicalUrl: offering.canonicalUrl, seo: offering.seo, image: offering.cover ? { url: offering.cover.url, alt: offering.cover.altText } : null }, parent)
    : { title: "Không tìm thấy nội dung | iOrder" };
}

export default async function OfferingDetailPage({ params }: OfferingDetailPageProps) {
  const { catalog, slug } = await params;
  const type = getOfferingTypeFromCatalogPath(catalog);
  const label = catalogLabel[catalog as keyof typeof catalogLabel];

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

  return (
    <>
      <SiteHeader />
      {site ? <ContentJsonLd seo={offering.seo} title={offering.title} description={offering.seoDescription} path={`/${catalog}/${offering.slug}`} defaults={[serviceJsonLd(site, { name: offering.title, description: offering.seoDescription ?? offering.summary, path: `/${catalog}/${offering.slug}`, imagePath: offering.cover?.url ?? null, providerName: profile?.companyName ?? "iOrder" }), breadcrumbJsonLd(site, [{ name: "Trang chủ", path: "/" }, { name: label, path: `/${catalog}` }, { name: offering.title, path: `/${catalog}/${offering.slug}` }])]} /> : null}
      {/* Phần đầu chiếm một màn hình như trang chủ; các phần nội dung phía dưới cũng mỗi phần một màn hình. */}
      <main id="noi-dung">
        <BuilderAnchor active={inBuilder} index={-1}>
        <DetailHero
          background={offering.content.appearance?.hero?.background}
          fill={offering.content.appearance?.hero?.height !== "auto"}
          layout={offering.content.appearance?.hero?.layout}
          back={{ href: `/${catalog}`, label: `Tất cả ${label.toLowerCase()}` }}
          image={offering.cover ? { url: offering.cover.url, alt: offering.cover.altText ?? `Ảnh minh họa ${offering.title}`, width: offering.cover.width, height: offering.cover.height } : null}
          label={offering.content.category ?? label}
          primary={{ label: "Nhận tư vấn miễn phí", href: "/lien-he" }}
          secondary={offering.content.pricing ? { label: "Xem bảng giá", href: "#bang-gia" } : null}
          summary={offering.summary}
          title={offering.title}
        >
          {/* Số liệu nổi bật ngay dưới mô tả: bằng chứng ngắn trước nút tư vấn. */}
          {offering.content.metrics.length ? <ul aria-label="Điểm nổi bật" data-builder-field="metrics" className="m-0 mt-6 flex list-none flex-wrap gap-x-6 gap-y-2 p-0">{offering.content.metrics.map(metric => <li className="flex items-center gap-2 font-semibold text-ink" key={metric}><CircleCheck aria-hidden="true" className="shrink-0 text-accent-green" size={20} />{metric}</li>)}</ul> : null}
          {/* Khi nội dung dựng bằng thành phần, "Phù hợp với" và "Giá trị nổi bật" thuộc phần đầu trang (bản cũ hiện trong phần Tổng quan). */}
          {offering.content.blocks && (offering.content.bestFor || offering.content.keyValue) ? <dl className="m-0 mt-4 grid gap-2 text-small text-muted">
            {offering.content.bestFor ? <div className="flex flex-wrap items-center gap-x-2"><dt className="flex items-center gap-2 font-semibold text-brand-700"><UsersRound aria-hidden="true" size={18} />Phù hợp với:</dt><dd className="m-0 font-semibold text-ink" data-builder-field="bestFor">{offering.content.bestFor}</dd></div> : null}
            {offering.content.keyValue ? <div className="flex flex-wrap items-center gap-x-2"><dt className="flex items-center gap-2 font-semibold text-accent-violet"><Sparkles aria-hidden="true" size={18} />Giá trị nổi bật:</dt><dd className="m-0 font-semibold text-ink" data-builder-field="keyValue">{offering.content.keyValue}</dd></div> : null}
          </dl> : null}
          <ChipList items={offering.content.tags.map(tag => ({ key: tag, text: tag }))} field="tags" label="Chủ đề liên quan" />
        </DetailHero>
        </BuilderAnchor>
        <OfferingContent closing={{ title: offering.title, hotline: profile?.hotline ?? null }} content={offering.content} />
      </main>
    </>
  );
}
