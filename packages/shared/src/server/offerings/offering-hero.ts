import { blockAppearanceSchema } from "../shared/appearance";
import { pageBlockInputSchema, type PageBlock } from "../pages/pages.contract";
import type { OfferingContent } from "./offering-content.contract";

type HeroSource = {
  title: string;
  summary: string | null;
  coverMediaId: string | null;
  content: Pick<OfferingContent, "category" | "bestFor" | "keyValue" | "appearance"> & { blocks?: PageBlock[]; pricing?: unknown };
};

const clip = (value: string, limit: number) => value.length > limit ? `${value.slice(0, limit - 1).trimEnd()}…` : value;

export const isOfferingHeroBlock = (block: PageBlock | undefined): block is Extract<PageBlock, { type: "hero" }> => block?.type === "hero";

// Phần đầu trang của sản phẩm/giải pháp/dịch vụ dưới dạng thành phần "Phần đầu trang" (cùng loại với trang chủ: kiểu bố cục, nhiều ảnh, nút bấm…).
// Dựng từ các trường cố định trước đây: tên → tiêu đề, tóm tắt → mô tả, ảnh bìa + ảnh trượt thêm → ảnh, nhãn nhóm → dòng nhỏ phía trên,
// "Phù hợp với"/"Giá trị nổi bật" → hai ý nổi bật, nút Nhận tư vấn (và Xem bảng giá nếu có bảng giá). Bố cục và nền giữ như đã chọn ở Bố cục khối.
export function offeringHeroBlock(source: HeroSource): Extract<PageBlock, { type: "hero" }> {
  const { content } = source;
  const layout = content.appearance?.hero;
  const hasPricing = Boolean(content.pricing) || Boolean(content.blocks?.some((block) => block.type === "pricing"));
  const highlights = [
    content.bestFor ? { title: "Phù hợp với", note: clip(content.bestFor, 160) } : null,
    content.keyValue ? { title: "Giá trị nổi bật", note: clip(content.keyValue, 160) } : null,
  ].filter((item) => item !== null);
  const block = pageBlockInputSchema.parse({
    type: "hero",
    isEnabled: true,
    ...(layout?.appearance ? { appearance: layout.appearance } : {}),
    data: {
      eyebrow: content.category ? clip(content.category, 160) : null,
      title: source.title,
      description: source.summary,
      primaryAction: { label: "Nhận tư vấn miễn phí", href: "/contact" },
      secondaryAction: hasPricing ? { label: "Xem bảng giá", href: "#bang-gia" } : null,
      mediaId: source.coverMediaId,
      layout: layout?.layout ?? "split",
      highlights,
      footnote: null,
      slides: [],
      extraMediaIds: layout?.extraMediaIds ?? [],
      tone: null,
      panels: [],
    },
  });
  if (!isOfferingHeroBlock(block)) throw new Error("Không dựng được thành phần Phần đầu trang.");
  return block;
}

// Thêm thành phần Phần đầu trang vào đầu danh sách thành phần (nếu chưa có). Nút "Xem bảng giá" cần phần bảng giá có mã neo `bang-gia`,
// nên bảng giá chưa có mã neo thì được gán mã đó.
export function withOfferingHero(blocks: PageBlock[], source: HeroSource): PageBlock[] {
  if (blocks.some(isOfferingHeroBlock)) return blocks;
  const withAnchors = blocks.map((block) => block.type === "pricing" && !block.appearance?.anchor
    ? { ...block, appearance: blockAppearanceSchema.parse({ ...block.appearance, anchor: "bang-gia" }) }
    : block);
  return [offeringHeroBlock({ ...source, content: { ...source.content, blocks } }), ...withAnchors];
}
