import { CmsStaticPage, cmsStaticMetadata } from "@/components/site/cms-static-page";
export const dynamic = "force-dynamic";
export async function generateMetadata() { return cmsStaticMetadata("support-faq"); }
export default function FaqPage() { return <CmsStaticPage slug="support-faq" />; }
