import type { ResolvingMetadata } from "next";
import { CmsStaticPage, cmsStaticMetadata } from "@/components/site/cms-static-page";
export const revalidate = 0;
export async function generateMetadata(_: unknown, parent: ResolvingMetadata) { return cmsStaticMetadata("support-faq", parent); }
export default function FaqPage() { return <CmsStaticPage slug="support-faq" />; }
