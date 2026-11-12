import type { Metadata, ResolvingMetadata } from "next";
import { getFixedWebsitePage } from "@iorder/shared/server/pages/pages.contract";
import { contentMetadata } from "@/lib/page-metadata";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { PageBlockRenderer } from "@/components/site/page-block-renderer";
import { ContentJsonLd } from "@/components/site/content-json-ld";
import { staticPageProfile, staticPageSections } from "@iorder/shared/server/pages/static-page-layout";
import { resolveBlockFrames } from "@iorder/shared/server/pages/block-layout";
import { Container, SectionHeading } from "@/components/ui";
import { StaticPageNavigation } from "./static-page-navigation";
import { getPublishedPage } from "@/lib/backend";

// Metadata cho trang quản lý trong CMS (trang hệ thống hoặc /trang/{slug}).
export async function cmsStaticMetadata(slug: string, parent: ResolvingMetadata): Promise<Metadata> {
  const page = await getPublishedPage(slug);
  if (!page) return { title: "Không tìm thấy trang | iOrder" };
  return contentMetadata({ title: page.seoTitle || page.title, description: page.seoDescription, path: getFixedWebsitePage(slug)?.publicPath ?? `/trang/${slug}`, canonicalUrl: page.canonicalUrl, seo: page.seo }, parent);
}
// Trang quản lý trong CMS (giới thiệu, liên hệ, điều khoản, chính sách, hỗ trợ từ xa, /trang/{slug}): các khối CMS
// và dữ liệu cấu trúc breadcrumb "Trang chủ › tên trang" cho Google.
export async function CmsStaticPage({ slug }: { slug: string }) {
  const page = await getPublishedPage(slug);
  if (!page) notFound();
  const path = getFixedWebsitePage(slug)?.publicPath ?? `/trang/${slug}`;
  const profile = staticPageProfile(slug, page.template);
  const enabled = page.blocks.filter(block => block.isEnabled);
  const intro = enabled[0]?.type === "hero" ? enabled[0] : undefined;
  const body = intro ? enabled.slice(1) : enabled;
  const navigation = staticPageSections(body);
  const previous = intro ? resolveBlockFrames([intro])[0].tone : "white";
  const crumbs = [{ name: page.title, path }];
  return <><SiteHeader /><ContentJsonLd seo={page.seo} title={page.title} description={page.seoDescription} path={path} crumbs={[{ name: "Trang chủ", path: "/" }, { name: page.title, path }]} /><main className="static-page" data-static-profile={profile} data-testid="static-page" id="noi-dung">{intro ? <PageBlockRenderer blocks={[intro]} /> : <header className="static-page-title" data-testid="static-page-title"><Container><SectionHeading align="left" level="h1" title={page.title} /></Container></header>}<StaticPageNavigation crumbs={crumbs} sections={navigation.sections} /><PageBlockRenderer blocks={body} previous={previous} sectionIds={navigation.sectionIds} staticPage={profile} /></main></>;
}
