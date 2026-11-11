import { SiteHeader } from "@/components/site/site-header";
import { PageBlockRenderer } from "@/components/site/page-block-renderer";
import { getPublishedPage } from "@/lib/backend";
import type { Metadata, ResolvingMetadata } from "next";
import { contentMetadata } from "@/lib/page-metadata";
import { ContentJsonLd } from "@/components/site/content-json-ld";

export const revalidate = 0;
export async function generateMetadata(_: unknown, parent: ResolvingMetadata): Promise<Metadata> {
  const page = await getPublishedPage("home");
  return page ? contentMetadata({ title: page.seoTitle || page.title, description: page.seoDescription, path: "/", canonicalUrl: page.canonicalUrl, seo: page.seo }, parent) : {};
}
export default async function Home() {
  const page = await getPublishedPage("home");
  return (
    <>
      <SiteHeader />
      {page ? <ContentJsonLd seo={page.seo} title={page.title} description={page.seoDescription} path="/" /> : null}
      {page ? <main id="noi-dung"><PageBlockRenderer blocks={page.blocks} screens /></main> : <main id="noi-dung" className="mx-auto max-w-4xl p-8"><p>Trang chủ đang chờ được xuất bản trong CMS.</p></main>}
    </>
  );
}
