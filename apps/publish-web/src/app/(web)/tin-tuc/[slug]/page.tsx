import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

import { PostContent } from "@/components/site/post-content";
import { SiteHeader } from "@/components/site/site-header";
import { getPublishedPostBySlug } from "@/lib/backend";

export const dynamic = "force-dynamic";

type NewsDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: NewsDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    return { title: "Không tìm thấy bài viết | iOrder" };
  }

  return {
    title: `${post.seoTitle ?? post.title} | iOrder`,
    description: post.seoDescription ?? post.excerpt ?? undefined,
    alternates: post.canonicalUrl ? { canonical: post.canonicalUrl } : undefined,
  };
}

const postTypeLabel = {
  announcement: "Thông báo",
  case_study: "Câu chuyện khách hàng",
  guide: "Hướng dẫn",
  news: "Tin tức",
  promotion: "Khuyến mãi",
} as const;

export default async function NewsDetailPage({ params }: NewsDetailPageProps) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <Link className="mb-8 inline-flex text-sm font-bold text-blue-700 hover:text-blue-900" href="/tin-tuc">
          ← Tất cả bài viết
        </Link>
        <article>
          <p className="mb-5 text-sm font-bold uppercase tracking-[0.16em] text-blue-700">{postTypeLabel[post.type]}</p>
          <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-6xl">{post.title}</h1>
          {post.excerpt ? <p className="mb-12 text-xl leading-8 text-slate-600">{post.excerpt}</p> : null}
          <PostContent document={post.content} />
          {post.categories.length || post.tags.length ? <section className="mt-8 grid gap-3"><h2 className="text-lg font-bold">Phân loại bài viết</h2>{post.categories.length ? <p>Chuyên mục: {post.categories.map((category, index) => <span key={category.id}>{index ? ", " : ""}<Link className="text-blue-700" href={`/tin-tuc/chuyen-muc/${category.slug}`}>{category.name}</Link></span>)}</p> : null}{post.tags.length ? <p>Thẻ: {post.tags.map((tag, index) => <span key={tag.id}>{index ? " " : ""}<Link className="text-blue-700" href={`/tin-tuc/the/${tag.slug}`}>#{tag.name}</Link></span>)}</p> : null}</section> : null}
          {post.cover ? <Image src={post.cover.url} alt={post.cover.altText ?? post.title} width={1200} height={675} className="mt-6 h-auto w-full rounded-xl" /> : null}
        </article>
      </main>
    </>
  );
}
