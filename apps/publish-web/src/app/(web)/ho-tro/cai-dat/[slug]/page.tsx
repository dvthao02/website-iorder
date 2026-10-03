import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PostContent } from "@/components/site/post-content";
import { SiteHeader } from "@/components/site/site-header";
import { getPublishedPostBySlug } from "@/lib/backend";

export const dynamic = "force-dynamic";

type SupportGuideDetailPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: SupportGuideDetailPageProps): Promise<Metadata> {
  const post = await getPublishedPostBySlug((await params).slug);
  return post?.type === "guide"
    ? { title: `${post.seoTitle ?? post.title} | iOrder`, description: post.seoDescription ?? post.excerpt ?? undefined, alternates: post.canonicalUrl ? { canonical: post.canonicalUrl } : undefined }
    : { title: "Không tìm thấy hướng dẫn | iOrder" };
}

export default async function SupportGuideDetailPage({ params }: SupportGuideDetailPageProps) {
  const post = await getPublishedPostBySlug((await params).slug);
  if (!post || post.type !== "guide") notFound();

  return (
    <>
      <SiteHeader />
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
