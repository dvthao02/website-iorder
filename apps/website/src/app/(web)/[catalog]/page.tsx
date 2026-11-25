import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";

import { ConsultBand } from "@/components/site/consult-band";
import { ListingPageView } from "@/components/site/listing-page-view";
import { getSiteProfile } from "@/lib/backend";
import { getT } from "@/lib/messages";
import { getListingPageContent, listingPageMetadata } from "@/lib/listing-page";

export const revalidate = 0;

type OfferingListPageProps = {
  params: Promise<{ catalog: string }>;
};

const listingSlugByPath = { solutions: "listing-solution", software: "listing-software" } as const;
// Tên ngắn trên đường dẫn (breadcrumb) của từng trang danh sách.
const crumbKeys = { solutions: "catalog.solutions", software: "catalog.software" } as const;
// Dải tư vấn cuối trang: người xem hết danh sách mà chưa chọn được vẫn có lối đi tiếp (tư vấn hoặc gọi hotline).
const closingKeys = {
  software: { title: "catalog.softwareClosingTitle", description: "catalog.softwareClosingText" },
  solutions: { title: "catalog.solutionsClosingTitle", description: "catalog.solutionsClosingText" },
} as const;

function getCatalogListing(catalog: string) {
  const slug = listingSlugByPath[catalog as keyof typeof listingSlugByPath];
  return slug ? getListingPageContent(slug) : Promise.resolve(undefined);
}

export async function generateMetadata({ params }: OfferingListPageProps, parent: ResolvingMetadata): Promise<Metadata> {
  const { catalog } = await params;
  const content = await getCatalogListing(catalog);
  return content ? listingPageMetadata(content, `/${catalog}`, parent, (header) => header.eyebrow ?? header.title) : { title: (await getT())("page.notFoundTitle") };
}

export default async function OfferingListPage({ params }: OfferingListPageProps) {
  const t = await getT();
  const { catalog } = await params;
  const [content, profile] = await Promise.all([getCatalogListing(catalog), getSiteProfile()]);
  if (!content) notFound();
  // Trang đã có khối kêu gọi (CTA / form) ở CMS thì không thêm dải tư vấn nữa để khỏi lặp.
  const hasCallToAction = content.blocks.some(block => block.isEnabled && (block.type === "cta" || block.type === "lead_form"));
  const closingKey = closingKeys[catalog as keyof typeof closingKeys];
  const closing = closingKey ? { title: t(closingKey.title), description: t(closingKey.description) } : undefined;
  return <ListingPageView closing={closing && !hasCallToAction ? <ConsultBand description={closing.description} hotline={profile?.hotline ?? null} title={closing.title} /> : null} content={content} crumb={{ name: crumbKeys[catalog as keyof typeof crumbKeys] ? t(crumbKeys[catalog as keyof typeof crumbKeys]) : content.header.title, path: `/${catalog}` }} />;
}
