import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { TaxonomyPostList } from "@/components/site/taxonomy-post-list";
import { getPublishedPostsByTaxonomy } from "@/lib/backend";
import { findCategoryBySlug } from "@/lib/backend";
type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> { const { slug } = await params; const category = await findCategoryBySlug(slug); return category ? { title: `${category.name} | Tin tức iOrder`, description: category.description ?? undefined } : { title: "Không tìm thấy chuyên mục | iOrder" }; }
export default async function CategoryPage({ params }: Props) { const { slug } = await params; const category = await findCategoryBySlug(slug); if (!category) notFound(); const posts = await getPublishedPostsByTaxonomy("category", slug); return <><SiteHeader /><main className="mx-auto max-w-4xl px-6 py-16"><p className="text-sm font-bold text-blue-700">Chuyên mục</p><h1 className="mt-3 text-4xl font-extrabold">{category.name}</h1>{category.description ? <p className="mt-4 text-slate-600">{category.description}</p> : null}<TaxonomyPostList posts={posts} /></main></>; }
