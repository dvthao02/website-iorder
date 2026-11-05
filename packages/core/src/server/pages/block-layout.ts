import { heroToneOf, type PageBlock } from "./pages.contract";

// Bố cục chung của các khối trang: một quy luật cho nền, khoảng cách và mã neo, để trang ghép từ
// nhiều khối vẫn có nhịp đều (website vẽ theo kết quả này, CMS chỉ chọn "Tự động" hoặc ghi đè).
export type SectionSurface = "white" | "tinted" | "dark";
export type SectionSpacing = "sm" | "md" | "lg";
export type BlockFrame = { tone: SectionSurface; spacing: SectionSpacing; anchor: string | null };

// Khối mang sẵn nền riêng khi để "Tự động" (số liệu nổi bật là dải nền tối).
const fixedTone: Partial<Record<PageBlock["type"], SectionSurface>> = { stats: "dark" };
// Nền tối chỉ hợp với khối mà nội dung nằm trong thẻ trắng hoặc chữ đã có màu cho nền tối;
// khối chữ dài, biểu mẫu đặt trên nền tối sẽ khó đọc nên "Tối" được đổi thành xanh nhạt (ảnh + chữ và quy trình đã có màu chữ cho nền tối).
const darkCapable = new Set<PageBlock["type"]>(["stats", "cta", "media_text", "process", "features", "industries", "ecosystem", "testimonials", "faq", "pricing", "grouped_list", "collection_list", "featured_posts", "download_list", "partners"]);
export function blockSupportsDarkTone(type: PageBlock["type"]) { return darkCapable.has(type); }

// Dải mỏng (logo, ảnh đơn) và danh sách nằm ngay dưới phần đầu trang danh sách (không tiêu đề) dùng khoảng cách gọn.
function defaultSpacing(block: PageBlock): SectionSpacing {
  if (block.type === "partners" || block.type === "image" || block.type === "cta") return "sm";
  if (block.type === "collection_list" && !block.data.title) return "sm";
  return "md";
}

/** Mã neo của khối: vỏ chung trước, rồi trường cũ của "Kêu gọi hành động" và "Danh sách nội dung". */
export function blockAnchor(block: PageBlock): string | null {
  if (block.appearance?.anchor) return block.appearance.anchor;
  if (block.type === "cta") return block.data.id;
  if (block.type === "collection_list") return block.data.anchor;
  return null;
}

// "Ảnh + chữ" cũ có ô chọn nền riêng: "xanh nhạt" vẫn được tôn trọng, "trắng" (mặc định) coi như tự động.
function legacyTone(block: PageBlock): SectionSurface | null {
  return block.type === "media_text" && block.data.tone === "tinted" ? "tinted" : null;
}

/**
 * Nền và khoảng cách của từng khối theo thứ tự trên trang. Nền "Tự động" luôn khác khối ngay trước
 * (trắng ↔ xanh nhạt), nên hai phần liền nhau không dính vào nhau dù người vận hành không chọn gì.
 * `previous`: nền của phần nằm ngay trên khối đầu tiên (ví dụ phần đầu trang danh sách).
 */
export function resolveBlockFrames(blocks: readonly PageBlock[], previous: SectionSurface | null = null): BlockFrame[] {
  let last = previous;
  return blocks.map((block) => {
    const anchor = blockAnchor(block);
    if (block.type === "hero") {
      const tone = heroToneOf(block.data);
      last = tone === "light" ? "white" : tone;
      return { tone: last, spacing: "md", anchor };
    }
    const chosen = block.appearance?.tone;
    const picked = chosen && chosen !== "auto" ? chosen : legacyTone(block) ?? fixedTone[block.type] ?? (last === "white" ? "tinted" : "white");
    const tone = picked === "dark" && !darkCapable.has(block.type) ? "tinted" : picked;
    last = tone;
    const spacing = block.appearance?.spacing && block.appearance.spacing !== "auto" ? block.appearance.spacing : defaultSpacing(block);
    return { tone, spacing, anchor };
  });
}
