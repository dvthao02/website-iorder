import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";

import { ConsultBand } from "@/components/site/consult-band";
import { ListingPageView } from "@/components/site/listing-page-view";
import { getSiteProfile } from "@/lib/backend";
import { getListingPageContent, listingPageMetadata } from "@/lib/listing-page";

export const revalidate = 0;

type OfferingListPageProps = {
  params: Promise<{ catalog: string }>;
};

const listingSlugByPath = { solutions: "listing-solution", software: "listing-software" } as const;
// Tên ngắn trên đường dẫn (breadcrumb) của từng trang danh sách.
const crumbNames = { solutions: "Giải pháp", software: "Phần mềm" } as const;
// Dải tư vấn cuối trang: người xem hết danh sách mà chưa chọn được vẫn có lối đi tiếp (tư vấn hoặc gọi hotline).
const closingText = {
  software: { title: "Chưa chắc phần mềm nào phù hợp?", description: "Kể cho iOrder về mô hình kinh doanh của bạn — chúng tôi tư vấn phần mềm, thiết bị đi kèm và hướng dẫn dùng thử miễn phí." },
  solutions: { title: "Cần giải pháp cho doanh nghiệp của bạn?", description: "iOrder khảo sát tận nơi, đề xuất phương án hạ tầng, tư vấn hoặc phần mềm theo yêu cầu và báo giá rõ ràng trước khi triển khai." },
} as const;

function getCatalogListing(catalog: string) {
  const slug = listingSlugByPath[catalog as keyof typeof listingSlugByPath];
  return slug ? getListingPageContent(slug) : Promise.resolve(undefined);
}

export async function generateMetadata({ params }: OfferingListPageProps, parent: ResolvingMetadata): Promise<Metadata> {
  const { catalog } = await params;
  const content = await getCatalogListing(catalog);
  return content ? listingPageMetadata(content, `/${catalog}`, parent, (header) => header.eyebrow ?? header.title) : { title: "Không tìm thấy trang | iOrder" };
}

export default async function OfferingListPage({ params }: OfferingListPageProps) {
  const { catalog } = await params;
  const [content, profile] = await Promise.all([getCatalogListing(catalog), getSiteProfile()]);
  if (!content) notFound();
  // Trang đã có khối kêu gọi (CTA / form) ở CMS thì không thêm dải tư vấn nữa để khỏi lặp.
  const hasCallToAction = content.blocks.some(block => block.isEnabled && (block.type === "cta" || block.type === "lead_form"));
  const closing = closingText[catalog as keyof typeof closingText];
  return <ListingPageView closing={closing && !hasCallToAction ? <ConsultBand description={closing.description} hotline={profile?.hotline ?? null} title={closing.title} /> : null} content={content} crumb={{ name: crumbNames[catalog as keyof typeof crumbNames] ?? content.header.title, path: `/${catalog}` }} />;
}
