import type { Metadata, ResolvingMetadata } from "next";
import { ChevronRight } from "lucide-react";

import { headingId } from "@iorder/shared/server/shared/rich-text";
import { GuideDocsLayout } from "@/components/site/guide-docs";
import { iconFor } from "@/components/site/guide-icons";
import { PageBlockRenderer } from "@/components/site/page-block-renderer";
import { ListingPageHeader } from "@/components/site/listing-page-header";
import { SiteHeader } from "@/components/site/site-header";
import { SiteLink as Link } from "@/components/site/site-link";
import { SupportSearch } from "@/components/site/support-search";
import { getGuideIndex, guideDescription } from "@/lib/guides";
import { getListingPageContent, listingPageMetadata } from "@/lib/listing-page";

export const revalidate = 0;

export async function generateMetadata(_: unknown, parent: ResolvingMetadata): Promise<Metadata> { return listingPageMetadata(await getListingPageContent("listing-guides"), "/ho-tro/huong-dan", parent); }

// Trang tổng hợp hướng dẫn trong khung tài liệu: phần đầu (tiêu đề, mô tả từ CMS + ô tìm bài không dấu), danh mục nhóm
// bên trái, giữa là từng nhóm với thẻ bài (biểu tượng, tên, mô tả ngắn). Khối "Danh sách nội dung" nguồn Hướng dẫn của
// trang được thay bằng phần này; các khối khác (CTA, hỏi đáp…) vẫn hiện bên dưới theo thứ tự CMS.
export default async function SupportGuidesPage() {
  const [content, index] = await Promise.all([getListingPageContent("listing-guides"), getGuideIndex()]);
  const header = content?.header ?? { eyebrow: null, title: "Hướng dẫn sử dụng", description: null };
  const descriptions = new Map(await Promise.all(index.entries.map(async (entry) => [entry.href, await guideDescription(entry.summary)] as const)));
  const otherBlocks = (content?.blocks ?? []).filter((block) => !(block.type === "collection_list" && block.data.source === "guides"));
  const searchItems = index.entries.map((entry) => ({ title: entry.title, href: entry.href, kind: entry.category ?? "Hướng dẫn", text: descriptions.get(entry.href) ?? null }));

  return <>
    <SiteHeader />
    <main id="noi-dung">
      <ListingPageHeader hero={content?.hero} header={header} crumbs={[{ name: "Hỗ trợ", path: "/ho-tro" }, { name: "Hướng dẫn sử dụng", path: "/ho-tro/huong-dan" }]}>
        {searchItems.length ? <div className="mt-6 max-w-2xl"><SupportSearch items={searchItems} suggestions={[]} /></div> : null}
      </ListingPageHeader>
      {index.groups.length ? <GuideDocsLayout groups={index.groups}>
        <div className="grid gap-10">
          {index.groups.map((group) => {
            const id = `nhom-${headingId(group.label)}`;
            return <section aria-labelledby={id} key={group.key}>
              <h2 className="mb-4 text-h3 font-bold tracking-tight text-ink" id={id}>{group.label} <span className="guide-count">({group.items.length})</span></h2>
              <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">{group.items.map((item) => {
                const Icon = iconFor(item.title);
                const description = descriptions.get(item.href);
                return <li key={item.href}><Link className="guide-card group" href={item.href}>
                  <Icon aria-hidden="true" className="guide-card__icon" size={20} strokeWidth={1.7} />
                  <span className="min-w-0 flex-1">
                    <span className="guide-card__title block font-semibold text-ink group-hover:text-brand-700">{item.title}</span>
                    {description ? <span className="mt-1 line-clamp-2 text-small text-muted">{description}</span> : null}
                  </span>
                  <ChevronRight aria-hidden="true" className="shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-brand-600" size={18} />
                </Link></li>;
              })}</ul>
            </section>;
          })}
        </div>
      </GuideDocsLayout> : <p className="site-container py-12 text-muted">Chưa có bài viết hướng dẫn nào được xuất bản.</p>}
      {otherBlocks.length ? <PageBlockRenderer blocks={otherBlocks} previous="tinted" /> : null}
    </main>
  </>;
}
