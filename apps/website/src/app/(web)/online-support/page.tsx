import type { ResolvingMetadata } from "next";
import { CmsStaticPage, cmsStaticMetadata } from "@/components/site/cms-static-page";

export const revalidate = 0;

export async function generateMetadata(_: unknown, parent: ResolvingMetadata) {
  return cmsStaticMetadata("online-support", parent);
}

export default function OnlineSupportPage() {
  return <CmsStaticPage slug="online-support" />;
}
