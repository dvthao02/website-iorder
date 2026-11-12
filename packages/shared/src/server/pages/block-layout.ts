import { isDarkColor, type BlockAppearance } from "../shared/appearance";
import { heroToneOf, type PageBlock } from "./pages.contract";

export { isDarkColor } from "../shared/appearance";

// Bố cục chung của các khối trang: một quy luật cho nền, khoảng cách và mã neo, để trang ghép từ
// nhiều khối vẫn có nhịp đều (website vẽ theo kết quả này, CMS chỉ chọn "Tự động" hoặc ghi đè).
export type SectionSurface = "white" | "tinted" | "dark";
export type SectionSpacing = "sm" | "md" | "lg";
// Nền riêng của khối: màu tự chọn và/hoặc ảnh nền (mediaId; website điền imageUrl) phủ lớp màu overlay %.
export type BlockBackground = { color: string | null; mediaId: string | null; overlay: number; imageUrl?: string | null };
// `tone` luôn là sắc thái chữ của khối (dark = chữ trắng), kể cả khi khối có nền riêng; `width`: % độ rộng nội dung.
export type BlockFrame = { tone: SectionSurface; spacing: SectionSpacing; anchor: string | null; width?: number | null; background?: BlockBackground | null };

// Khối mang sẵn nền riêng khi để "Tự động" (số liệu nổi bật là dải nền tối).
const fixedTone: Partial<Record<PageBlock["type"], SectionSurface>> = { stats: "dark" };
// Nền tối chỉ hợp với khối mà nội dung nằm trong thẻ trắng hoặc chữ đã có màu cho nền tối;
// khối chữ dài, biểu mẫu đặt trên nền tối sẽ khó đọc nên "Tối" được đổi thành xanh nhạt (ảnh + chữ và quy trình đã có màu chữ cho nền tối).
const darkCapable = new Set<PageBlock["type"]>(["hero", "stats", "cta", "media_text", "process", "features", "industries", "ecosystem", "testimonials", "faq", "pricing", "grouped_list", "collection_list", "featured_posts", "download_list", "partners", "video"]);
export function blockSupportsDarkTone(type: PageBlock["type"]) { return darkCapable.has(type); }

// Dải mỏng (logo, ảnh đơn) và danh sách nằm ngay dưới phần đầu trang danh sách (không tiêu đề) dùng khoảng cách gọn.
function defaultSpacing(block: PageBlock): SectionSpacing {
  if (block.type === "partners" || block.type === "image" || block.type === "cta") return "sm";
  if (block.type === "collection_list" && !block.data.title) return "sm";
  return "md";
}

/** Chỉ dùng nhịp toàn màn hình cho khoảng cách Tự động; lựa chọn cụ thể từ CMS được ưu tiên. */
export function blockUsesScreenHeight(block: PageBlock, screens: boolean) {
  return screens && block.type !== "hero" && (!block.appearance?.spacing || block.appearance.spacing === "auto") && defaultSpacing(block) !== "sm";
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
 * Khung của một phần trang từ vỏ chung (dùng cho khối trang và các phần cố định như trang sản phẩm).
 * `fallback`: nền khi để "Tự động". Màu tự chọn: màu tối → chữ trắng (như nền "Tối"), màu sáng → chữ đậm;
 * phần không hợp nền tối (`darkAllowed` = false) mà chọn nền/màu tối thì về xanh nhạt.
 */
export function sectionFrame(appearance: Partial<BlockAppearance> | null | undefined, options: { fallback: SectionSurface; darkAllowed: boolean; spacing: SectionSpacing; anchor?: string | null }): BlockFrame {
  const chosen = appearance?.tone;
  const custom = chosen === "custom" && appearance?.backgroundColor ? appearance.backgroundColor : null;
  const picked: SectionSurface = custom ? (isDarkColor(custom) ? "dark" : "white") : chosen && chosen !== "auto" && chosen !== "custom" ? chosen : options.fallback;
  const tone = picked === "dark" && !options.darkAllowed ? "tinted" : picked;
  const color = custom && !(picked === "dark" && tone !== "dark") ? custom : null;
  const mediaId = appearance?.backgroundMediaId ?? null;
  return {
    tone,
    spacing: appearance?.spacing && appearance.spacing !== "auto" ? appearance.spacing : options.spacing,
    anchor: options.anchor ?? appearance?.anchor ?? null,
    width: appearance?.width ?? null,
    background: color || mediaId ? { color, mediaId, overlay: appearance?.backgroundOverlay ?? 80 } : null,
  };
}

/**
 * Nền và khoảng cách của từng khối theo thứ tự trên trang. Nền "Tự động" luôn khác khối ngay trước
 * (trắng ↔ xanh nhạt), nên hai phần liền nhau không dính vào nhau dù người vận hành không chọn gì.
 * `previous`: nền của phần nằm ngay trên khối đầu tiên (ví dụ phần đầu trang danh sách).
 * Phần đầu trang: nền theo ô "Nền" của chính nó, trừ khi chọn màu tự chọn ở vỏ chung.
 */
export function resolveBlockFrames(blocks: readonly PageBlock[], previous: SectionSurface | null = null): BlockFrame[] {
  let last = previous;
  return blocks.map((block) => {
    const anchor = blockAnchor(block);
    let fallback: SectionSurface;
    if (block.type === "hero") {
      const tone = heroToneOf(block.data);
      fallback = tone === "light" ? "white" : tone;
    } else fallback = legacyTone(block) ?? fixedTone[block.type] ?? (last === "white" ? "tinted" : "white");
    // Nền của phần đầu trang chọn trong dữ liệu khối; vỏ chung chỉ ghi đè bằng màu tự chọn.
    const appearance = block.type === "hero" && block.appearance?.tone !== "custom" ? { ...block.appearance, tone: "auto" as const } : block.appearance;
    const frame = sectionFrame(appearance, { fallback, darkAllowed: darkCapable.has(block.type), spacing: block.type === "hero" ? "md" : defaultSpacing(block), anchor });
    last = frame.tone;
    return frame;
  });
}
