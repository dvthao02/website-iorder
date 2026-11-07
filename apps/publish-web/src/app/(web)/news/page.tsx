import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";

import { ConsultBand } from "@/components/site/consult-band";
import { NewsFeatured, NewsGrid, NewsPagination, NewsTopics } from "@/components/site/news";
import { PageBlockRenderer } from "@/components/site/page-block-renderer";
import { PageHero } from "@/components/site/page-hero";
import { SiteHeader } from "@/components/site/site-header";
import { SupportSearch } from "@/components/site/support-search";
import { Container } from "@/components/ui";
import { getSiteProfile } from "@/lib/backend";
import { getListingPageContent, listingPageMetadata } from "@/lib/listing-page";
import { getNewsIndex, newsLabel, newsPostPath, paginateNews, parseNewsPage } from "@/lib/news";

export const revalidate = 0;

type NewsPageProps = { searchParams: Promise<{ trang?: string | string[] }> };

export async function generateMetadata({ searchParams }: NewsPageProps, parent: ResolvingMetadata): Promise<Metadata> {
  const page = parseNewsPage((await searchParams).trang);
  const metadata = await listingPageMetadata(await getListingPageContent("listing-news"), page > 1 ? `/tin-tuc?trang=${page}` : "/tin-tuc", parent);
  return page > 1 && typeof metadata.title === "string" ? { ...metadata, title: `${metadata.title} – Trang ${page}` } : metadata;
}

// Trang Tin tức: phần đầu (tiêu đề, mô tả từ CMS + ô tìm bài) → thanh chủ đề (chuyên mục có bài) → khối nổi bật (trang 1)
// → lưới "Bài viết mới" + phân trang ?trang= → các khối khác của trang trong CMS → dải tư vấn (nếu trang chưa có CTA/form).
// Khối "Danh sách nội dung" nguồn Bài viết của trang được thay bằng phần này.
export default async function NewsPage({ searchParams }: NewsPageProps) {
  const page = parseNewsPage((await searchParams).trang);
  const [content, index, profile] = await Promise.all([getListingPageContent("listing-news"), getNewsIndex(), getSiteProfile()]);
  const { featured, grid, totalPages } = paginateNews(index.posts, page, true);
  if (page > totalPages) notFound();
  const header = content?.header ?? { eyebrow: null, title: "Tin tức", description: null };
  const otherBlocks = (content?.blocks ?? []).filter((block) => !(block.type === "collection_list" && block.data.source === "posts"));
  const hasCallToAction = otherBlocks.some((block) => block.isEnabled && (block.type === "cta" || block.type === "lead_form"));
  const searchItems = index.posts.map((post) => ({ title: post.title, href: newsPostPath(post), kind: newsLabel(post), text: [post.excerpt, ...post.categories.map((category) => category.name)].filter(Boolean).join(" ") }));

  return <>
    <SiteHeader />
    <main id="noi-dung">
      <PageHero crumbs={[{ name: "Tin tức", path: "/tin-tuc" }]} description={header.description} eyebrow={header.eyebrow} title={header.title}>
        {searchItems.length ? <div className="mt-6 max-w-xl"><SupportSearch items={searchItems} label="Tìm bài viết" placeholder="Tìm bài viết…" suggestions={[]} /></div> : null}
      </PageHero>
      <NewsTopics active={null} topics={index.topics} />
      {featured.length ? <NewsFeatured posts={featured} /> : null}
      {grid.length ? <section aria-labelledby="bai-viet-moi" className="news-section"><Container>
        <h2 className="mb-6 text-h3 font-bold tracking-tight text-ink" id="bai-viet-moi">{page > 1 ? `Bài viết – trang ${page}` : "Bài viết mới"}</h2>
        <NewsGrid posts={grid} />
        <NewsPagination basePath="/tin-tuc" page={page} totalPages={totalPages} />
      </Container></section> : null}
      {!index.posts.length ? <p className="site-container py-12 text-muted">Chưa có bài viết được xuất bản.</p> : null}
      {otherBlocks.length ? <PageBlockRenderer blocks={otherBlocks} previous="white" /> : null}
      {hasCallToAction ? null : <ConsultBand actionLabel="Đăng ký tư vấn" description="Đội ngũ iOrder tư vấn phần mềm, thiết bị và cách vận hành phù hợp với cửa hàng của bạn — miễn phí." hotline={profile?.hotline ?? null} title="Muốn áp dụng cho cửa hàng của bạn?" />}
    </main>
  </>;
}
