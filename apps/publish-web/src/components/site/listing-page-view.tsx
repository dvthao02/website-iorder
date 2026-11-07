import { blockAnchor } from "@iorder/core/server/pages/block-layout";
import { PageHero, type Crumb } from "@/components/site/page-hero";
import { SiteHeader } from "@/components/site/site-header";
import { PageBlockRenderer } from "@/components/site/page-block-renderer";
import type { ListingPageContent } from "@/lib/listing-page";

// Khung chung của mọi trang danh sách (/tin-tuc, /thiet-bi, /ho-tro/huong-dan, /phan-mem…): phần đầu trang con gọn
// (PageHero: đường dẫn, nhãn, tiêu đề căn trái, mô tả) rồi các khối theo thứ tự CMS.
// `crumb`: tên ngắn của trang trên đường dẫn (ví dụ "Tin tức"), tiêu đề đầy đủ vẫn lấy từ CMS.
// Khi trang có từ hai khối danh sách gắn anchor, hiện thanh chuyển nhanh giữa các phần.
export function ListingPageView({ content, crumb }: { content: ListingPageContent; crumb: Crumb }) {
  const { header, blocks } = content;
  const sections = blocks.flatMap(block => { const anchor = blockAnchor(block); return block.isEnabled && block.type === "collection_list" && anchor && block.data.title ? [{ anchor, title: block.data.title }] : []; });
  return <>
    <SiteHeader />
    <main id="noi-dung" className="pb-12">
      <PageHero crumbs={[crumb]} description={header.description} eyebrow={header.eyebrow} title={header.title}>
        {sections.length > 1 ? <nav aria-label="Các phần trong trang" className="mt-7 flex w-fit max-w-full flex-wrap items-center gap-1 rounded-full border border-line bg-white p-1 shadow-card">
          {sections.map(section => <a className="rounded-full px-4 py-2 text-small font-semibold text-muted transition hover:bg-brand-50 hover:text-brand-700" href={`#${section.anchor}`} key={section.anchor}>{section.title}</a>)}
        </nav> : null}
      </PageHero>
      {/* Dải phần đầu kết thúc nền trắng: khối đầu tiên tự xen kẽ sang nền xanh nhạt. */}
      <PageBlockRenderer blocks={blocks} previous="white" />
    </main>
  </>;
}
