import type { Metadata, ResolvingMetadata } from "next";

import { defaultListingCollections, listingLayoutFromBlocks, type ListingHeader, type ListingPageSlug, type PageBlock } from "@iorder/core/server/pages/pages.contract";

import { notFound } from "next/navigation";

import { getCatalogContent, getListingContent, getPublishedPageState } from "@/lib/backend";
import { contentMetadata } from "@/lib/page-metadata";

export type ListingPageContent = {
  header: ListingHeader;
  blocks: PageBlock[];
  seo: { title: string | null; description: string | null; canonicalUrl: string | null };
};

const noSeo = { title: null, description: null, canonicalUrl: null };

// Cấu hình cũ (site_settings) chỉ còn là dự phòng tới khi chạy `db:backfill-listing-pages`.
async function legacyContent(slug: ListingPageSlug): Promise<ListingPageContent | undefined> {
  const listing = slug === "listing-news" || slug === "listing-equipment" || slug === "listing-support" ? await getListingContent() : null;
  const catalog = slug === "listing-software" || slug === "listing-solution" || slug === "listing-service" ? await getCatalogContent() : null;
  const header = { "listing-news": listing?.news, "listing-equipment": listing?.equipment, "listing-support": listing?.support, "listing-software": catalog?.software, "listing-solution": catalog?.solution, "listing-service": catalog?.service }[slug];
  if (!header) return undefined;
  const blocks = defaultListingCollections[slug].map((data): PageBlock => ({
    type: "collection_list",
    isEnabled: true,
    data: data.source === "guides" && listing?.guides ? { ...data, eyebrow: listing.guides.eyebrow || null, title: listing.guides.title, description: listing.guides.description } : data,
  }));
  return { header, blocks, seo: noSeo };
}

/** Trang danh sách: phần đầu, các khối (gồm danh sách) và SEO từ Trang hệ thống đã xuất bản; nếu chưa có thì từ cấu hình cũ. */
export async function getListingPageContent(slug: ListingPageSlug): Promise<ListingPageContent | undefined> {
  const { page, exists } = await getPublishedPageState(slug);
  if (page) {
    const layout = listingLayoutFromBlocks(slug, page.blocks, { eyebrow: null, title: page.title, description: page.seoDescription });
    return layout && { ...layout, seo: { title: page.seoTitle, description: page.seoDescription, canonicalUrl: page.canonicalUrl } };
  }
  // Trang đã tạo nhưng đang ẩn (nháp/lưu trữ/chưa tới giờ hẹn): 404 như mọi trang hệ thống khác.
  if (exists) notFound();
  // Chưa chạy backfill: dùng cấu hình cũ.
  return legacyContent(slug);
}

export async function listingPageMetadata(content: ListingPageContent | undefined, path: string, parent: ResolvingMetadata, defaultTitle?: (header: ListingHeader) => string): Promise<Metadata> {
  if (!content) return {};
  const { header, seo } = content;
  return contentMetadata({ title: seo.title ?? (defaultTitle ? defaultTitle(header) : header.title), description: seo.description ?? header.description, path, canonicalUrl: seo.canonicalUrl }, parent);
}
