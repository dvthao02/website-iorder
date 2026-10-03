import { SiteHeader } from "@/components/site/site-header";
import { PageBlockRenderer } from "@/components/site/page-block-renderer";
import { getPublishedPage } from "@/lib/backend";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublishedPage("home");
  return page ? { title: page.seoTitle || page.title, description: page.seoDescription || undefined, alternates: page.canonicalUrl ? { canonical: page.canonicalUrl } : undefined } : {};
}
export default async function Home() {
  const page = await getPublishedPage("home");
  return (
    <>
      <SiteHeader />
      {page ? <PageBlockRenderer blocks={page.blocks} /> : <main className="mx-auto max-w-4xl p-8"><p>Trang chủ đang chờ được xuất bản trong CMS.</p></main>}
    </>
  );
}
