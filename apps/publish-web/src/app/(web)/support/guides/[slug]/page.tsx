import type { Metadata, ResolvingMetadata } from "next";
import { contentMetadata } from "@/lib/page-metadata";
import { notFound } from "next/navigation";

import { DetailHero } from "@/components/site/detail-hero";
import { Container } from "@/components/ui";
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
    ? contentMetadata({ title: `${post.seoTitle ?? post.title} | iOrder`, description: post.seoDescription ?? suggestSeoDescription(post.excerpt, post.content), path: `/ho-tro/huong-dan/${post.slug}`, canonicalUrl: post.canonicalUrl, image: post.cover ? { url: post.cover.url, alt: post.cover.altText } : null, type: "article" }, parent)
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
      {site ? <JsonLd data={[articleJsonLd(site, { title: post.title, description: post.seoDescription ?? suggestSeoDescription(post.excerpt, post.content), path: `/ho-tro/huong-dan/${post.slug}`, imagePath: post.cover?.url ?? null, publishedAt: post.publishedAt, publisherName: profile?.companyName ?? "iOrder" }), breadcrumbJsonLd(site, [{ name: "Trang chủ", path: "/" }, { name: "Hướng dẫn sử dụng", path: "/ho-tro/huong-dan" }, { name: post.title, path: `/ho-tro/huong-dan/${post.slug}` }])]} /> : null}
      <main id="noi-dung">
        <article>
          <DetailHero back={{ href: "/ho-tro/huong-dan", label: "Hướng dẫn sử dụng" }} fill={false} image={post.cover ? { url: post.cover.url, alt: post.cover.altText ?? post.title } : null} label="Hướng dẫn sử dụng" summary={post.excerpt} title={post.title} />
          <Container className="py-12 sm:py-16" width="text"><PostContent document={post.content} /></Container>
        </article>
      </main>
    </>
  );
}
