import { SiteHeader } from "@/components/site/site-header";
import { PageBlockRenderer } from "@/components/site/page-block-renderer";
import { getPublishedPage } from "@/lib/backend";
import type { Metadata, ResolvingMetadata } from "next";
import { contentMetadata } from "@/lib/page-metadata";
import { ContentJsonLd } from "@/components/site/content-json-ld";
import { suggestPageSeoDescription } from "@iorder/shared/server/shared/seo";
import { faqItemsOfBlocks } from "@/lib/structured-data";
import { getT } from "@/lib/messages";

export const revalidate = 0;
export async function generateMetadata(_: unknown, parent: ResolvingMetadata): Promise<Metadata> {
  const page = await getPublishedPage("home");
  return page ? contentMetadata({ title: page.seoTitle || page.title, description: page.seoDescription || suggestPageSeoDescription(page.blocks), path: "/", canonicalUrl: page.canonicalUrl, seo: page.seo }, parent) : {};
}
export default async function Home() {
  const t = await getT();
  const page = await getPublishedPage("home");
  return (
    <>
      <SiteHeader />
      {page ? <ContentJsonLd seo={page.seo} title={page.title} description={page.seoDescription || suggestPageSeoDescription(page.blocks)} path="/" modifiedAt={page.updatedAt} faq={faqItemsOfBlocks(page.blocks)} /> : null}
      {/* data-page="home": bật bố cục chuẩn của trang chủ (khung 1200px, nhịp khoảng cách, lưới) trong globals.css; bản xem trước CMS cũng đi qua route này. Các phần cao theo nội dung, không ép mỗi phần một màn hình. */}
      {page ? <main data-page="home" id="noi-dung"><PageBlockRenderer blocks={page.blocks} /></main> :<main id="noi-dung" className="mx-auto max-w-4xl p-8"><p>{t("empty.homePage")}</p></main>}
    </>
  );
}
