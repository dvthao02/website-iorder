import type { Metadata, ResolvingMetadata } from "next";
import { getFixedWebsitePage } from "@iorder/core/server/pages/pages.contract";
import { contentMetadata } from "@/lib/page-metadata";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { PageBlockRenderer } from "@/components/site/page-block-renderer";
import { getPublishedPage } from "@/lib/backend";

// Metadata cho trang quản lý trong CMS (trang hệ thống hoặc /trang/{slug}).
export async function cmsStaticMetadata(slug: string, parent: ResolvingMetadata): Promise<Metadata> {
  const page = await getPublishedPage(slug);
  if (!page) return { title: "Không tìm thấy trang | iOrder" };
  return contentMetadata({ title: page.seoTitle || page.title, description: page.seoDescription, path: getFixedWebsitePage(slug)?.publicPath ?? `/trang/${slug}`, canonicalUrl: page.canonicalUrl }, parent);
}
export async function CmsStaticPage({ slug }: { slug: string }) { const page = await getPublishedPage(slug); if (!page) notFound(); return <><SiteHeader /><PageBlockRenderer blocks={page.blocks} /></>; }
