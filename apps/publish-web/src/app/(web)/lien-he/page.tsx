import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { PageBlockRenderer } from "@/components/site/page-block-renderer";
import { getPublishedPage } from "@/lib/backend";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> { const page = await getPublishedPage("contact"); return page ? { title: page.seoTitle || page.title, description: page.seoDescription || undefined, alternates: page.canonicalUrl ? { canonical: page.canonicalUrl } : undefined } : { title: "Liên hệ | iOrder" }; }
export default async function ContactPage() { const page = await getPublishedPage("contact"); if (!page) notFound(); return <><SiteHeader /><PageBlockRenderer blocks={page.blocks} /></>; }
