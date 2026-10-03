import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { PageBlockRenderer } from "@/components/site/page-block-renderer";
import { getPublishedPage } from "@/lib/backend";
import type { Metadata } from "next";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  return page ? { title: page.seoTitle || page.title, description: page.seoDescription || undefined, alternates: page.canonicalUrl ? { canonical: page.canonicalUrl } : undefined } : { title: "Không tìm thấy trang | iOrder" };
}
export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const page = await getPublishedPage(slug); if (!page) notFound(); return <><SiteHeader /><PageBlockRenderer blocks={page.blocks} /></>; }
