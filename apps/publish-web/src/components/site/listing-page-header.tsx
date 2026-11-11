import type { ReactNode } from "react";
import type { ListingHeader, PageBlock } from "@iorder/core/server/pages/pages.contract";
import { resolveBlockFrames } from "@iorder/core/server/pages/block-layout";
import { Container } from "@/components/ui";
import { BreadcrumbJsonLd, BreadcrumbTrail, PageHero, type Crumb } from "./page-hero";
import { PageBlockRenderer } from "./page-block-renderer";

type ListingHero = Extract<PageBlock, { type: "hero" }>;

/** CMS giữ toàn bộ bố cục cha; đường dẫn và công cụ danh sách không tạo thêm tiêu đề. */
export function ListingPageHeader({ hero, header, crumbs, children }: { hero?: ListingHero; header: ListingHeader; crumbs: Crumb[]; children?: ReactNode }) {
  if (!hero) return <PageHero crumbs={crumbs} description={header.description} eyebrow={header.eyebrow} title={header.title}>{children}</PageHero>;
  return <>
    <BreadcrumbJsonLd crumbs={crumbs} />
    <PageBlockRenderer blocks={[hero]} />
    <Container className="py-4"><BreadcrumbTrail crumbs={crumbs} />{children}</Container>
  </>;
}

export function listingHeaderSurface(hero?: ListingHero) {
  return hero ? resolveBlockFrames([hero])[0].tone : "white" as const;
}
