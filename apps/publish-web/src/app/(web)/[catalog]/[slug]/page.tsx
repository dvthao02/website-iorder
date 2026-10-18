import type { Metadata, ResolvingMetadata } from "next";
import { contentMetadata } from "@/lib/page-metadata";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OfferingContent } from "@/components/site/offering-content";
import { SiteHeader } from "@/components/site/site-header";
import { getOfferingTypeFromCatalogPath, getPublishedOfferingBySlug, getPublishingConfig, getSiteProfile } from "@/lib/backend";
import { JsonLd } from "@/components/site/json-ld";
import { articleJsonLd, breadcrumbJsonLd, productJsonLd, serviceJsonLd } from "@/lib/structured-data";

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
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <Link className="mb-8 inline-flex text-sm font-bold text-blue-700 hover:text-blue-900" href={`/${catalog}`}>
          ← Tất cả {label.toLowerCase()}
        </Link>
        <article>
          <p className="mb-5 text-sm font-bold uppercase tracking-[0.16em] text-blue-700">{label}</p>
          <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-6xl">{offering.title}</h1>
          {offering.summary ? <p className="mb-8 text-xl leading-8 text-slate-600">{offering.summary}</p> : null}
          {offering.cover ? (
            <Image
              alt={offering.cover.altText ?? `Ảnh minh họa ${offering.title}`}
              className="mb-12 h-auto w-full rounded-2xl border border-slate-200 bg-white object-cover"
              height={offering.cover.height ?? 630}
              priority
              src={offering.cover.url}
              width={offering.cover.width ?? 1200}
            />
          ) : null}
          {offering.content.tags.length > 0 ? (
            <ul className="mb-12 flex flex-wrap gap-2" aria-label="Chủ đề liên quan">
              {offering.content.tags.map((tag) => <li className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800" key={tag}>{tag}</li>)}
            </ul>
          ) : null}
          <OfferingContent content={offering.content} />
        </article>
      </main>
    </>
  );
}
