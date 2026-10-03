import { CmsStaticPage, cmsStaticMetadata } from "@/components/site/cms-static-page";
export const dynamic = "force-dynamic";
export async function generateMetadata() { return cmsStaticMetadata("terms"); }
export default function TermsPage() { return <CmsStaticPage slug="terms" />; }
