import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";

import { NewsGrid, NewsPagination, NewsTopics } from "@/components/site/news";
import { PageHero } from "@/components/site/page-hero";
import { SiteHeader } from "@/components/site/site-header";
import { Container } from "@/components/ui";
import { findCategoryBySlug, getPublishedPostsByTaxonomy } from "@/lib/backend";
import { getNewsIndex, newsTopicPath, paginateNews, parseNewsPage } from "@/lib/news";
import { contentMetadata } from "@/lib/page-metadata";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ trang?: string | string[] }> };
export const revalidate = 0;

// Mô tả chuyên mục nhập trong CMS; chưa có thì dùng câu mặc định để Google luôn có mô tả.
const describe = (name: string, description: string | null | undefined) => description?.trim() || `Tổng hợp bài viết thuộc chuyên mục “${name}” của iOrder: tin tức, kinh nghiệm kinh doanh và hướng dẫn mới nhất.`;

export async function generateMetadata({ params, searchParams }: Props, parent: ResolvingMetadata): Promise<Metadata> {
  const category = await findCategoryBySlug((await params).slug);
  const page = parseNewsPage((await searchParams).trang);
  const path = newsTopicPath(category?.slug ?? "");
  return category ? contentMetadata({ title: `${category.name}${page > 1 ? ` – Trang ${page}` : ""} | Tin tức iOrder`, description: describe(category.name, category.description), path: page > 1 ? `${path}?trang=${page}` : path }, parent) : { title: "Không tìm thấy chuyên mục | iOrder" };
}

// Trang chuyên mục: cùng khung trang Tin tức (thanh chủ đề tô mục đang xem), lưới bài + phân trang 12 bài/trang.
export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const page = parseNewsPage((await searchParams).trang);
  const category = await findCategoryBySlug(slug);
  if (!category) notFound();
  const [posts, index] = await Promise.all([getPublishedPostsByTaxonomy("category", slug), getNewsIndex()]);
  const { grid, totalPages } = paginateNews(posts, page, false);
  if (page > totalPages) notFound();
  return <><SiteHeader /><main id="noi-dung">
    <PageHero crumbs={[{ name: "Tin tức", path: "/tin-tuc" }, { name: category.name, path: newsTopicPath(category.slug) }]} description={describe(category.name, category.description)} eyebrow="Chủ đề" title={category.name} />
    <NewsTopics active={category.slug} topics={index.topics} />
    <section aria-label={`Bài viết chủ đề ${category.name}`} className="news-section"><Container>
      {grid.length ? <NewsGrid posts={grid} /> : <p className="m-0 rounded-card border border-dashed border-line bg-white p-8 text-body text-muted">Chưa có bài viết được xuất bản trong mục này.</p>}
      <NewsPagination basePath={newsTopicPath(category.slug)} page={page} totalPages={totalPages} />
    </Container></section>
  </main></>;
}
