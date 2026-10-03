import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

import { SiteHeader } from "@/components/site/site-header";
import { getPublishedPostSummaries } from "@/lib/backend";
import { getListingContent } from "@/lib/backend";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> { const content = await getListingContent(); return content ? { title: content.news.title, description: content.news.description ?? undefined } : {}; }

const postTypeLabel = {
  announcement: "Thông báo",
  case_study: "Câu chuyện khách hàng",
  guide: "Hướng dẫn",
  news: "Tin tức",
  promotion: "Khuyến mãi",
} as const;

const vietnameseDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export default async function NewsPage() {
  const [posts, content] = await Promise.all([getPublishedPostSummaries(), getListingContent()]);
  if (!content) return <><SiteHeader /><main className="mx-auto max-w-6xl p-6">Nội dung trang tin tức đang chờ được cấu hình trong CMS.</main></>;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <header className="max-w-3xl">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-blue-700">{content.news.eyebrow}</p>
          <h1 className="mb-5 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-6xl">{content.news.title}</h1>
          {content.news.description ? <p className="text-lg leading-8 text-slate-600">{content.news.description}</p> : null}
        </header>

        {posts.length === 0 ? (
          <section className="mt-12 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">
            Chưa có bài viết nào được xuất bản. Nội dung sẽ xuất hiện tại đây sau khi được duyệt và publish trong CMS.
          </section>
        ) : (
          <section className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Danh sách bài viết">
            {posts.map((post) => (
              <Link className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-md" href={`/tin-tuc/${post.slug}`} key={post.id}>
                <p className="mb-7 text-sm font-bold text-blue-700">{postTypeLabel[post.type]}</p>
                <h2 className="mb-3 text-xl font-extrabold tracking-tight text-slate-900">{post.title}</h2>
                {post.cover ? <Image src={post.cover.url} alt={post.cover.altText ?? post.title} width={600} height={338} className="mb-4 h-auto w-full rounded-lg" /> : null}
                {post.excerpt ? <p className="leading-7 text-slate-600">{post.excerpt}</p> : null}
                <p className="mt-6 text-sm font-medium text-slate-500">
                  {vietnameseDateFormatter.format(post.publishedAt ?? post.createdAt)}
                </p>
              </Link>
            ))}
          </section>
        )}
      </main>
    </>
  );
}
