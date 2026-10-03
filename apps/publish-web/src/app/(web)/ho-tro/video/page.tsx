import { CmsStaticPage, cmsStaticMetadata } from "@/components/site/cms-static-page";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return cmsStaticMetadata("support-videos");
}

export default function SupportVideosPage() {
  return <CmsStaticPage slug="support-videos" />;
}
