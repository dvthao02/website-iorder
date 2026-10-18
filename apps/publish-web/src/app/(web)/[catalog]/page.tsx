import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";

import { ListingPageView } from "@/components/site/listing-page-view";
import { getListingPageContent, listingPageMetadata } from "@/lib/listing-page";

export const revalidate = 0;

type OfferingListPageProps = {
  params: Promise<{ catalog: string }>;
};

const listingSlugByPath = { "dich-vu": "listing-service", "giai-phap": "listing-solution", "phan-mem": "listing-software" } as const;

function getCatalogListing(catalog: string) {
  const slug = listingSlugByPath[catalog as keyof typeof listingSlugByPath];
  return slug ? getListingPageContent(slug) : Promise.resolve(undefined);
}

export async function generateMetadata({ params }: OfferingListPageProps, parent: ResolvingMetadata): Promise<Metadata> {
  const { catalog } = await params;
  const content = await getCatalogListing(catalog);
  return content ? listingPageMetadata(content, `/${catalog}`, parent, (header) => `${header.eyebrow ?? header.title} | iOrder`) : { title: "Không tìm thấy trang | iOrder" };
}

export default async function OfferingListPage({ params }: OfferingListPageProps) {
  const { catalog } = await params;
  const content = await getCatalogListing(catalog);
  if (!content) notFound();
  return <ListingPageView content={content} />;
}
