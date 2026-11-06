import { heroToneOf, type PageBlock } from "./pages.contract";

// Bố cục chung của các khối trang: một quy luật cho nền, khoảng cách và mã neo, để trang ghép từ
// nhiều khối vẫn có nhịp đều (website vẽ theo kết quả này, CMS chỉ chọn "Tự động" hoặc ghi đè).
export type SectionSurface = "white" | "tinted" | "dark";
export type SectionSpacing = "sm" | "md" | "lg";
// Nền riêng của khối: màu tự chọn và/hoặc ảnh nền (mediaId; website điền imageUrl) phủ lớp màu overlay %.
export type BlockBackground = { color: string | null; mediaId: string | null; overlay: number; imageUrl?: string | null };
// `tone` luôn là sắc thái chữ của khối (dark = chữ trắng), kể cả khi khối có nền riêng; `width`: % độ rộng nội dung.
export type BlockFrame = { tone: SectionSurface; spacing: SectionSpacing; anchor: string | null; width?: number | null; background?: BlockBackground | null };

// Độ sáng tương đối (WCAG) của màu #rrggbb.
function luminance(hex: string) {
  const channel = (index: number) => {
    const value = Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}
const inkLuminance = luminance("#0d1b33");
/** Màu nền tối (chữ trắng tương phản tốt hơn chữ đậm của website). */
export function isDarkColor(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return false;
  const value = luminance(hex);
  return 1.05 / (value + 0.05) > (value + 0.05) / (inkLuminance + 0.05);
}

// Khối mang sẵn nền riêng khi để "Tự động" (số liệu nổi bật là dải nền tối).
const fixedTone: Partial<Record<PageBlock["type"], SectionSurface>> = { stats: "dark" };
// Nền tối chỉ hợp với khối mà nội dung nằm trong thẻ trắng hoặc chữ đã có màu cho nền tối;
// khối chữ dài, biểu mẫu đặt trên nền tối sẽ khó đọc nên "Tối" được đổi thành xanh nhạt (ảnh + chữ và quy trình đã có màu chữ cho nền tối).
const darkCapable = new Set<PageBlock["type"]>(["stats", "cta", "media_text", "process", "features", "industries", "ecosystem", "testimonials", "faq", "pricing", "grouped_list", "collection_list", "featured_posts", "download_list", "partners", "video"]);
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
 * Màu tự chọn: màu tối → chữ trắng (như nền "Tối"), màu sáng → chữ đậm; khối không hợp nền tối mà chọn màu tối
 * thì về xanh nhạt như quy tắc của nền "Tối".
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
    const appearance = block.appearance;
    const chosen = appearance?.tone;
    const custom = chosen === "custom" && appearance?.backgroundColor ? appearance.backgroundColor : null;
    const picked: SectionSurface = custom ? (isDarkColor(custom) ? "dark" : "white")
      : chosen && chosen !== "auto" && chosen !== "custom" ? chosen : legacyTone(block) ?? fixedTone[block.type] ?? (last === "white" ? "tinted" : "white");
    const tone = picked === "dark" && !darkCapable.has(block.type) ? "tinted" : picked;
    last = tone;
    const spacing = appearance?.spacing && appearance.spacing !== "auto" ? appearance.spacing : defaultSpacing(block);
    const color = custom && !(picked === "dark" && tone !== "dark") ? custom : null;
    const mediaId = appearance?.backgroundMediaId ?? null;
    const background = color || mediaId ? { color, mediaId, overlay: appearance?.backgroundOverlay ?? 80 } : null;
    return { tone, spacing, anchor, width: appearance?.width ?? null, background };
  });
}
