import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { PageBlockRenderer } from "@/components/site/page-block-renderer";
import { getPublishedPage } from "@/lib/backend";

export async function cmsStaticMetadata(slug: string): Promise<Metadata> { const page = await getPublishedPage(slug); return page ? { title: page.seoTitle || page.title, description: page.seoDescription || undefined, alternates: page.canonicalUrl ? { canonical: page.canonicalUrl } : undefined } : { title: "Không tìm thấy trang | iOrder" }; }
export async function CmsStaticPage({ slug }: { slug: string }) { const page = await getPublishedPage(slug); if (!page) notFound(); return <><SiteHeader /><PageBlockRenderer blocks={page.blocks} /></>; }
