import type { Metadata, ResolvingMetadata } from "next";

import { ListingPageView } from "@/components/site/listing-page-view";
import { SiteHeader } from "@/components/site/site-header";
import { getListingPageContent, listingPageMetadata } from "@/lib/listing-page";

export const revalidate = 0;

export async function generateMetadata(_: unknown, parent: ResolvingMetadata): Promise<Metadata> { return listingPageMetadata(await getListingPageContent("listing-news"), "/tin-tuc", parent); }

export default async function NewsPage() {
  const content = await getListingPageContent("listing-news");
  if (!content) return <><SiteHeader /><main className="mx-auto max-w-6xl p-6">Nội dung trang tin tức đang chờ được cấu hình trong CMS.</main></>;
  return <ListingPageView content={content} />;
}
