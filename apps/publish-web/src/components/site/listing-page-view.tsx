import { blockAnchor } from "@iorder/core/server/pages/block-layout";
import { SiteHeader } from "@/components/site/site-header";
import { PageBlockRenderer } from "@/components/site/page-block-renderer";
import type { ListingPageContent } from "@/lib/listing-page";
import { Container, SectionHeading } from "@/components/ui";

// Khung chung của mọi trang danh sách: phần đầu trang + các khối theo thứ tự CMS.
// Khi trang có từ hai khối danh sách gắn anchor, hiện thanh chuyển nhanh giữa các phần.
export function ListingPageView({ content }: { content: ListingPageContent }) {
  const { header, blocks } = content;
  const sections = blocks.flatMap(block => { const anchor = blockAnchor(block); return block.isEnabled && block.type === "collection_list" && anchor && block.data.title ? [{ anchor, title: block.data.title }] : []; });
  return <>
    <SiteHeader />
    <main id="noi-dung" className="pb-12">
      <header><Container className="pt-16 sm:pt-24">
        <SectionHeading description={header.description} eyebrow={header.eyebrow} level="h1" size="lg" title={header.title} />
        {sections.length > 1 ? <nav aria-label="Các phần trong trang" className="mx-auto mt-8 flex w-fit flex-wrap items-center justify-center gap-1 rounded-full border border-line bg-white p-1 shadow-card">
          {sections.map(section => <a className="rounded-full px-4 py-2 text-small font-semibold text-muted transition hover:bg-brand-50 hover:text-brand-700" href={`#${section.anchor}`} key={section.anchor}>{section.title}</a>)}
        </nav> : null}
      </Container></header>
      {/* Phần đầu trang danh sách nằm trên nền trang (gần như xanh nhạt): khối đầu tiên nối liền với nó. */}
      <PageBlockRenderer blocks={blocks} previous="white" />
    </main>
  </>;
}
