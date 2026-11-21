import { permanentRedirect } from "next/navigation";
import { getFixedWebsitePage } from "@iorder/shared/server/pages/pages.contract";
import type { Metadata, ResolvingMetadata } from "next";
import { CmsStaticPage, cmsStaticMetadata } from "@/components/site/cms-static-page";
export const revalidate = 0;
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }, parent: ResolvingMetadata): Promise<Metadata> {
  return cmsStaticMetadata((await params).slug, parent);
}
export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const fixedPage = getFixedWebsitePage(slug); if (fixedPage) permanentRedirect(fixedPage.publicPath); return <CmsStaticPage slug={slug} />; }
