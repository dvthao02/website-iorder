import type { Metadata, ResolvingMetadata } from "next";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import { ChevronRight, Phone } from "lucide-react";

import { suggestSeoDescription } from "@iorder/shared/server/shared/seo";
import { ArticleAuthorBox, ArticlePager, ArticleSummary } from "@/components/site/article-extras";
import { ArticleToc } from "@/components/site/article-toc";
import { AuthorByline } from "@/components/site/author-byline";
import { ReadingProgress } from "@/components/site/reading-progress";
import { articleSummary } from "@/lib/article-summary";
import { authorMetaUrl, resolvePostAuthor } from "@/lib/author";
import { PostCard } from "@/components/site/collection-list";
import { ContentJsonLd } from "@/components/site/content-json-ld";
import { PostContent } from "@/components/site/post-content";
import { ShareLinks } from "@/components/site/share-links";
import { SiteHeader } from "@/components/site/site-header";
import { SiteLink as Link } from "@/components/site/site-link";
import { visibleUpdatedAt } from "@/lib/article-dates";
import { articleImagePath } from "@/lib/article-image";
import { articleOutline } from "@/lib/article-outline";
import { getBuilderPreviewContext } from "@/lib/builder-preview";
import { getPublishedPostBySlug, getPublishingConfig, getSiteProfile } from "@/lib/backend";
import { getNewsIndex, newsLabel, newsPostPath, newsTopicPath, readingMinutes, relatedNews } from "@/lib/news";
import { contentMetadata } from "@/lib/page-metadata";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/structured-data";

export const revalidate = 0;

type NewsDetailPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: NewsDetailPageProps, parent: ResolvingMetadata): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) return { title: "Không tìm thấy bài viết | iOrder" };
  const author = resolvePostAuthor(post);
  const siteUrl = author ? (await getPublishingConfig()).siteUrl ?? undefined : undefined;
  return contentMetadata({ title: post.seoTitle ?? post.title, description: post.seoDescription ?? suggestSeoDescription(post.excerpt, post.content), path: `/tin-tuc/${post.slug}`, canonicalUrl: post.canonicalUrl, seo: post.seo, image: post.cover ? { url: post.cover.url, alt: post.cover.altText } : null, authors: author ? [{ name: author.name, url: authorMetaUrl(author, siteUrl) }] : undefined, type: "article", article: { publishedTime: post.publishedAt, modifiedTime: post.updatedAt, section: post.categories[0]?.name, tags: post.tags.map((tag) => tag.name) } }, parent);
}

const dateFormatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

// Bài viết kiểu trang tin, chia ba vùng:
// 1) Cột bài (trái): đường dẫn, tiêu đề, chủ đề · ngày · tác giả · thời gian đọc, đoạn mở đầu, chia sẻ, ảnh bìa (khung 16:9), tóm tắt nhanh,
//    mục lục đầu bài (điện thoại), nội dung, hộp tác giả, ô hỏi tư vấn (một lần), chủ đề & thẻ, bài mới hơn / cũ hơn.
// 2) Cột bên (phải): mục lục bám theo khi cuộn (chỉ máy tính) và Bài viết liên quan (danh sách gọn; điện thoại nằm dưới bài). Không có cả hai thì bài nằm một cột căn giữa.
// 3) Dưới cùng, toàn chiều rộng: Bài viết mới nhất (thẻ ảnh) và hàng chủ đề để đọc tiếp.
export default async function NewsDetailPage({ params }: NewsDetailPageProps) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) notFound();
  // Bài hướng dẫn có trang riêng; tránh trùng nội dung dưới hai URL.
  if (post.type === "guide") permanentRedirect(`/ho-tro/huong-dan/${post.slug}`);
  const [config, profile, index, preview] = await Promise.all([getPublishingConfig(), getSiteProfile(), getNewsIndex(), getBuilderPreviewContext()]);
  // Trong khung xem trước của CMS: bấm vào tiêu đề, tóm tắt, ảnh bìa, nội dung, chuyên mục, thẻ thì CMS nhảy tới đúng ô cần sửa.
  const builderBlock = preview?.document.kind === "post" ? 0 : undefined;
  const site = config.siteUrl;
  const author = resolvePostAuthor(post);
  const path = `/tin-tuc/${post.slug}`;
  const { document, toc } = articleOutline(post.content, post.title);
  // Tóm tắt nhanh tự rút từ câu đầu của từng đề mục; bài cũ (khối v1) không có đề mục nên không có tóm tắt.
  const summary = document.version === 2 ? articleSummary(document.doc) : null;
  const position = index.posts.findIndex((item) => item.id === post.id);
  const newer = position > 0 ? index.posts[position - 1] : null;
  const older = position >= 0 ? index.posts[position + 1] ?? null : null;
  const updatedAt = visibleUpdatedAt(post.publishedAt, post.updatedAt);
  const topic = post.categories[0] ?? null;
  const related = relatedNews(index.posts, post, 3);
  // Đáy trang: bài mới nhất, không lặp bài đang đọc và các bài đã có ở "liên quan" (cột bên).
  const latest = index.posts.filter((item) => item.id !== post.id && !related.includes(item)).slice(0, 3);
  const hasAside = toc.length >= 2 || related.length > 0;
  const crumbs = [{ name: "Trang chủ", path: "/" }, { name: "Tin tức", path: "/tin-tuc" }, ...(topic ? [{ name: topic.name, path: newsTopicPath(topic.slug) }] : []), { name: post.title, path }];

  return <>
    <SiteHeader />
    <ReadingProgress />
    {site ? <ContentJsonLd seo={post.seo} title={post.title} description={post.seoDescription} path={path} defaults={[articleJsonLd(site, { title: post.title, description: post.seoDescription ?? suggestSeoDescription(post.excerpt, post.content), path, imagePath: await articleImagePath(post.cover?.url, config.defaultOgMediaId), publishedAt: post.publishedAt, modifiedAt: post.updatedAt, section: topic?.name, keywords: post.tags.map((tag) => tag.name), author: author ? { name: author.name, jobTitle: author.jobTitle, pagePath: author.pagePath, profileUrl: author.profileUrl } : null, publisherName: profile?.companyName ?? "iOrder" }), breadcrumbJsonLd(site, crumbs)]} /> : null}
    <main id="noi-dung">
      <div className={`site-container article-page${hasAside ? "" : " article-page--single"}`}>
        <article className="article-main" data-builder-block={builderBlock}>
          <nav aria-label="Đường dẫn"><ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0 text-small text-muted">
            {crumbs.slice(0, -1).map((crumb, position) => <li className="flex items-center gap-1.5" key={crumb.path}>{position ? <ChevronRight aria-hidden="true" size={14} /> : null}<Link className="transition hover:text-brand-700" href={crumb.path}>{crumb.name}</Link></li>)}
          </ol></nav>
          <h1 className="article-title" data-builder-field="title">{post.title}</h1>
          <p className="news-meta article-meta">
            {topic ? <Link className="news-meta__topic hover:underline" href={newsTopicPath(topic.slug)}>{topic.name}</Link> : null}
            {post.publishedAt ? <time dateTime={post.publishedAt.toISOString()}>{dateFormatter.format(post.publishedAt)}</time> : null}
            {updatedAt ? <span>Cập nhật <time dateTime={updatedAt.toISOString()}>{dateFormatter.format(updatedAt)}</time></span> : null}
            <AuthorByline author={author} />
            <span>{readingMinutes(post.content)} phút đọc</span>
          </p>
          {post.excerpt ? <p className="article-lead" data-builder-field="excerpt">{post.excerpt}</p> : null}
          <ShareLinks />
          {post.cover ? <Image alt={post.cover.altText ?? post.title} className="article-cover" data-builder-field="cover" height={630} preload sizes="(min-width: 1024px) 760px, 100vw" src={post.cover.url} width={1200} /> : null}
          <ArticleSummary points={summary} />
          {/* Mục lục: máy tính nằm ở cột bên và bám theo khi cuộn; điện thoại là hộp đầu bài. */}
          <div className="article-body" data-builder-field="content"><PostContent altSubject={post.title} document={document} tocClassName="lg:hidden" /></div>
          <ArticleAuthorBox author={author} />
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
              {post.categories.length ? <span data-builder-field="categories">Chủ đề: {post.categories.map((category, position) => <span key={category.id}>{position ? ", " : ""}<Link className="font-semibold text-brand-700 hover:underline" href={newsTopicPath(category.slug)}>{category.name}</Link></span>)}</span> : null}
              {post.tags.map((tag) => <Link className="article-tag" data-builder-field="tags" href={`/tin-tuc/the/${tag.slug}`} key={tag.id}>#{tag.name}</Link>)}
            </p> : null}
            <ShareLinks />
          </div>
          <ArticlePager newer={newer} older={older} />
        </article>

        {hasAside ? <aside aria-label="Mục lục và bài viết liên quan" className="article-aside"><div className="article-aside__sticky">
          {toc.length >= 2 ? <div className="article-aside__toc"><ArticleToc entries={toc} title="Mục lục" /></div> : null}
          {related.length ? <section aria-labelledby="bai-lien-quan">
            <h2 className="article-section-title" id="bai-lien-quan">Bài viết liên quan</h2>
            <ul className="news-side">{related.map((item) => <li key={item.id}><Link className="news-side__item group" href={newsPostPath(item)}>
              {item.cover ? <Image alt="" className="news-side__image" height={90} sizes="140px" src={item.cover.url} width={140} /> : <span aria-hidden="true" className="news-side__image" />}
              <span className="min-w-0">
                <span className="news-meta"><span className="news-meta__topic">{newsLabel(item)}</span><span>{dateFormatter.format(item.publishedAt ?? item.createdAt)}</span></span>
                <span className="news-side__title">{item.title}</span>
              </span>
            </Link></li>)}</ul>
          </section> : null}
        </div></aside> : null}
      </div>

      {/* Đọc tiếp (đáy trang, toàn chiều rộng): bài mới nhất dạng thẻ ảnh và các chủ đề. */}
      {latest.length || index.topics.length ? <div className="article-more"><div className="site-container">
        {latest.length ? <section aria-labelledby="bai-moi-nhat">
          <h2 className="article-more__title" id="bai-moi-nhat">Bài viết mới nhất</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{latest.map((item) => <PostCard Heading="h3" key={item.id} post={item} />)}</div>
        </section> : null}
        {index.topics.length ? <section aria-labelledby="chu-de" className="article-more__topics">
          <h2 className="article-more__title" id="chu-de">Khám phá theo chủ đề</h2>
          <ul className="article-topics">{index.topics.map((item) => <li key={item.slug}><Link aria-current={item.slug === topic?.slug ? "true" : undefined} href={newsTopicPath(item.slug)}>{item.name}<span className="news-topics__count">{item.count}</span></Link></li>)}</ul>
        </section> : null}
      </div></div> : null}
    </main>
  </>;
}
