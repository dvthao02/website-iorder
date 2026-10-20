import { z } from "zod";

// Nội dung soạn thảo kiểu Word (JSON của ProseMirror/Tiptap). Máy chủ không tin dữ liệu gửi lên:
// chỉ giữ loại khối/định dạng/thuộc tính trong danh sách trắng, mọi thứ khác bị từ chối.
// Website render từ JSON này bằng React (không dùng HTML thô), nên không có đường chèn script.

export type RichMark =
  | { type: "bold" | "italic" | "underline" | "strike" | "code" }
  | { type: "link"; attrs: { href: string; target: "_blank" | null } };

export type RichNode =
  | { type: "text"; text: string; marks?: RichMark[] }
  | { type: "paragraph"; content?: RichNode[] }
  | { type: "heading"; attrs: { level: 2 | 3 | 4 }; content?: RichNode[] }
  | { type: "bulletList" | "blockquote" | "listItem" | "table" | "tableRow"; content?: RichNode[] }
  | { type: "orderedList"; attrs: { start: number }; content?: RichNode[] }
  | { type: "tableHeader" | "tableCell"; attrs: { colspan: number; rowspan: number }; content?: RichNode[] }
  | { type: "codeBlock"; content?: RichNode[] }
  | { type: "image"; attrs: { src: string; alt: string | null; title: string | null; width: number; align: ImageAlign } }
  | { type: "imageBanner"; attrs: { src: string; overlay: BannerOverlay; height: BannerHeight }; content?: RichNode[] }
  | { type: "horizontalRule" | "hardBreak" };

export type RichDocument = { type: "doc"; content: RichNode[] };

// Ảnh trong bài: độ rộng tính theo % khung bài (không theo pixel) để CMS và website khớp nhau.
// Căn: center = "trên và dưới" (chữ không chạy quanh), left/right = chữ bao quanh như Word.
export const imageWidthLimits = { min: 10, max: 100 } as const;
const legacyImageWidths: Record<string, number> = { small: 33, medium: 50, large: 75, full: 100 };
export const imageAligns = ["center", "left", "right"] as const;
export const bannerOverlays = ["dark", "light", "none"] as const;
export const bannerHeights = ["short", "medium", "tall"] as const;
export type ImageAlign = typeof imageAligns[number];
export type BannerOverlay = typeof bannerOverlays[number];
export type BannerHeight = typeof bannerHeights[number];
const pick = <T extends string>(values: readonly T[], value: unknown, fallback: T): T => values.includes(value as T) ? value as T : fallback;
// Trong khối ảnh nền chỉ cho chữ (tiêu đề, đoạn, danh sách, trích dẫn) để chữ luôn đọc được trên ảnh.
const bannerChildren = new Set(["paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote", "text", "hardBreak"]);

const limits = { depth: 24, nodes: 20_000, textLength: 300_000, textNode: 20_000 };
const safeHref = /^(https?:\/\/[^\s]+|mailto:[^\s]+|tel:[+0-9 ().-]+|\/(?!\/)[^\s]*|#[^\s]*)$/i;
const mediaSrc = /^\/media\/[A-Za-z0-9/_.%-]+$/;
const containers = new Set(["paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote", "table", "tableRow", "tableHeader", "tableCell", "codeBlock"]);
const simpleMarks = new Set(["bold", "italic", "underline", "strike", "code"]);

class RichTextError extends Error {}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RichTextError("Nội dung không đúng định dạng.");
  return value as Record<string, unknown>;
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) || null : null;
}

/** Làm sạch tài liệu; ném lỗi (thông báo tiếng Việt) khi có thành phần không được phép. */
export function sanitizeRichDocument(input: unknown): RichDocument {
  const state = { nodes: 0, text: 0 };

  function mark(value: unknown): RichMark | null {
    const item = record(value);
    if (typeof item.type === "string" && simpleMarks.has(item.type)) return { type: item.type as "bold" };
    if (item.type === "link") {
      const attrs = record(item.attrs ?? {});
      const href = typeof attrs.href === "string" ? attrs.href.trim() : "";
      if (!safeHref.test(href) || href.length > 2000) throw new RichTextError("Liên kết trong nội dung không hợp lệ (chỉ cho phép http(s), mailto, tel hoặc đường dẫn nội bộ).");
      return { type: "link", attrs: { href, target: attrs.target === "_blank" ? "_blank" : null } };
    }
    throw new RichTextError(`Định dạng chữ "${String(item.type)}" chưa được hỗ trợ.`);
  }

  function node(value: unknown, depth: number, inBanner = false): RichNode {
    if (depth > limits.depth) throw new RichTextError("Nội dung lồng nhau quá sâu.");
    if (++state.nodes > limits.nodes) throw new RichTextError("Nội dung quá dài.");
    const item = record(value);
    const type = item.type;
    if (inBanner && !bannerChildren.has(String(type))) throw new RichTextError("Khối ảnh nền chỉ chứa tiêu đề, đoạn văn và danh sách.");
    const children = (banner = inBanner) => Array.isArray(item.content) ? item.content.map((child) => node(child, depth + 1, banner)) : undefined;

    if (type === "text") {
      const text = typeof item.text === "string" ? item.text : "";
      if (!text || text.length > limits.textNode) throw new RichTextError("Đoạn chữ trống hoặc quá dài.");
      state.text += text.length;
      if (state.text > limits.textLength) throw new RichTextError("Nội dung quá dài.");
      const marks = Array.isArray(item.marks) ? item.marks.map(mark).filter((entry): entry is RichMark => entry !== null) : [];
      return marks.length ? { type, text, marks } : { type, text };
    }
    if (type === "heading") {
      const attrs = record(item.attrs ?? {});
      return { type, attrs: { level: clampInt(attrs.level, 2, 4, 2) as 2 | 3 | 4 }, content: children() };
    }
    if (type === "orderedList") return { type, attrs: { start: clampInt(record(item.attrs ?? {}).start, 1, 10_000, 1) }, content: children() };
    if (type === "tableHeader" || type === "tableCell") {
      const attrs = record(item.attrs ?? {});
      return { type, attrs: { colspan: clampInt(attrs.colspan, 1, 20, 1), rowspan: clampInt(attrs.rowspan, 1, 50, 1) }, content: children() };
    }
    if (type === "image") {
      const attrs = record(item.attrs ?? {});
      const src = typeof attrs.src === "string" ? attrs.src.trim() : "";
      if (!mediaSrc.test(src)) throw new RichTextError("Ảnh trong nội dung phải nằm trong Thư viện media.");
      return { type, attrs: { src, alt: cleanText(attrs.alt, 500), title: cleanText(attrs.title, 500), width: clampInt(attrs.width, imageWidthLimits.min, imageWidthLimits.max, legacyImageWidths[String(attrs.size)] ?? 100), align: pick(imageAligns, attrs.align, "center") } };
    }
    if (type === "imageBanner") {
      const attrs = record(item.attrs ?? {});
      const src = typeof attrs.src === "string" ? attrs.src.trim() : "";
      if (!mediaSrc.test(src)) throw new RichTextError("Ảnh nền phải nằm trong Thư viện media.");
      return { type, attrs: { src, overlay: pick(bannerOverlays, attrs.overlay, "dark"), height: pick(bannerHeights, attrs.height, "medium") }, content: children(true) };
    }
    if (type === "horizontalRule" || type === "hardBreak") return { type };
    if (typeof type === "string" && containers.has(type)) return { type, content: children() } as RichNode;
    throw new RichTextError(`Thành phần "${String(type)}" chưa được hỗ trợ trong nội dung.`);
  }

  const doc = record(input);
  if (doc.type !== "doc" || !Array.isArray(doc.content)) throw new RichTextError("Nội dung không đúng định dạng.");
  const content = doc.content.map((child) => node(child, 1));
  if (state.text === 0 && !content.some((child) => child.type === "image" || child.type === "imageBanner")) throw new RichTextError("Nội dung bài viết đang trống.");
  return { type: "doc", content };
}

/** Schema Zod: dữ liệu vào được làm sạch; lỗi trả về như lỗi kiểm tra thông thường (400). */
export const richDocumentSchema = z.unknown().transform((value, context): RichDocument => {
  try {
    return sanitizeRichDocument(value);
  } catch (error) {
    context.addIssue({ code: "custom", message: error instanceof RichTextError ? error.message : "Nội dung không hợp lệ." });
    return z.NEVER;
  }
});

/** Chữ thuần (đếm từ, mô tả SEO, tìm kiếm). */
export function richPlainText(doc: RichDocument | null | undefined) {
  const parts: string[] = [];
  const walk = (nodes: RichNode[] | undefined) => {
    for (const child of nodes ?? []) {
      if (child.type === "text") parts.push(child.text);
      else if ("content" in child) { walk(child.content); parts.push(" "); }
    }
  };
  walk(doc?.content);
  return parts.join("").replace(/\s+/g, " ").trim();
}

/** Đoạn văn đầu tiên có chữ (dùng làm mô tả mặc định). */
export function richFirstParagraph(doc: RichDocument | null | undefined) {
  const paragraph = doc?.content.find((child) => child.type === "paragraph" && richPlainText({ type: "doc", content: [child] }));
  return paragraph ? richPlainText({ type: "doc", content: [paragraph] }) : null;
}

export function headingId(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "muc";
}

/** Mục lục từ tiêu đề H2/H3, id không trùng nhau để làm neo (#…). */
export function richTableOfContents(doc: RichDocument | null | undefined) {
  const used = new Map<string, number>();
  return (doc?.content ?? []).flatMap((child) => {
    if (child.type !== "heading" || child.attrs.level > 3) return [];
    const text = richPlainText({ type: "doc", content: [child] });
    if (!text) return [];
    const base = headingId(text);
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    return [{ id: count ? `${base}-${count + 1}` : base, text, level: child.attrs.level as 2 | 3 }];
  });
}

/** Chữ thuần cũ (đoạn cách nhau bằng dòng trống) → tài liệu soạn thảo, dùng khi mở nội dung cũ trong trình soạn mới. */
export function plainTextToRichDocument(text: string): RichDocument {
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  return {
    type: "doc",
    content: (paragraphs.length ? paragraphs : [""]).map((part): RichNode => ({
      type: "paragraph",
      content: part.split("\n").flatMap((line, index): RichNode[] => [...(index ? [{ type: "hardBreak" as const }] : []), ...(line ? [{ type: "text" as const, text: line }] : [])]),
    })),
  };
}
