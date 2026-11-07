import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";

import { PageHero } from "@/components/site/page-hero";
import { SiteHeader } from "@/components/site/site-header";
import { TaxonomyPostList } from "@/components/site/taxonomy-post-list";
import { findCategoryBySlug, getPublishedPostsByTaxonomy } from "@/lib/backend";
import { contentMetadata } from "@/lib/page-metadata";

type Props = { params: Promise<{ slug: string }> };
export const revalidate = 0;

// Mô tả chuyên mục nhập trong CMS; chưa có thì dùng câu mặc định để Google luôn có mô tả.
const describe = (name: string, description: string | null | undefined) => description?.trim() || `Tổng hợp bài viết thuộc chuyên mục “${name}” của iOrder: tin tức, kinh nghiệm kinh doanh và hướng dẫn mới nhất.`;

export async function generateMetadata({ params }: Props, parent: ResolvingMetadata): Promise<Metadata> {
  const category = await findCategoryBySlug((await params).slug);
  return category ? contentMetadata({ title: `${category.name} | Tin tức iOrder`, description: describe(category.name, category.description), path: `/tin-tuc/chuyen-muc/${category.slug}` }, parent) : { title: "Không tìm thấy chuyên mục | iOrder" };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = await findCategoryBySlug(slug);
  if (!category) notFound();
  const posts = await getPublishedPostsByTaxonomy("category", slug);
  return <><SiteHeader /><main id="noi-dung">
    <PageHero crumbs={[{ name: "Tin tức", path: "/tin-tuc" }, { name: category.name, path: `/tin-tuc/chuyen-muc/${category.slug}` }]} description={describe(category.name, category.description)} eyebrow="Chuyên mục" title={category.name} />
    <TaxonomyPostList posts={posts} />
  </main></>;
}
