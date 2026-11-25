import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";

import { PageHero } from "@/components/site/page-hero";
import { SiteHeader } from "@/components/site/site-header";
import { getT } from "@/lib/messages";
import type { Translate } from "@/lib/translate";
import { TaxonomyPostList } from "@/components/site/taxonomy-post-list";
import { findTagBySlug, getPublishedPostsByTaxonomy } from "@/lib/backend";
import { contentMetadata } from "@/lib/page-metadata";

type Props = { params: Promise<{ slug: string }> };
export const revalidate = 0;

// Thẻ không có mô tả riêng trong CMS: câu mô tả theo tên thẻ (Google và phần đầu trang dùng chung).
const describe = (name: string, t: Translate) => t("news.tagDescription", { name });

export async function generateMetadata({ params }: Props, parent: ResolvingMetadata): Promise<Metadata> {
  const { slug } = await params;
  const tag = await findTagBySlug(slug);
  const t = await getT();
  if (!tag) return { title: t("news.tagNotFound") };
  // Thẻ chưa có bài là trang mỏng: vẫn mở được nhưng không để Google lập chỉ mục.
  const empty = (await getPublishedPostsByTaxonomy("tag", slug)).length === 0;
  return contentMetadata({ title: t("news.tagTitle", { name: tag.name }), description: describe(tag.name, t), path: `/news/tag/${tag.slug}`, seo: empty ? { index: false } : undefined }, parent);
}

export default async function TagPage({ params }: Props) {
  const t = await getT();
  const { slug } = await params;
  const tag = await findTagBySlug(slug);
  if (!tag) notFound();
  const posts = await getPublishedPostsByTaxonomy("tag", slug);
  return <><SiteHeader /><main id="noi-dung">
    <PageHero crumbs={[{ name: t("crumb.news"), path: "/news" }, { name: `#${tag.name}`, path: `/news/tag/${tag.slug}` }]} description={describe(tag.name, t)} eyebrow={t("news.tagEyebrow")} title={`#${tag.name}`} />
    <TaxonomyPostList posts={posts} />
  </main></>;
}
