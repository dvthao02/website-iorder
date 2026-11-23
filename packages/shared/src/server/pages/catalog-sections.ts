import type { z } from "zod";

import type { OfferingContent } from "../offerings/offering-content.contract";
import { pageBlockInputSchema, type ListingPageSlug } from "./pages.contract";

type BlockInput = z.input<typeof pageBlockInputSchema>;

/**
 * Trang danh sách "cha" có mục con (Phần mềm, Giải pháp): nội dung trang cha sinh từ chính các mục con, không viết tay theo chủ đề.
 * Mỗi mục con (một phần mềm, một giải pháp) có MỘT phần hoàn chỉnh, ngang hàng nhau và cùng cấu trúc: chuyên mục, tên, mô tả,
 * đối tượng phù hợp, lợi ích, các tính năng chính, ảnh bìa và nút sang trang con. Chi tiết đầy đủ (bảng giá, hỏi đáp, phần liên quan…)
 * nằm ở trang con. Cuối trang là hỏi đáp gộp từ câu hỏi của từng mục con, mỗi câu ghi rõ thuộc mục nào.
 *
 * Chữ lấy nguyên từ dữ liệu mục con (CMS › Sản phẩm) nên không thêm giá, số liệu hay cam kết nào ngoài những gì mục đó đã nêu.
 * Kết quả là khối trang bình thường: sửa, tắt, sắp xếp lại hoặc xóa được trong CMS › Trang website.
 * Không có khối kêu gọi (cta, lead_form): website tự thêm dải tư vấn cuối trang khi trang chưa có (apps/website/src/app/(web)/[catalog]/page.tsx).
 */
export const catalogListingTypes = { "listing-software": "software", "listing-solution": "solution" } as const satisfies Partial<Record<ListingPageSlug, string>>;
export type CatalogListingSlug = keyof typeof catalogListingTypes;
export type CatalogType = (typeof catalogListingTypes)[CatalogListingSlug];

/** Đường dẫn công khai của từng loại (khớp offeringPath ở website). */
export const catalogPaths: Record<CatalogType, string> = { software: "/software", solution: "/solutions" };

/** Phần của một mục con cần để dựng trang cha. */
export type CatalogChild = {
  type: CatalogType;
  title: string;
  slug: string;
  coverMediaId: string | null;
  content: Pick<OfferingContent, "description" | "category" | "bestFor" | "features" | "benefits" | "faq"> & { pricing?: unknown };
};

const lowerFirst = (text: string) => text.charAt(0).toLocaleLowerCase("vi") + text.slice(1);
const withoutTrailingStop = (text: string) => text.trim().replace(/[.。]+$/, "");

function anchorFor(slug: string) {
  return slug.slice(0, 60).replace(/-+$/, "");
}

/** Mô tả của một mục: mô tả gốc, rồi "Phù hợp với" và "Lợi ích" (nếu mục có) trên các dòng riêng. */
export function catalogChildDescription(child: CatalogChild) {
  const { description, bestFor, benefits } = child.content;
  const parts = [description.trim()];
  if (bestFor) parts.push(`Phù hợp với: ${lowerFirst(withoutTrailingStop(bestFor))}.`);
  if (benefits.length) parts.push(`Lợi ích: ${benefits.map(benefit => lowerFirst(withoutTrailingStop(benefit))).join(", ")}.`);
  return parts.filter(Boolean).join("\n\n");
}

/**
 * Các phần xếp sau khối danh sách: mỗi mục con một khối "Ảnh + chữ" (ảnh xen kẽ phải/trái), rồi hỏi đáp gộp.
 * `children` đã lọc (đã xuất bản) và đã sắp xếp như thứ tự hiển thị trong danh sách.
 */
export function buildCatalogSections(children: ReadonlyArray<CatalogChild>): BlockInput[] {
  const blocks: BlockInput[] = children.map((child, index) => {
    const path = `${catalogPaths[child.type]}/${child.slug}`;
    return {
      type: "media_text", isEnabled: true, appearance: { anchor: anchorFor(child.slug) },
      data: {
        layout: index % 2 === 0 ? "image_right" : "image_left",
        tone: "light",
        eyebrow: child.content.category,
        title: child.title,
        description: catalogChildDescription(child),
        bullets: child.content.features.slice(0, 8),
        mediaId: child.coverMediaId,
        extraMediaIds: [],
        primaryAction: { label: "Xem chi tiết", href: path },
        secondaryAction: child.content.pricing ? { label: "Xem bảng giá", href: `${path}#bang-gia` } : null,
      },
    } satisfies BlockInput;
  });

  const faq = children.flatMap(child => child.content.faq.map(([question, answer]) => ({ question: `${child.title} – ${question}`, answer })));
  if (faq.length) {
    blocks.push({ type: "faq", isEnabled: true, appearance: { anchor: "hoi-dap" }, data: { eyebrow: "Hỏi đáp", title: "Câu hỏi thường gặp", items: faq.slice(0, 40) } });
  }
  return blocks;
}
