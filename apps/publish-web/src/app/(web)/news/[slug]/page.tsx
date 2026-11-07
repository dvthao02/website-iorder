import type { Metadata, ResolvingMetadata } from "next";
import { contentMetadata } from "@/lib/page-metadata";
import { notFound, permanentRedirect } from "next/navigation";

import { ChipList, DetailHero } from "@/components/site/detail-hero";
import { ArticleToc } from "@/components/site/article-toc";
import { PostContent } from "@/components/site/post-content";
import { articleOutline } from "@/lib/article-outline";
import { SiteHeader } from "@/components/site/site-header";
import { getPublishedPostBySlug, getPublishingConfig, getSiteProfile } from "@/lib/backend";
import { JsonLd } from "@/components/site/json-ld";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/structured-data";
import { suggestSeoDescription } from "@iorder/core/server/shared/seo";

export const revalidate = 0;

type NewsDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: NewsDetailPageProps, parent: ResolvingMetadata): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    return { title: "Không tìm thấy bài viết | iOrder" };
  }

  return contentMetadata({ title: `${post.seoTitle ?? post.title} | iOrder`, description: post.seoDescription ?? suggestSeoDescription(post.excerpt, post.content), path: `/tin-tuc/${post.slug}`, canonicalUrl: post.canonicalUrl, image: post.cover ? { url: post.cover.url, alt: post.cover.altText } : null, type: "article" }, parent);
}

const postTypeLabel = {
  announcement: "Thông báo",
  case_study: "Câu chuyện khách hàng",
  guide: "Hướng dẫn",
  news: "Tin tức",
  promotion: "Khuyến mãi",
} as const;
const dateFormatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

export default async function NewsDetailPage({ params }: NewsDetailPageProps) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    notFound();
  }
  // Bài hướng dẫn có trang riêng; tránh trùng nội dung dưới hai URL.
  if (post.type === "guide") permanentRedirect(`/ho-tro/huong-dan/${post.slug}`);
  const [config, profile] = await Promise.all([getPublishingConfig(), getSiteProfile()]);
  const site = config.siteUrl;
  const { document, toc } = articleOutline(post.content, post.title);

  return (
    <>
      <SiteHeader />
      {site ? <JsonLd data={[articleJsonLd(site, { title: post.title, description: post.seoDescription ?? suggestSeoDescription(post.excerpt, post.content), path: `/tin-tuc/${post.slug}`, imagePath: post.cover?.url ?? null, publishedAt: post.publishedAt, publisherName: profile?.companyName ?? "iOrder" }), breadcrumbJsonLd(site, [{ name: "Trang chủ", path: "/" }, { name: "Tin tức", path: "/tin-tuc" }, { name: post.title, path: `/tin-tuc/${post.slug}` }])]} /> : null}
      {/* Bài viết: phần đầu cùng kiểu trang chi tiết nhưng không ép cao một màn hình, để người đọc thấy ngay nội dung. */}
      <main id="noi-dung">
        <article>
          <DetailHero back={{ href: "/tin-tuc", label: "Tất cả bài viết" }} fill={false} image={post.cover ? { url: post.cover.url, alt: post.cover.altText ?? post.title } : null} label={postTypeLabel[post.type]} summary={post.excerpt} title={post.title}>
            {post.publishedAt ? <p className="mt-5 mb-0 text-sm text-muted">Đăng ngày {dateFormatter.format(post.publishedAt)}</p> : null}
            <ChipList items={[...post.categories.map(category => ({ key: `c-${category.id}`, text: category.name, href: `/tin-tuc/chuyen-muc/${category.slug}` })), ...post.tags.map(tag => ({ key: `t-${tag.id}`, text: `#${tag.name}`, href: `/tin-tuc/the/${tag.slug}` }))]} label="Chuyên mục và thẻ của bài viết" />
          </DetailHero>
          {/* Màn rộng: nội dung + mục lục bám theo bên phải; màn hẹp: mục lục nằm đầu bài. */}
          <div className="site-container py-12 sm:py-16"><div className="article-layout">
            <div className="min-w-0"><PostContent document={document} tocClassName={toc.length >= 2 ? "xl:hidden" : ""} /></div>
            {toc.length >= 2 ? <aside className="article-layout__toc"><div className="guide-docs__sticky"><ArticleToc entries={toc} /></div></aside> : null}
          </div></div>
        </article>
      </main>
    </>
  );
}
