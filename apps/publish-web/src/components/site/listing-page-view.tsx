import type { ReactNode } from "react";
import { blockAnchor } from "@iorder/core/server/pages/block-layout";
import { type Crumb } from "@/components/site/page-hero";
import { ListingPageHeader, listingHeaderSurface } from "./listing-page-header";
import { SiteHeader } from "@/components/site/site-header";
import { PageBlockRenderer } from "@/components/site/page-block-renderer";
import type { ListingPageContent } from "@/lib/listing-page";

// Khung trang danh sách: phần đầu dùng nguyên hero CMS, rồi các khối theo thứ tự; thiếu hero mới dùng mẫu gọn.
// `crumb`: tên ngắn của trang trên đường dẫn (ví dụ "Tin tức"), tiêu đề đầy đủ vẫn lấy từ CMS.
// Khi trang có từ hai khối danh sách gắn anchor, hiện thanh chuyển nhanh giữa các phần.
// `closing`: phần kết cuối trang (ví dụ dải tư vấn) — có thì bỏ khoảng trắng đệm dưới cùng để dải sát chân trang.
export function ListingPageView({ content, crumb, closing = null }: { content: ListingPageContent; crumb: Crumb; closing?: ReactNode }) {
  const { header, blocks, hero } = content;
  const sections = blocks.flatMap(block => { const anchor = blockAnchor(block); return block.isEnabled && block.type === "collection_list" && anchor && block.data.title ? [{ anchor, title: block.data.title }] : []; });
  return <>
    <SiteHeader />
    <main id="noi-dung" className={closing ? undefined : "pb-12"}>
      <ListingPageHeader crumbs={[crumb]} header={header} hero={hero}>
        {sections.length > 1 ? <nav aria-label="Các phần trong trang" className="mt-7 flex w-fit max-w-full flex-wrap items-center gap-1 rounded-full border border-line bg-white p-1 shadow-card">
          {sections.map(section => <a className="rounded-full px-4 py-2 text-small font-semibold text-muted transition hover:bg-brand-50 hover:text-brand-700" href={`#${section.anchor}`} key={section.anchor}>{section.title}</a>)}
        </nav> : null}
      </ListingPageHeader>
      {/* Các khối tiếp theo kế thừa nhịp nền từ hero đã chọn. */}
      <PageBlockRenderer blocks={blocks} previous={listingHeaderSurface(hero)} />
      {closing}
    </main>
  </>;
}
