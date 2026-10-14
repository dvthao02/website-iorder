import { CmsStaticPage, cmsStaticMetadata } from "@/components/site/cms-static-page";
export const revalidate = 0;
export async function generateMetadata() { return cmsStaticMetadata("remote-support"); }
export default function RemoteSupportPage() { return <CmsStaticPage slug="remote-support" />; }
