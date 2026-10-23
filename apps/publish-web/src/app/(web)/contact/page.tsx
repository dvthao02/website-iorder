import type { ResolvingMetadata } from "next";
import { cmsStaticMetadata } from "@/components/site/cms-static-page";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { PageBlockRenderer } from "@/components/site/page-block-renderer";
import { getPublishedPage } from "@/lib/backend";
export const revalidate = 0;
export async function generateMetadata(_: unknown, parent: ResolvingMetadata) { return cmsStaticMetadata("contact", parent); }
export default async function ContactPage() { const page = await getPublishedPage("contact"); if (!page) notFound(); return <><SiteHeader /><PageBlockRenderer blocks={page.blocks} /></>; }
