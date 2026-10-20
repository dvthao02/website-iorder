// Gợi ý/tự động SEO dùng chung cho CMS (trợ lý SEO) và website (giá trị dự phòng khi để trống),
// để điều người biên tập thấy trong CMS đúng là điều Google nhận được.
import { richFirstParagraph, richPlainText, type RichDocument } from "./rich-text";

export const seoTitleLimit = 60;
export const seoDescriptionLimit = 155;

function collapse(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

/** Cắt ở ranh giới từ, thêm "…" khi bị cắt. */
export function truncateAtWord(text: string, limit: number) {
  const clean = collapse(text);
  if (clean.length <= limit) return clean;
  const slice = clean.slice(0, limit - 1);
  const lastSpace = slice.lastIndexOf(" ");
  return `${(lastSpace > limit * 0.6 ? slice.slice(0, lastSpace) : slice).replace(/[\s,.;:–-]+$/, "")}…`;
}

// Nội dung bài v1 (khối), v2 ({ version: 2, doc }) hoặc tài liệu soạn thảo trực tiếp.
export type PostLikeContent = { blocks: Array<{ type: string; text?: string; heading?: string; items?: string[] }> } | { version: 2; doc: RichDocument } | RichDocument;

function richOf(content: PostLikeContent | null | undefined): RichDocument | undefined {
  if (!content) return undefined;
  if ("doc" in content) return content.doc;
  if ("type" in content && content.type === "doc") return content;
  return undefined;
}

/** Chữ thuần của nội dung bài (đoạn văn + danh sách) để đếm từ và lấy đoạn mô tả. */
export function contentPlainText(content: PostLikeContent | null | undefined) {
  const rich = richOf(content);
  if (rich) return richPlainText(rich);
  if (!content || !("blocks" in content)) return "";
  return collapse((content.blocks).map((block) => block.type === "paragraph" ? block.text ?? "" : [block.heading ?? "", ...(block.items ?? [])].join(". ")).join(" "));
}

export function suggestSeoTitle(title: string) {
  return truncateAtWord(title, seoTitleLimit);
}

/** Mô tả: ưu tiên tóm tắt, sau đó đoạn văn đầu tiên; null khi không có chữ nào. */
export function suggestSeoDescription(excerpt: string | null | undefined, content?: PostLikeContent | null) {
  const rich = richOf(content);
  const firstParagraph = rich ? richFirstParagraph(rich) : content && "blocks" in content ? content.blocks.find((block) => block.type === "paragraph" && collapse(block.text ?? ""))?.text : undefined;
  const source = collapse(excerpt ?? "") || collapse(firstParagraph ?? "") || contentPlainText(content);
  return source ? truncateAtWord(source, seoDescriptionLimit) : null;
}

export type SeoCheck = { id: string; ok: boolean; message: string };

export function seoChecks(input: { title: string; seoTitle: string; seoDescription: string; excerpt: string; slug: string; hasCover: boolean; content?: PostLikeContent | null }): SeoCheck[] {
  const effectiveTitle = collapse(input.seoTitle) || collapse(input.title);
  const effectiveDescription = collapse(input.seoDescription) || suggestSeoDescription(input.excerpt, input.content) || "";
  const words = contentPlainText(input.content).split(" ").filter(Boolean).length;
  const slugWords = input.slug.split("-").filter(Boolean).length;
  return [
    { id: "title", ok: effectiveTitle.length >= 30 && effectiveTitle.length <= seoTitleLimit, message: effectiveTitle.length < 30 ? `Tiêu đề hiển thị trên Google ngắn (${effectiveTitle.length} ký tự); nên 30–${seoTitleLimit}.` : effectiveTitle.length > seoTitleLimit ? `Tiêu đề dài ${effectiveTitle.length} ký tự, Google sẽ cắt bớt; nên tối đa ${seoTitleLimit}.` : `Tiêu đề ${effectiveTitle.length} ký tự — vừa đẹp.` },
    { id: "description", ok: effectiveDescription.length >= 70 && effectiveDescription.length <= 160, message: !effectiveDescription ? "Chưa có mô tả: thêm tóm tắt hoặc mô tả SEO." : effectiveDescription.length < 70 ? `Mô tả ngắn (${effectiveDescription.length} ký tự); nên 70–160 để Google hiển thị đầy đủ.` : effectiveDescription.length > 160 ? `Mô tả dài ${effectiveDescription.length} ký tự, sẽ bị cắt; nên tối đa 160.` : `Mô tả ${effectiveDescription.length} ký tự — vừa đẹp.` },
    { id: "excerpt", ok: Boolean(collapse(input.excerpt)), message: collapse(input.excerpt) ? "Có tóm tắt cho danh sách tin và mạng xã hội." : "Chưa có tóm tắt: danh sách tin và Facebook/Zalo sẽ thiếu đoạn giới thiệu." },
    { id: "cover", ok: input.hasCover, message: input.hasCover ? "Có ảnh bìa khi chia sẻ liên kết." : "Chưa có ảnh bìa: chia sẻ lên Facebook/Zalo sẽ không có hình." },
    { id: "length", ok: words >= 300, message: words >= 300 ? `Nội dung ${words} từ.` : `Nội dung mới ${words} từ; bài trên 300 từ thường được tìm thấy tốt hơn.` },
    { id: "slug", ok: slugWords > 0 && slugWords <= 8 && input.slug.length <= 75, message: !input.slug ? "Chưa có đường dẫn." : slugWords > 8 || input.slug.length > 75 ? "Đường dẫn dài; nên gọn 3–8 từ chính." : "Đường dẫn ngắn gọn." },
  ];
}
