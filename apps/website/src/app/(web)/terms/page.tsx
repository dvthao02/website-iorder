import type { ResolvingMetadata } from "next";
import { CmsStaticPage, cmsStaticMetadata } from "@/components/site/cms-static-page";
export const revalidate = 0;
export async function generateMetadata(_: unknown, parent: ResolvingMetadata) { return cmsStaticMetadata("terms", parent); }
export default function TermsPage() { return <CmsStaticPage slug="terms" />; }
