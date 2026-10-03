import { CmsStaticPage, cmsStaticMetadata } from "@/components/site/cms-static-page";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return cmsStaticMetadata("privacy-policy");
}

export default function PrivacyPolicyPage() {
  return <CmsStaticPage slug="privacy-policy" />;
}
