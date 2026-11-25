import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";

import { NewsGrid, NewsPagination, NewsTopics } from "@/components/site/news";
import { PageHero } from "@/components/site/page-hero";
import { SiteHeader } from "@/components/site/site-header";
import { getT } from "@/lib/messages";
import { Container } from "@/components/ui";
import { findCategoryBySlug, getPublishedPostsByTaxonomy } from "@/lib/backend";
import { getNewsIndex, newsTopicPath, paginateNews, parseNewsPage } from "@/lib/news";
import { contentMetadata } from "@/lib/page-metadata";
import { seoDescriptionMin } from "@iorder/shared/server/shared/seo";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ trang?: string | string[] }> };
export const revalidate = 0;

// Mô tả chuyên mục nhập trong CMS; chưa có thì dùng câu mặc định để Google luôn có mô tả.
const describe = (name: string, description: string | null | undefined) => description?.trim() || `Tổng hợp bài viết thuộc chuyên mục “${name}” của iOrder: tin tức, kinh nghiệm kinh doanh và hướng dẫn mới nhất.`;

// Mô tả cho Google tối thiểu 70 ký tự: mô tả ngắn trong CMS được nối thêm câu giới thiệu chuyên mục (phần đầu trang vẫn dùng mô tả gốc).
const metaDescription = (name: string, description: string | null | undefined) => {
  const text = describe(name, description);
  return text.length >= seoDescriptionMin ? text : `${text} Tổng hợp bài viết thuộc chuyên mục “${name}” của iOrder.`;
};

export async function generateMetadata({ params, searchParams }: Props, parent: ResolvingMetadata): Promise<Metadata> {
  const { slug } = await params;
  const category = await findCategoryBySlug(slug);
  const page = parseNewsPage((await searchParams).trang);
  const path = newsTopicPath(category?.slug ?? "");
  if (!category) return { title: (await getT())("news.categoryNotFound") };
  // Chuyên mục chưa có bài là trang mỏng: vẫn mở được nhưng không để Google lập chỉ mục.
  const empty = (await getPublishedPostsByTaxonomy("category", slug)).length === 0;
  return contentMetadata({ title: page > 1 ? `${category.name} – Trang ${page} | Tin tức iOrder` : `${category.name} – Tin tức và bài viết mới nhất`, description: metaDescription(category.name, category.description), path: page > 1 ? `${path}?trang=${page}` : path, seo: empty ? { index: false } : undefined }, parent);
}

// Trang chuyên mục: cùng khung trang Tin tức (thanh chủ đề tô mục đang xem), lưới bài + phân trang 12 bài/trang.
export default async function CategoryPage({ params, searchParams }: Props) {
  const t = await getT();
  const { slug } = await params;
  const page = parseNewsPage((await searchParams).trang);
  const category = await findCategoryBySlug(slug);
  if (!category) notFound();
  const [posts, index] = await Promise.all([getPublishedPostsByTaxonomy("category", slug), getNewsIndex()]);
  const { grid, totalPages } = paginateNews(posts, page, false);
  if (page > totalPages) notFound();
  return <><SiteHeader /><main id="noi-dung">
    <PageHero crumbs={[{ name: t("crumb.news"), path: "/news" }, { name: category.name, path: newsTopicPath(category.slug) }]} description={describe(category.name, category.description)} eyebrow={t("news.topicEyebrow")} title={category.name} />
    <NewsTopics active={category.slug} topics={index.topics} />
    <section aria-labelledby="bai-viet-chu-de" className="news-section"><Container>
      {/* Tiêu đề ẩn để thứ tự đề mục liền mạch: H1 tên chuyên mục → H2 → tiêu đề từng bài (H3). */}
      <h2 className="sr-only" id="bai-viet-chu-de">{t("news.topicHeading", { name: category.name })}</h2>
      {grid.length ? <NewsGrid posts={grid} /> : <p className="m-0 rounded-card border border-dashed border-line bg-white p-8 text-body text-muted">{t("news.emptyTopic")}</p>}
      <NewsPagination basePath={newsTopicPath(category.slug)} page={page} totalPages={totalPages} />
    </Container></section>
  </main></>;
}
