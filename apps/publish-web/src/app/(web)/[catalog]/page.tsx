import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/site/site-header";
import { getOfferingTypeFromCatalogPath, getPublishedOfferingSummaries } from "@/lib/backend";
import { getCatalogContent } from "@/lib/backend";

export const dynamic = "force-dynamic";

type OfferingListPageProps = {
  params: Promise<{ catalog: string }>;
};

const contentKeyByPath = { "dich-vu": "service", "giai-phap": "solution", "phan-mem": "software" } as const;

export async function generateMetadata({ params }: OfferingListPageProps): Promise<Metadata> {
  const { catalog } = await params;
  const content = await getCatalogContent();
  const key = contentKeyByPath[catalog as keyof typeof contentKeyByPath];
  const copy = key ? content?.[key] : undefined;

  return copy ? { title: `${copy.eyebrow} | iOrder`, description: copy.description } : { title: "Không tìm thấy trang | iOrder" };
}

export default async function OfferingListPage({ params }: OfferingListPageProps) {
  const { catalog } = await params;
  const type = getOfferingTypeFromCatalogPath(catalog);
  const content = await getCatalogContent();
  const key = contentKeyByPath[catalog as keyof typeof contentKeyByPath];
  const copy = key ? content?.[key] : undefined;

  if (!type || !copy) {
    notFound();
  }

  const offerings = await getPublishedOfferingSummaries(type);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <header className="max-w-3xl">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-blue-700">{copy.eyebrow}</p>
          <h1 className="mb-5 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-6xl">{copy.title}</h1>
          {copy.description ? <p className="text-lg leading-8 text-slate-600">{copy.description}</p> : null}
        </header>

        {offerings.length === 0 ? (
          <section className="mt-12 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">
            Chưa có nội dung nào được xuất bản. Nội dung sẽ xuất hiện tại đây sau khi được duyệt trong CMS.
          </section>
        ) : (
          <section className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label={`Danh sách ${copy.eyebrow.toLowerCase()}`}>
            {offerings.map((offering) => (
              <Link className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-md" href={`/${catalog}/${offering.slug}`} key={offering.id}>
                {offering.cover ? (
                  <Image
                    alt={offering.cover.altText ?? `Ảnh minh họa ${offering.title}`}
                    className="mb-6 h-40 w-full rounded-xl object-cover"
                    height={offering.cover.height ?? 630}
                    src={offering.cover.url}
                    width={offering.cover.width ?? 1200}
                  />
                ) : null}
                {offering.isFeatured ? <p className="mb-5 text-sm font-bold text-blue-700">Nổi bật</p> : null}
                <h2 className="mb-3 text-xl font-extrabold tracking-tight text-slate-900">{offering.title}</h2>
                {offering.summary ? <p className="leading-7 text-slate-600">{offering.summary}</p> : null}
                <p className="mt-6 text-sm font-bold text-blue-700">Xem chi tiết →</p>
              </Link>
            ))}
          </section>
        )}
      </main>
    </>
  );
}
