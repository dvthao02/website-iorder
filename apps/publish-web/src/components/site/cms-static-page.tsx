import type { Metadata, ResolvingMetadata } from "next";
import { getFixedWebsitePage } from "@iorder/core/server/pages/pages.contract";
import { contentMetadata } from "@/lib/page-metadata";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { PageBlockRenderer } from "@/components/site/page-block-renderer";
import { BreadcrumbJsonLd } from "@/components/site/page-hero";
import { getPublishedPage } from "@/lib/backend";

// Metadata cho trang quản lý trong CMS (trang hệ thống hoặc /trang/{slug}).
export async function cmsStaticMetadata(slug: string, parent: ResolvingMetadata): Promise<Metadata> {
  const page = await getPublishedPage(slug);
  if (!page) return { title: "Không tìm thấy trang | iOrder" };
  return contentMetadata({ title: page.seoTitle || page.title, description: page.seoDescription, path: getFixedWebsitePage(slug)?.publicPath ?? `/trang/${slug}`, canonicalUrl: page.canonicalUrl }, parent);
}
// Trang quản lý trong CMS (giới thiệu, liên hệ, điều khoản, chính sách, hỗ trợ từ xa, /trang/{slug}): các khối CMS
// và dữ liệu cấu trúc breadcrumb "Trang chủ › tên trang" cho Google.
export async function CmsStaticPage({ slug }: { slug: string }) {
  const page = await getPublishedPage(slug);
  if (!page) notFound();
  return <><SiteHeader /><BreadcrumbJsonLd crumbs={[{ name: page.title, path: getFixedWebsitePage(slug)?.publicPath ?? `/trang/${slug}` }]} /><main id="noi-dung"><PageBlockRenderer blocks={page.blocks} /></main></>;
}
