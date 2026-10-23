import { notFound, permanentRedirect } from "next/navigation";
import { getFixedWebsitePage } from "@iorder/core/server/pages/pages.contract";
import { SiteHeader } from "@/components/site/site-header";
import { PageBlockRenderer } from "@/components/site/page-block-renderer";
import { getPublishedPage } from "@/lib/backend";
import type { Metadata, ResolvingMetadata } from "next";
import { cmsStaticMetadata } from "@/components/site/cms-static-page";
export const revalidate = 0;
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }, parent: ResolvingMetadata): Promise<Metadata> {
  return cmsStaticMetadata((await params).slug, parent);
}
export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const fixedPage = getFixedWebsitePage(slug); if (fixedPage) permanentRedirect(fixedPage.publicPath); const page = await getPublishedPage(slug); if (!page) notFound(); return <><SiteHeader /><PageBlockRenderer blocks={page.blocks} /></>; }
