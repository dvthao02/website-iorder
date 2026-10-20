import type { Metadata, ResolvingMetadata } from "next";
import { contentMetadata } from "@/lib/page-metadata";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PostContent } from "@/components/site/post-content";
import { SiteHeader } from "@/components/site/site-header";
import { getPublishedPostBySlug, getPublishingConfig, getSiteProfile } from "@/lib/backend";
import { JsonLd } from "@/components/site/json-ld";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/structured-data";
import { suggestSeoDescription } from "@iorder/core/server/shared/seo";

export const revalidate = 0;

type SupportGuideDetailPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: SupportGuideDetailPageProps, parent: ResolvingMetadata): Promise<Metadata> {
  const post = await getPublishedPostBySlug((await params).slug);
  return post?.type === "guide"
    ? contentMetadata({ title: `${post.seoTitle ?? post.title} | iOrder`, description: post.seoDescription ?? suggestSeoDescription(post.excerpt, post.content), path: `/ho-tro/cai-dat/${post.slug}`, canonicalUrl: post.canonicalUrl, image: post.cover ? { url: post.cover.url, alt: post.cover.altText } : null, type: "article" }, parent)
    : { title: "Không tìm thấy hướng dẫn | iOrder" };
}

export default async function SupportGuideDetailPage({ params }: SupportGuideDetailPageProps) {
  const post = await getPublishedPostBySlug((await params).slug);
  if (!post || post.type !== "guide") notFound();
  const [config, profile] = await Promise.all([getPublishingConfig(), getSiteProfile()]);
  const site = config.siteUrl;

  return (
    <>
      <SiteHeader />
      {site ? <JsonLd data={[articleJsonLd(site, { title: post.title, description: post.seoDescription ?? suggestSeoDescription(post.excerpt, post.content), path: `/ho-tro/cai-dat/${post.slug}`, imagePath: post.cover?.url ?? null, publishedAt: post.publishedAt, publisherName: profile?.companyName ?? "iOrder" }), breadcrumbJsonLd(site, [{ name: "Trang chủ", path: "/" }, { name: "Hỗ trợ cài đặt", path: "/ho-tro/cai-dat" }, { name: post.title, path: `/ho-tro/cai-dat/${post.slug}` }])]} /> : null}
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <Link className="mb-8 inline-flex text-sm font-bold text-blue-700 hover:text-blue-900" href="/ho-tro/cai-dat#huong-dan">← Hướng dẫn sử dụng</Link>
        <article>
          <p className="mb-5 text-sm font-bold uppercase tracking-[0.16em] text-blue-700">Hỗ trợ cài đặt</p>
          <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-6xl">{post.title}</h1>
          {post.excerpt ? <p className="mb-12 text-xl leading-8 text-slate-600">{post.excerpt}</p> : null}
          <PostContent document={post.content} />
        </article>
      </main>
    </>
  );
}
