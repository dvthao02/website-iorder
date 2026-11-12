import type { Metadata, ResolvingMetadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronRight, Headset, MessageSquareText, Phone } from "lucide-react";

import { ArticleToc } from "@/components/site/article-toc";
import { GuideDocsLayout } from "@/components/site/guide-docs";
import { ContentJsonLd } from "@/components/site/content-json-ld";
import { PostContent } from "@/components/site/post-content";
import { SiteHeader } from "@/components/site/site-header";
import { SiteLink as Link } from "@/components/site/site-link";
import { articleOutline } from "@/lib/article-outline";
import { getPublishedPage, getPublishedPostBySlug, getPublishingConfig, getSiteProfile } from "@/lib/backend";
import { getGuideIndex } from "@/lib/guides";
import { contentMetadata } from "@/lib/page-metadata";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/structured-data";
import { suggestSeoDescription } from "@iorder/shared/server/shared/seo";

export const revalidate = 0;

type SupportGuideDetailPageProps = { params: Promise<{ slug: string }> };
const dateFormatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

export async function generateMetadata({ params }: SupportGuideDetailPageProps, parent: ResolvingMetadata): Promise<Metadata> {
  const post = await getPublishedPostBySlug((await params).slug);
  return post?.type === "guide"
    ? contentMetadata({ title: post.seoTitle ?? (/hướng dẫn/i.test(post.title) ? post.title : `${post.title} | Hướng dẫn iOrder`), description: post.seoDescription ?? suggestSeoDescription(post.excerpt, post.content), path: `/ho-tro/huong-dan/${post.slug}`, canonicalUrl: post.canonicalUrl, seo: post.seo, image: post.cover ? { url: post.cover.url, alt: post.cover.altText } : null, type: "article" }, parent)
    : { title: "Không tìm thấy hướng dẫn | iOrder" };
}

// Bài hướng dẫn trong khung tài liệu: danh mục hướng dẫn bên trái (bài đang xem được tô), bài ở giữa trên nền thẻ trắng
// (đường dẫn, tiêu đề, chuyên mục, ngày cập nhật, ảnh bìa, nội dung), mục lục bám theo bên phải; cuối bài có bài trước/sau
// theo đúng thứ tự danh mục và hộp "Cần thêm trợ giúp?".
export default async function SupportGuideDetailPage({ params }: SupportGuideDetailPageProps) {
  const post = await getPublishedPostBySlug((await params).slug);
  if (!post || post.type !== "guide") notFound();
  const [config, profile, index, remotePage] = await Promise.all([getPublishingConfig(), getSiteProfile(), getGuideIndex(), getPublishedPage("remote-support")]);
  const site = config.siteUrl;
  const href = `/ho-tro/huong-dan/${post.slug}`;
  const { document, toc } = articleOutline(post.content, post.title);
  const position = index.entries.findIndex((entry) => entry.href === href);
  const previous = position > 0 ? index.entries[position - 1] : null;
  const next = position >= 0 ? index.entries[position + 1] ?? null : null;
  const category = post.categories[0] ?? null;

  return (
    <>
      <SiteHeader />
      {site ? <ContentJsonLd seo={post.seo} title={post.title} description={post.seoDescription} path={href} defaults={[articleJsonLd(site, { title: post.title, description: post.seoDescription ?? suggestSeoDescription(post.excerpt, post.content), path: href, imagePath: post.cover?.url ?? null, publishedAt: post.publishedAt, publisherName: profile?.companyName ?? "iOrder" }), breadcrumbJsonLd(site, [{ name: "Trang chủ", path: "/" }, { name: "Hỗ trợ", path: "/ho-tro" }, { name: "Hướng dẫn sử dụng", path: "/ho-tro/huong-dan" }, { name: post.title, path: href }])]} /> : null}
      <main id="noi-dung">
        <GuideDocsLayout activeHref={href} groups={index.groups} toc={toc.length >= 2 ? <ArticleToc entries={toc} /> : null}>
          <article className="guide-article">
            <nav aria-label="Đường dẫn"><ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0 text-small text-muted">
              <li><Link className="transition hover:text-brand-700" href="/ho-tro">Hỗ trợ</Link></li>
              <li className="flex items-center gap-1.5"><ChevronRight aria-hidden="true" size={14} /><Link className="transition hover:text-brand-700" href="/ho-tro/huong-dan">Hướng dẫn sử dụng</Link></li>
              {category ? <li className="flex items-center gap-1.5"><ChevronRight aria-hidden="true" size={14} />{category.name}</li> : null}
              <li className="flex min-w-0 items-center gap-1.5"><ChevronRight aria-hidden="true" size={14} /><span aria-current="page" className="truncate font-semibold text-ink">{post.title}</span></li>
            </ol></nav>
            <h1 className="mt-5 mb-0 text-[1.85rem] leading-[1.2] font-bold tracking-tight text-balance text-ink sm:text-[2.25rem]">{post.title}</h1>
            {post.publishedAt ? <p className="mt-3 mb-0 text-small text-muted">Đăng ngày {dateFormatter.format(post.publishedAt)}</p> : null}
            {post.excerpt ? <p className="mt-4 mb-0 text-lead text-muted">{post.excerpt}</p> : null}
            {post.cover ? <Image alt={post.cover.altText ?? post.title} className="mt-7 h-auto w-full rounded-xl border border-line" height={630} priority sizes="(min-width: 1280px) 48rem, (min-width: 1024px) 60vw, 100vw" src={post.cover.url} width={1200} /> : null}
            <div className="mt-8"><PostContent document={document} tocClassName="xl:hidden" /></div>
            {previous || next ? <nav aria-label="Bài hướng dẫn khác" className="mt-12 grid gap-3 border-t border-line pt-8 sm:grid-cols-2">
              {previous ? <Link className="guide-pager group" href={previous.href}><span className="guide-pager__label"><ArrowLeft aria-hidden="true" size={16} />Bài trước</span><span className="guide-pager__title">{previous.title}</span></Link> : <span aria-hidden="true" className="hidden sm:block" />}
              {next ? <Link className="guide-pager guide-pager--next group" href={next.href}><span className="guide-pager__label">Bài tiếp theo<ArrowRight aria-hidden="true" size={16} /></span><span className="guide-pager__title">{next.title}</span></Link> : null}
            </nav> : null}
          </article>
          <aside aria-label="Cần thêm trợ giúp" className="guide-help">
            <div>
              <p className="m-0 text-lead font-bold text-ink">Chưa giải quyết được vấn đề?</p>
              <p className="mt-1 mb-0 text-small text-muted">Đội ngũ kỹ thuật iOrder sẵn sàng hỗ trợ{profile?.workingHours ? ` (${profile.workingHours})` : ""}.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile?.hotline ? <a className="button button--primary" href={`tel:${profile.hotline.replace(/[^\d+]/g, "")}`}><Phone aria-hidden="true" size={17} />{profile.hotline}</a> : null}
              {remotePage ? <Link className="button button--secondary" href="/ho-tro-tu-xa"><Headset aria-hidden="true" size={17} />Hỗ trợ từ xa</Link> : null}
              <Link className="button button--secondary" href="/lien-he"><MessageSquareText aria-hidden="true" size={17} />Gửi yêu cầu</Link>
            </div>
          </aside>
        </GuideDocsLayout>
      </main>
    </>
  );
}
