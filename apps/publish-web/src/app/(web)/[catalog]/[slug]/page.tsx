import type { Metadata, ResolvingMetadata } from "next";
import { contentMetadata } from "@/lib/page-metadata";
import { notFound } from "next/navigation";

import { ChipList, DetailHero } from "@/components/site/detail-hero";
import { OfferingContent } from "@/components/site/offering-content";
import { SiteHeader } from "@/components/site/site-header";
import { getOfferingTypeFromCatalogPath, getPublishedOfferingBySlug, getPublishingConfig, getSiteProfile } from "@/lib/backend";
import { JsonLd } from "@/components/site/json-ld";
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
    ? contentMetadata({ title: `${offering.seoTitle ?? offering.title} | iOrder`, description: offering.seoDescription ?? offering.summary, path: `/${catalog}/${offering.slug}`, canonicalUrl: offering.canonicalUrl, image: offering.cover ? { url: offering.cover.url, alt: offering.cover.altText } : null }, parent)
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

  if (!offering) {
    notFound();
  }

  return (
    <>
      <SiteHeader />
      {site ? <JsonLd data={[serviceJsonLd(site, { name: offering.title, description: offering.seoDescription ?? offering.summary, path: `/${catalog}/${offering.slug}`, imagePath: offering.cover?.url ?? null, providerName: profile?.companyName ?? "iOrder" }), breadcrumbJsonLd(site, [{ name: "Trang chủ", path: "/" }, { name: label, path: `/${catalog}` }, { name: offering.title, path: `/${catalog}/${offering.slug}` }])]} /> : null}
      {/* Phần đầu chiếm một màn hình như trang chủ; các phần nội dung phía dưới cũng mỗi phần một màn hình. */}
      <main>
        <DetailHero
          back={{ href: `/${catalog}`, label: `Tất cả ${label.toLowerCase()}` }}
          image={offering.cover ? { url: offering.cover.url, alt: offering.cover.altText ?? `Ảnh minh họa ${offering.title}`, width: offering.cover.width, height: offering.cover.height } : null}
          label={label}
          primary={{ label: "Nhận tư vấn miễn phí", href: "/lien-he" }}
          secondary={offering.content.pricing ? { label: "Xem bảng giá", href: "#bang-gia" } : null}
          summary={offering.summary}
          title={offering.title}
        >
          <ChipList items={offering.content.tags.map(tag => ({ key: tag, text: tag }))} label="Chủ đề liên quan" />
        </DetailHero>
        <OfferingContent closing={{ title: offering.title, hotline: profile?.hotline ?? null }} content={offering.content} />
      </main>
    </>
  );
}
