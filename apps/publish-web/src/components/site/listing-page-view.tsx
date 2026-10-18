import { SiteHeader } from "@/components/site/site-header";
import { PageBlockRenderer } from "@/components/site/page-block-renderer";
import type { ListingPageContent } from "@/lib/listing-page";

// Khung chung của mọi trang danh sách: phần đầu trang + các khối theo thứ tự CMS.
// Khi trang có từ hai khối danh sách gắn anchor, hiện thanh chuyển nhanh giữa các phần.
export function ListingPageView({ content }: { content: ListingPageContent }) {
  const { header, blocks } = content;
  const sections = blocks.flatMap(block => block.type === "collection_list" && block.data.anchor && block.data.title ? [{ anchor: block.data.anchor, title: block.data.title }] : []);
  return <>
    <SiteHeader />
    <main className="pb-12">
      <header className="mx-auto max-w-6xl px-6 pt-16 sm:pt-24">
        <div className="max-w-3xl">
          {header.eyebrow ? <p className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-blue-700">{header.eyebrow}</p> : null}
          <h1 className="mb-5 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-6xl">{header.title}</h1>
          {header.description ? <p className="text-lg leading-8 text-slate-600">{header.description}</p> : null}
        </div>
        {sections.length > 1 ? <nav aria-label="Các phần trong trang" className="mt-8 flex w-fit flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {sections.map(section => <a className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-100" href={`#${section.anchor}`} key={section.anchor}>{section.title}</a>)}
        </nav> : null}
      </header>
      <PageBlockRenderer blocks={blocks} />
    </main>
  </>;
}
