import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OfferingContent } from "@/components/site/offering-content";
import { SiteHeader } from "@/components/site/site-header";
import { getOfferingTypeFromCatalogPath, getPublishedOfferingBySlug } from "@/lib/backend";

export const dynamic = "force-dynamic";

type OfferingDetailPageProps = {
  params: Promise<{ catalog: string; slug: string }>;
};

const catalogLabel = {
  "dich-vu": "Dịch vụ",
  "giai-phap": "Giải pháp",
  "phan-mem": "Phần mềm",
} as const;

export async function generateMetadata({ params }: OfferingDetailPageProps): Promise<Metadata> {
  const { catalog, slug } = await params;
  const type = getOfferingTypeFromCatalogPath(catalog);

  if (!type) {
    return { title: "Không tìm thấy nội dung | iOrder" };
  }

  const offering = await getPublishedOfferingBySlug(type, slug);

  return offering
    ? { title: `${offering.seoTitle ?? offering.title} | iOrder`, description: offering.seoDescription ?? offering.summary ?? undefined, alternates: offering.canonicalUrl ? { canonical: offering.canonicalUrl } : undefined }
    : { title: "Không tìm thấy nội dung | iOrder" };
}

export default async function OfferingDetailPage({ params }: OfferingDetailPageProps) {
  const { catalog, slug } = await params;
  const type = getOfferingTypeFromCatalogPath(catalog);
  const label = catalogLabel[catalog as keyof typeof catalogLabel];

  if (!type || !label) {
    notFound();
  }

  const offering = await getPublishedOfferingBySlug(type, slug);

  if (!offering) {
    notFound();
  }

  return (
    <>
      <SiteHeader />
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
