import { CmsStaticPage, cmsStaticMetadata } from "@/components/site/cms-static-page";

export const revalidate = 0;

export async function generateMetadata() {
  return cmsStaticMetadata("privacy-policy");
}

export default function PrivacyPolicyPage() {
  return <CmsStaticPage slug="privacy-policy" />;
}
