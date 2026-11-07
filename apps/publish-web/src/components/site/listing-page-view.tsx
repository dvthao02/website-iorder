import { ChevronRight } from "lucide-react";

import { blockAnchor } from "@iorder/core/server/pages/block-layout";
import { JsonLd } from "@/components/site/json-ld";
import { SiteHeader } from "@/components/site/site-header";
import { SiteLink as Link } from "@/components/site/site-link";
import { PageBlockRenderer } from "@/components/site/page-block-renderer";
import { getPublishingConfig } from "@/lib/backend";
import type { ListingPageContent } from "@/lib/listing-page";
import { breadcrumbJsonLd } from "@/lib/structured-data";
import { Container } from "@/components/ui";

// Khung chung của mọi trang danh sách (/tin-tuc, /thiet-bi, /ho-tro/huong-dan, /phan-mem…): phần đầu trang con
// gọn — đường dẫn (breadcrumb, kèm dữ liệu cấu trúc cho Google), nhãn, tiêu đề căn trái cỡ vừa, mô tả — trên dải nền
// riêng có viền dưới, rồi các khối theo thứ tự CMS. Trang là nơi tra cứu nên tiêu đề không dùng cỡ lớn như trang chủ.
// `crumb`: tên ngắn của trang trên đường dẫn (ví dụ "Tin tức"), tiêu đề đầy đủ vẫn lấy từ CMS.
// Khi trang có từ hai khối danh sách gắn anchor, hiện thanh chuyển nhanh giữa các phần.
export async function ListingPageView({ content, crumb }: { content: ListingPageContent; crumb: { name: string; path: string } }) {
  const { header, blocks } = content;
  const sections = blocks.flatMap(block => { const anchor = blockAnchor(block); return block.isEnabled && block.type === "collection_list" && anchor && block.data.title ? [{ anchor, title: block.data.title }] : []; });
  const site = (await getPublishingConfig()).siteUrl;
  return <>
    <SiteHeader />
    {site ? <JsonLd data={[breadcrumbJsonLd(site, [{ name: "Trang chủ", path: "/" }, crumb])]} /> : null}
    <main id="noi-dung" className="pb-12">
      <header className="listing-hero">
        <Container className="py-8 sm:py-11">
          <nav aria-label="Đường dẫn">
            <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0 text-small text-muted">
              <li><Link className="transition hover:text-brand-700" href="/">Trang chủ</Link></li>
              <li aria-hidden="true"><ChevronRight size={14} /></li>
              <li aria-current="page" className="font-semibold text-ink">{crumb.name}</li>
            </ol>
          </nav>
          <div className="mt-5 max-w-3xl sm:mt-6">
            {header.eyebrow ? <p className="mb-3 inline-flex w-fit items-center rounded-full bg-brand-50 px-3 py-1 text-small font-semibold text-brand-700">{header.eyebrow}</p> : null}
            <h1 className="mb-0 text-[2rem] leading-[1.15] font-bold tracking-tight text-balance text-ink sm:text-[2.5rem] xl:text-[2.75rem]">{header.title}</h1>
            {header.description ? <p className="mt-3 mb-0 text-lead whitespace-pre-line text-muted">{header.description}</p> : null}
          </div>
          {sections.length > 1 ? <nav aria-label="Các phần trong trang" className="mt-7 flex w-fit max-w-full flex-wrap items-center gap-1 rounded-full border border-line bg-white p-1 shadow-card">
            {sections.map(section => <a className="rounded-full px-4 py-2 text-small font-semibold text-muted transition hover:bg-brand-50 hover:text-brand-700" href={`#${section.anchor}`} key={section.anchor}>{section.title}</a>)}
          </nav> : null}
        </Container>
      </header>
      {/* Dải phần đầu kết thúc nền trắng: khối đầu tiên tự xen kẽ sang nền xanh nhạt. */}
      <PageBlockRenderer blocks={blocks} previous="white" />
    </main>
  </>;
}
