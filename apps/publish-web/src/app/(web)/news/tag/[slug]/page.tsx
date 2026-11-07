import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";

import { PageHero } from "@/components/site/page-hero";
import { SiteHeader } from "@/components/site/site-header";
import { TaxonomyPostList } from "@/components/site/taxonomy-post-list";
import { findTagBySlug, getPublishedPostsByTaxonomy } from "@/lib/backend";
import { contentMetadata } from "@/lib/page-metadata";

type Props = { params: Promise<{ slug: string }> };
export const revalidate = 0;

// Thẻ không có mô tả riêng trong CMS: câu mô tả theo tên thẻ (Google và phần đầu trang dùng chung).
const describe = (name: string) => `Bài viết, hướng dẫn và kinh nghiệm về “${name}” từ iOrder — cập nhật cho cửa hàng, nhà hàng và doanh nghiệp.`;

export async function generateMetadata({ params }: Props, parent: ResolvingMetadata): Promise<Metadata> {
  const tag = await findTagBySlug((await params).slug);
  return tag ? contentMetadata({ title: `${tag.name} | Tin tức iOrder`, description: describe(tag.name), path: `/tin-tuc/the/${tag.slug}` }, parent) : { title: "Không tìm thấy thẻ | iOrder" };
}

export default async function TagPage({ params }: Props) {
  const { slug } = await params;
  const tag = await findTagBySlug(slug);
  if (!tag) notFound();
  const posts = await getPublishedPostsByTaxonomy("tag", slug);
  return <><SiteHeader /><main id="noi-dung">
    <PageHero crumbs={[{ name: "Tin tức", path: "/tin-tuc" }, { name: `#${tag.name}`, path: `/tin-tuc/the/${tag.slug}` }]} description={describe(tag.name)} eyebrow="Thẻ bài viết" title={`#${tag.name}`} />
    <TaxonomyPostList posts={posts} />
  </main></>;
}
