import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/site/site-header";
import { getPublishedPostSummaries } from "@/lib/backend";
import { getEnabledSupportDownloads } from "@/lib/backend";
import { getListingContent } from "@/lib/backend";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> { const content = await getListingContent(); return content ? { title: content.support.title, description: content.support.description ?? undefined } : {}; }

const vietnameseDateFormatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

export default async function SupportInstallationPage() {
  const [downloads, guides, content] = await Promise.all([getEnabledSupportDownloads(), getPublishedPostSummaries("guide"), getListingContent()]);
  if (!content) return <><SiteHeader /><main className="mx-auto max-w-4xl p-6">Nội dung trang hỗ trợ đang chờ được cấu hình trong CMS.</main></>;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
        <header className="max-w-3xl">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-blue-700">{content.support.eyebrow}</p>
          <h1 className="mb-5 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-6xl">{content.support.title}</h1>
          {content.support.description ? <p className="text-lg leading-8 text-slate-600">{content.support.description}</p> : null}
        </header>

        <nav aria-label="Nội dung hỗ trợ cài đặt" className="mt-8 flex w-fit items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <a className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white" href="#tep-cai-dat">Tệp cài đặt</a>
          <a className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-100" href="#huong-dan">Hướng dẫn sử dụng</a>
        </nav>

        <section className="mt-12" id="tep-cai-dat">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-950">Tệp cài đặt</h2>
          {downloads.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">
              Hiện chưa có tệp hỗ trợ nào. Nội dung sẽ xuất hiện tại đây khi được bật trong CMS.
            </div>
          ) : (
            <div className="mt-5 grid gap-4" aria-label="Tệp hỗ trợ để tải xuống">
              {downloads.map((download) => (
                <article className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between" key={download.id}>
                  <div>
                    <p className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-blue-700">Tệp hỗ trợ</p>
                    <h3 className="mb-2 text-xl font-extrabold tracking-tight text-slate-900">{download.title}</h3>
                    {download.description ? <p className="leading-7 text-slate-600">{download.description}</p> : null}
                    {download.meta ? <p className="mt-3 text-sm font-medium text-slate-500">{download.meta}</p> : null}
                  </div>
                  <a className="button button--primary shrink-0" download href={download.downloadUrl}>Tải xuống</a>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-14 scroll-mt-6" id="huong-dan">
          <div className="max-w-3xl"><p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">{content.guides.eyebrow}</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">{content.guides.title}</h2>{content.guides.description ? <p className="mt-2 leading-7 text-slate-600">{content.guides.description}</p> : null}</div>
          {guides.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">Chưa có bài viết hướng dẫn nào được xuất bản.</div>
          ) : (
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {guides.map((guide) => (
                <Link className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-md" href={`/ho-tro/cai-dat/${guide.slug}`} key={guide.id}>
                  <p className="mb-5 text-sm font-bold text-blue-700">{guide.categories[0]?.name ?? "Hướng dẫn iOrder"}</p>
                  <h3 className="mb-3 text-xl font-extrabold tracking-tight text-slate-900">{guide.title}</h3>
                  {guide.excerpt ? <p className="leading-7 text-slate-600">{guide.excerpt}</p> : null}
                  <p className="mt-6 text-sm font-medium text-slate-500">{vietnameseDateFormatter.format(guide.publishedAt ?? guide.createdAt)}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
