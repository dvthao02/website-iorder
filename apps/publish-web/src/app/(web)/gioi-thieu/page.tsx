import { CmsStaticPage, cmsStaticMetadata } from "@/components/site/cms-static-page";
export const dynamic = "force-dynamic";
export async function generateMetadata() { return cmsStaticMetadata("about"); }
export default function AboutPage() { return <CmsStaticPage slug="about" />; }
