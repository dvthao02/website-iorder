import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { TaxonomyPostList } from "@/components/site/taxonomy-post-list";
import { getPublishedPostsByTaxonomy } from "@/lib/backend";
import { findTagBySlug } from "@/lib/backend";
type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> { const { slug } = await params; const tag = await findTagBySlug(slug); return tag ? { title: `${tag.name} | Tin tức iOrder` } : { title: "Không tìm thấy thẻ | iOrder" }; }
export default async function TagPage({ params }: Props) { const { slug } = await params; const tag = await findTagBySlug(slug); if (!tag) notFound(); const posts = await getPublishedPostsByTaxonomy("tag", slug); return <><SiteHeader /><main className="mx-auto max-w-4xl px-6 py-16"><p className="text-sm font-bold text-blue-700">Thẻ bài viết</p><h1 className="mt-3 text-4xl font-extrabold">#{tag.name}</h1><TaxonomyPostList posts={posts} /></main></>; }
