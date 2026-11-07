import type { Metadata, ResolvingMetadata } from "next";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import { ChevronRight, Phone } from "lucide-react";

import { suggestSeoDescription } from "@iorder/core/server/shared/seo";
import { ArticleToc } from "@/components/site/article-toc";
import { ConsultBand } from "@/components/site/consult-band";
import { JsonLd } from "@/components/site/json-ld";
import { NewsGrid } from "@/components/site/news";
import { PostContent } from "@/components/site/post-content";
import { ShareLinks } from "@/components/site/share-links";
import { SiteHeader } from "@/components/site/site-header";
import { SiteLink as Link } from "@/components/site/site-link";
import { Container } from "@/components/ui";
import { articleOutline } from "@/lib/article-outline";
import { getExternalLinks, getPublishedOfferingSummaries, getPublishedPostBySlug, getPublishingConfig, getSiteProfile } from "@/lib/backend";
import { getNewsIndex, newsLabel, newsPostPath, newsTopicPath, readingMinutes, relatedNews } from "@/lib/news";
import { contentMetadata } from "@/lib/page-metadata";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/structured-data";

export const revalidate = 0;

type NewsDetailPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: NewsDetailPageProps, parent: ResolvingMetadata): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) return { title: "Không tìm thấy bài viết | iOrder" };
  return contentMetadata({ title: `${post.seoTitle ?? post.title} | iOrder`, description: post.seoDescription ?? suggestSeoDescription(post.excerpt, post.content), path: `/tin-tuc/${post.slug}`, canonicalUrl: post.canonicalUrl, image: post.cover ? { url: post.cover.url, alt: post.cover.altText } : null, type: "article" }, parent);
}

const dateFormatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

// Bài viết kiểu trang tin: cột bài (đường dẫn, tiêu đề, chủ đề · ngày · thời gian đọc, đoạn mở đầu, chia sẻ, ảnh lớn dưới
// tiêu đề, nội dung có mục lục đầu bài, ô hỏi tư vấn, chủ đề & thẻ, chia sẻ) + cột bên bám theo khi cuộn (mục lục, giới thiệu
// phần mềm nổi bật lấy từ CMS › Sản phẩm, bài viết mới nhất) → bài viết liên quan → dải tư vấn.
export default async function NewsDetailPage({ params }: NewsDetailPageProps) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) notFound();
  // Bài hướng dẫn có trang riêng; tránh trùng nội dung dưới hai URL.
  if (post.type === "guide") permanentRedirect(`/ho-tro/huong-dan/${post.slug}`);
  const [config, profile, index, software, links] = await Promise.all([getPublishingConfig(), getSiteProfile(), getNewsIndex(), getPublishedOfferingSummaries("software").catch(() => []), getExternalLinks().catch(() => null)]);
  const site = config.siteUrl;
  const path = `/tin-tuc/${post.slug}`;
  const { document, toc } = articleOutline(post.content, post.title);
  const topic = post.categories[0] ?? null;
  const related = relatedNews(index.posts, post);
  const latest = index.posts.filter((item) => item.id !== post.id).slice(0, 4);
  const product = software.find((item) => item.isFeatured) ?? software[0] ?? null;
  const crumbs = [{ name: "Trang chủ", path: "/" }, { name: "Tin tức", path: "/tin-tuc" }, ...(topic ? [{ name: topic.name, path: newsTopicPath(topic.slug) }] : []), { name: post.title, path }];

  return <>
    <SiteHeader />
    {site ? <JsonLd data={[articleJsonLd(site, { title: post.title, description: post.seoDescription ?? suggestSeoDescription(post.excerpt, post.content), path, imagePath: post.cover?.url ?? null, publishedAt: post.publishedAt, publisherName: profile?.companyName ?? "iOrder" }), breadcrumbJsonLd(site, crumbs)]} /> : null}
    <main id="noi-dung">
      <div className="site-container article-page">
        <article className="article-main">
          <nav aria-label="Đường dẫn"><ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0 text-small text-muted">
            {crumbs.slice(0, -1).map((crumb, position) => <li className="flex items-center gap-1.5" key={crumb.path}>{position ? <ChevronRight aria-hidden="true" size={14} /> : null}<Link className="transition hover:text-brand-700" href={crumb.path}>{crumb.name}</Link></li>)}
          </ol></nav>
          <h1 className="article-title">{post.title}</h1>
          <p className="news-meta article-meta">
            {topic ? <Link className="news-meta__topic hover:underline" href={newsTopicPath(topic.slug)}>{topic.name}</Link> : null}
            {post.publishedAt ? <span>{dateFormatter.format(post.publishedAt)}</span> : null}
            <span>{readingMinutes(post.content)} phút đọc</span>
          </p>
          {post.excerpt ? <p className="article-lead">{post.excerpt}</p> : null}
          <ShareLinks />
          {post.cover ? <Image alt={post.cover.altText ?? post.title} className="article-cover" height={630} priority sizes="(min-width: 1024px) 760px, 100vw" src={post.cover.url} width={1200} /> : null}
          <div className="article-body"><PostContent document={document} tocClassName={toc.length >= 2 ? "lg:hidden" : ""} /></div>
          {/* Lời mời tư vấn ngay cuối nội dung, trước phần chủ đề & chia sẻ. */}
          <aside aria-label="Tư vấn miễn phí" className="article-cta">
            <div>
              <p className="m-0 font-bold text-ink">Cần tư vấn cho cửa hàng của bạn?</p>
              <p className="mt-1 mb-0 text-small text-muted">Để lại thông tin, đội ngũ iOrder liên hệ lại trong giờ làm việc{profile?.workingHours ? ` (${profile.workingHours})` : ""}.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link className="button button--primary" href="/lien-he">Đăng ký tư vấn</Link>
              {profile?.hotline ? <a className="button button--secondary" href={tel(profile.hotline)}><Phone aria-hidden="true" size={16} />{profile.hotline}</a> : null}
            </div>
          </aside>
          <div className="article-foot">
            {post.categories.length || post.tags.length ? <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-2 text-small text-muted">
              {post.categories.length ? <span>Chủ đề: {post.categories.map((category, position) => <span key={category.id}>{position ? ", " : ""}<Link className="font-semibold text-brand-700 hover:underline" href={newsTopicPath(category.slug)}>{category.name}</Link></span>)}</span> : null}
              {post.tags.map((tag) => <Link className="article-tag" href={`/tin-tuc/the/${tag.slug}`} key={tag.id}>#{tag.name}</Link>)}
            </p> : null}
            <ShareLinks />
          </div>
        </article>

        <aside aria-label="Thông tin thêm" className="article-aside"><div className="article-aside__sticky">
          {toc.length >= 2 ? <ArticleToc entries={toc} /> : null}
          {product ? <section aria-label="Phần mềm iOrder" className="aside-card">
            {product.cover ? <Image alt={product.cover.altText ?? product.title} className="aside-card__image" height={160} sizes="300px" src={product.cover.url} width={300} /> : null}
            <p className="m-0 font-bold text-ink">{product.title}</p>
            {product.summary ? <p className="mt-1 mb-0 line-clamp-3 text-small text-muted">{product.summary}</p> : null}
            <div className="mt-4 grid gap-2">
              {links?.trial ? <a className="button button--primary w-full" href={links.trial} rel="noopener noreferrer" target="_blank">Dùng thử miễn phí</a> : null}
              <Link className="button button--secondary w-full" href={`/phan-mem/${product.slug}`}>Xem chi tiết</Link>
            </div>
          </section> : null}
          {latest.length ? <section aria-labelledby="bai-moi-nhat" className="aside-card">
            <h2 className="mb-3 text-[1rem] font-bold text-ink" id="bai-moi-nhat">Bài viết mới nhất</h2>
            <ul className="news-side">{latest.map((item) => <li key={item.id}><Link className="news-side__item news-side__item--compact group" href={newsPostPath(item)}>
              {item.cover ? <Image alt="" className="news-side__image" height={56} sizes="88px" src={item.cover.url} width={88} /> : <span aria-hidden="true" className="news-side__image" />}
              <span className="min-w-0">
                <span className="news-meta"><span className="news-meta__topic">{newsLabel(item)}</span></span>
                <span className="news-side__title">{item.title}</span>
              </span>
            </Link></li>)}</ul>
          </section> : null}
        </div></aside>
      </div>

      {related.length ? <section aria-labelledby="bai-lien-quan" className="news-section border-t border-line"><Container>
        <h2 className="mb-6 text-h3 font-bold tracking-tight text-ink" id="bai-lien-quan">Bài viết liên quan</h2>
        <NewsGrid posts={related} />
      </Container></section> : null}
      <ConsultBand actionLabel="Đăng ký tư vấn" description="Đội ngũ iOrder tư vấn phần mềm, thiết bị và cách vận hành phù hợp với cửa hàng của bạn — miễn phí." hotline={profile?.hotline ?? null} title="Muốn áp dụng cho cửa hàng của bạn?" />
    </main>
  </>;
}
