// Gợi ý/tự động SEO dùng chung cho CMS (trợ lý SEO) và website (giá trị dự phòng khi để trống),
// để điều người biên tập thấy trong CMS đúng là điều Google nhận được.
import { richFirstParagraph, richPlainText, richTableOfContents, type RichDocument, type RichNode } from "./rich-text";

export const seoTitleLimit = 60;
export const seoTitleMin = 30;
export const seoDescriptionMin = 70;
export const seoDescriptionLimit = 155;
// Đoạn văn đủ dài để làm mô tả (ngắn hơn là dòng nhãn/tiêu đề phụ).
const leadParagraphMinLength = 60;

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

// Từ không nên đứng cuối tiêu đề/mô tả bị cắt ("…nhà hàng của" → "…nhà hàng").
const danglingWords = new Set(["và", "cho", "của", "với", "để", "khi", "trong", "tại", "theo", "là", "như", "hoặc", "hay", "các", "những", "một", "có", "được"]);
// Chỗ cắt tự nhiên: dấu ngăn cách, hoặc ngay trước từ nối ("…hạ tầng | và giải pháp…" giữ trọn cụm danh từ phía trước).
const separatorPattern = /\s[-–—|]\s|[:;,]\s|\s(?:và|cho|của|với|để|trong|tại|theo|hoặc)\s/g;
const tailPunctuation = /[\s,.;:–—|-]+$/;

function stripDanglingTail(text: string) {
  let result = text.replace(tailPunctuation, "");
  for (;;) {
    const lastSpace = result.lastIndexOf(" ");
    if (lastSpace <= 0 || !danglingWords.has(result.slice(lastSpace + 1).toLocaleLowerCase("vi"))) return result;
    result = result.slice(0, lastSpace).replace(tailPunctuation, "");
  }
}

/**
 * Rút gọn về tối đa `limit` ký tự để LƯU vào ô tiêu đề/mô tả, không thêm "…" (Google tự cắt khi hiển thị; dấu … thật trong tiêu đề trông như lỗi).
 * Ưu tiên cắt ở dấu ngăn cách hoặc ngay trước từ nối, còn giữ ít nhất `min` ký tự (mặc định 40% giới hạn), rồi ở ranh giới từ; bỏ từ nối lủng lẳng ở cuối.
 * `sentence`: ưu tiên kết thúc ở một câu trọn vẹn (dùng cho mô tả) khi câu đó chiếm ít nhất 60% giới hạn.
 * `min`: độ dài tối thiểu của kết quả, để bản rút gọn không rơi xuống dưới mức đạt của chính phép kiểm tra (tiêu đề 30, mô tả 70).
 */
export function trimToLimit(text: string, limit: number, options: { sentence?: boolean; min?: number } = {}) {
  const clean = collapse(text);
  if (clean.length <= limit) return clean;
  const window = clean.slice(0, limit + 1);
  if (options.sentence) {
    let end = -1;
    for (const match of window.matchAll(/[.!?](?=\s)/g)) if ((match.index ?? -1) + 1 <= limit) end = (match.index ?? -1) + 1;
    if (end >= limit * 0.6) return clean.slice(0, end);
  }
  const floor = options.min ?? Math.floor(limit * 0.4);
  let cut = -1;
  for (const match of window.matchAll(separatorPattern)) if ((match.index ?? -1) >= floor && (match.index ?? -1) <= limit) cut = match.index ?? -1;
  if (cut > 0) {
    const piece = stripDanglingTail(clean.slice(0, cut));
    if (piece.length >= floor) return piece;
  }
  const atWord = clean[limit] === " " ? limit : clean.slice(0, limit).lastIndexOf(" ");
  return stripDanglingTail(clean.slice(0, atWord > limit * 0.6 ? atWord : limit));
}

export const seoBrand = "iOrder";
/**
 * Tiêu đề hiện trên Google/tab trình duyệt: thêm " | iOrder" khi tiêu đề chưa có chữ iOrder (website và xem trước trong CMS dùng chung quy tắc này).
 * Không thêm khi tiêu đề đã dài sẵn: thêm vào sẽ vượt giới hạn 60 ký tự và Google cắt mất phần cuối, nên giữ trọn tiêu đề còn hơn có thương hiệu.
 */
export function withBrand(title: string) {
  if (title.toLocaleLowerCase("vi").includes(seoBrand.toLocaleLowerCase("vi"))) return title;
  const branded = `${title} | ${seoBrand}`;
  return branded.length > seoTitleLimit ? title : branded;
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
  return trimToLimit(title, seoTitleLimit);
}

/** Đoạn mở đầu của bài. Bài nhập từ Word thường mở đầu bằng vài dòng nhãn ngắn ("Bán hàng", "Hướng dẫn sử dụng"): ưu tiên đoạn văn thật đầu tiên. */
function leadParagraph(content: PostLikeContent | null | undefined) {
  const rich = richOf(content);
  const paragraphs = content && "blocks" in content ? content.blocks.filter((block) => block.type === "paragraph").map((block) => collapse(block.text ?? "")) : [];
  return rich ? richFirstParagraph(rich, leadParagraphMinLength) ?? richFirstParagraph(rich) : paragraphs.find((text) => text.length >= leadParagraphMinLength) ?? paragraphs.find(Boolean);
}

/** Mô tả: ưu tiên tóm tắt, sau đó đoạn văn đầu tiên; null khi không có chữ nào. */
export function suggestSeoDescription(excerpt: string | null | undefined, content?: PostLikeContent | null) {
  const firstParagraph = leadParagraph(content);
  const source = collapse(excerpt ?? "") || collapse(firstParagraph ?? "") || contentPlainText(content);
  return source ? truncateAtWord(source, seoDescriptionLimit) : null;
}

/** Khối của Trang ở mức cần để lấy chữ; khớp một phần PageBlock mà không phụ thuộc hợp đồng trang. */
export type DescribableBlock = { type: string; isEnabled?: boolean; data?: unknown };

function blockText(block: DescribableBlock, minLength: number): string {
  const data = block.data;
  if (!data || typeof data !== "object") return "";
  const record = data as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" ? collapse(value) : "");
  switch (block.type) {
    case "hero": case "media_text": case "partners": case "lead_form": return text(record.description);
    case "rich_text": {
      const body = record.body;
      if (typeof body === "string") return text(body);
      return body && typeof body === "object" && (body as { type?: unknown }).type === "doc" ? collapse((minLength ? richFirstParagraph(body as RichDocument, minLength) : null) ?? richFirstParagraph(body as RichDocument) ?? "") : "";
    }
    default: return "";
  }
}

/**
 * Mô tả SEO tự động cho Trang khi người vận hành để trống: ưu tiên đoạn mô tả đủ dài đầu tiên (phần đầu trang, khối chữ…) theo
 * đúng thứ tự trên trang, không có thì lấy đoạn ngắn đầu tiên. Khối đang tắt bị bỏ qua. null khi trang không có chữ nào.
 */
export function suggestPageSeoDescription(blocks: readonly DescribableBlock[] | null | undefined) {
  const enabled = (blocks ?? []).filter((block) => block.isEnabled !== false);
  const candidates = (minLength: number) => enabled.map((block) => blockText(block, minLength)).filter(Boolean);
  const source = candidates(leadParagraphMinLength).find((text) => text.length >= leadParagraphMinLength) ?? candidates(0)[0];
  return source ? truncateAtWord(source, seoDescriptionLimit) : null;
}

/** `partial: true` đi kèm `ok: true`: đạt nhưng còn gợi ý nhỏ (ví dụ có đủ các từ của cụm nhưng chưa viết nguyên cụm). */
export type SeoCheck = { id: string; ok: boolean; message: string; partial?: boolean };

// Từ khóa chính: so khớp theo cụm từ nguyên vẹn, không phân biệt hoa thường. Đường dẫn không có dấu nên so sau khi bỏ dấu.
const wordCharacter = /[\p{L}\p{N}]/u;
function lowerText(text: string) { return collapse(text).normalize("NFC").toLocaleLowerCase("vi"); }
function foldText(text: string) { return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase(); }

/** Số lần cụm từ khóa xuất hiện nguyên vẹn trong văn bản: cụm nằm giữa một từ dài hơn (ví dụ "pos" trong "post") không tính. */
export function countKeyword(text: string, keyword: string) {
  const haystack = lowerText(text);
  const needle = lowerText(keyword);
  if (!needle) return 0;
  let count = 0;
  for (let from = 0; ;) {
    const index = haystack.indexOf(needle, from);
    if (index < 0) return count;
    const before = haystack[index - 1];
    const after = haystack[index + needle.length];
    if (!(before && wordCharacter.test(before)) && !(after && wordCharacter.test(after))) count += 1;
    from = index + needle.length;
  }
}

function tokensOf(text: string) {
  return lowerText(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

// Google in đậm từng từ khớp với câu tìm kiếm chứ không đòi đúng nguyên cụm, và tiếng Việt có nhiều cách nói gần nghĩa
// ("phần mềm quản lý bán hàng" / "phần mềm bán hàng"). Có từ 60% số từ của cụm (không cần liền nhau) là "gần khớp".
const partialCoverage = 0.6;

export type KeywordMatch = "exact" | "partial" | "none";

/** exact: có nguyên cụm; partial: có ít nhất 60% số từ của cụm (cụm từ 2 từ trở lên) nhưng chưa nguyên cụm; none: còn lại. */
export function matchKeyword(text: string, keyword: string): KeywordMatch {
  if (countKeyword(text, keyword) > 0) return "exact";
  const wanted = [...new Set(tokensOf(keyword))];
  if (wanted.length < 2) return "none";
  const present = new Set(tokensOf(text));
  const found = wanted.filter((token) => present.has(token)).length;
  return found / wanted.length >= partialCoverage ? "partial" : "none";
}

function keywordInSlug(slug: string, keyword: string) {
  const needle = foldText(keyword).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return Boolean(needle) && `-${foldText(slug)}-`.includes(`-${needle}-`);
}

function richImages(nodes: readonly RichNode[] | undefined): Array<{ alt: string | null }> {
  return (nodes ?? []).flatMap((node) => node.type === "image" ? [{ alt: node.attrs.alt }] : "content" in node ? richImages(node.content) : []);
}

// Mật độ từ khóa hợp lý theo Yoast/Rank Math: 0,5–2,5% số từ; cần đủ chữ mới đo.
const densityMin = 0.5;
const densityMax = 2.5;
const densityMinWords = 100;

/** Một mục kiểm tra theo kết quả khớp: nguyên cụm thì đạt; gần khớp thì đạt kèm gợi ý nhỏ nếu `softOk`, không thì chưa đạt. */
function matchCheck(id: string, match: KeywordMatch, softOk: boolean, messages: { exact: string; partial: string; none: string }): SeoCheck {
  if (match === "exact") return { id, ok: true, message: messages.exact };
  if (match === "partial") return { id, ok: softOk, message: messages.partial, ...(softOk ? { partial: true } : {}) };
  return { id, ok: false, message: messages.none };
}

function keywordChecks(input: { slug: string; content?: PostLikeContent | null }, keyword: string, title: string, description: string, words: number): SeoCheck[] {
  const quoted = `“${keyword}”`;
  const inSlug = keywordInSlug(input.slug, keyword);
  // Tiêu đề và đường dẫn giữ chặt: gần khớp chưa đủ. Mô tả, đoạn mở đầu, đề mục: gần khớp là đạt, chỉ nhắc nhẹ.
  const checks: SeoCheck[] = [
    matchCheck("kw_title", matchKeyword(title, keyword), false, { exact: `Tiêu đề có cụm ${quoted}.`, partial: `Tiêu đề mới có một số từ của cụm ${quoted}. Sửa ở ô “Tiêu đề SEO”: viết đủ cả cụm, đặt gần đầu.`, none: `Tiêu đề chưa có cụm ${quoted}. Sửa ở ô “Tiêu đề SEO”: đưa cụm này vào, đặt gần đầu.` }),
    matchCheck("kw_description", matchKeyword(description, keyword), true, { exact: `Mô tả có cụm ${quoted}.`, partial: `Mô tả mới có một số từ của cụm ${quoted}. Nếu tự nhiên, viết đủ cả cụm một lần ở ô “Mô tả SEO” để Google in đậm.`, none: `Mô tả chưa có cụm ${quoted}. Thêm vào ô “Mô tả SEO”: Google sẽ in đậm cụm này khi khớp với điều khách tìm.` }),
    // Đường dẫn là yếu tố nhẹ nhất và đổi đường dẫn bài đã đăng làm hỏng liên kết cũ: thiếu cụm chỉ là gợi ý, không bắt người dùng làm.
    { id: "kw_slug", ok: true, ...inSlug ? {} : { partial: true }, message: inSlug ? `Đường dẫn có cụm ${quoted}.` : `Đường dẫn chưa có cụm ${quoted}. Bài chưa đăng: có thể sửa ở dòng “Đường dẫn” phía trên. Bài đã đăng: cứ để nguyên kẻo hỏng liên kết cũ.` },
  ];
  if (!input.content) return checks;
  checks.push(matchCheck("kw_intro", matchKeyword(leadParagraph(input.content) ?? "", keyword), true, { exact: `Đoạn mở đầu có cụm ${quoted}.`, partial: `Đoạn mở đầu mới có một số từ của cụm ${quoted}. Nếu tự nhiên, viết đủ cả cụm trong 1–2 câu đầu của bài.`, none: `Đoạn mở đầu của bài chưa nhắc tới cụm ${quoted}. Hãy viết cụm này vào 1–2 câu đầu của bài.` }));
  const headings = richTableOfContents(richOf(input.content));
  if (headings.length) {
    const matches = headings.map((heading) => matchKeyword(heading.text, keyword));
    const exact = matches.filter((match) => match === "exact").length;
    const best: KeywordMatch = exact ? "exact" : matches.includes("partial") ? "partial" : "none";
    checks.push(matchCheck("kw_heading", best, true, { exact: `${exact}/${headings.length} đề mục có cụm ${quoted}.`, partial: `Có đề mục chứa một số từ của cụm ${quoted}. Nếu tự nhiên, viết đủ cả cụm ở một đề mục.`, none: `Chưa đề mục nào (tiêu đề nhỏ H2/H3) có cụm ${quoted}. Đưa cụm này vào một đề mục phù hợp.` }));
  }
  if (words >= densityMinWords) {
    const text = contentPlainText(input.content);
    const uses = countKeyword(text, keyword);
    const density = (uses * lowerText(keyword).split(" ").length / words) * 100;
    if (uses === 0) {
      checks.push(matchCheck("kw_density", matchKeyword(text, keyword), true, { exact: "", partial: `Trong bài có các từ của cụm ${quoted} nhưng chưa chỗ nào viết đủ cả cụm. Hãy viết đủ cả cụm vài lần ở những chỗ tự nhiên.`, none: `Trong bài chưa nhắc tới cụm ${quoted}. Hãy viết cụm này vài lần ở những chỗ tự nhiên.` }));
    } else {
      checks.push({
        id: "kw_density", ok: density >= densityMin && density <= densityMax,
        message: density < densityMin ? `Cụm ${quoted} mới xuất hiện ${uses} lần trong bài; nên nhắc thêm vài lần ở chỗ tự nhiên.`
          : density > densityMax ? `Cụm ${quoted} lặp ${uses} lần, nhiều quá dễ bị Google coi là nhồi từ khóa; nên bớt vài chỗ.`
          : `Cụm ${quoted} xuất hiện ${uses} lần trong bài — vừa phải.`,
      });
    }
  }
  return checks;
}

/** Số cụm từ liên quan tối đa mỗi nội dung (cụm chính + 4 cụm gần nghĩa là đủ; nhiều hơn dễ thành nhồi từ khóa). */
export const maxRelatedKeywords = 4;

/** Chuẩn hóa danh sách cụm liên quan: bỏ ô trống, trùng nhau (không phân biệt hoa thường) và trùng với cụm chính; tối đa 4. */
export function normalizeRelatedKeywords(related: readonly string[] | null | undefined, focusKeyword?: string | null) {
  const seen = new Set([lowerText(focusKeyword ?? "")]);
  const result: string[] = [];
  for (const raw of related ?? []) {
    const value = collapse(raw);
    const key = lowerText(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result.slice(0, maxRelatedKeywords);
}

/**
 * Cụm từ liên quan (cách gọi khác của cùng ý): chỉ cần xuất hiện tự nhiên trong bài, không cần ở tiêu đề hay mô tả.
 * Chỉ đánh giá khi bài đủ dài để đo (cùng ngưỡng với mật độ); báo khi một cụm lặp quá nhiều.
 */
function relatedKeywordChecks(content: PostLikeContent, related: readonly string[], words: number): SeoCheck[] {
  if (words < densityMinWords) return [];
  const text = contentPlainText(content);
  return related.map((keyword, index): SeoCheck => {
    const id = `kw_related_${index + 1}`;
    const quoted = `“${keyword}”`;
    const uses = countKeyword(text, keyword);
    if (uses === 0) return matchCheck(id, matchKeyword(text, keyword), true, { exact: "", partial: `Cụm liên quan ${quoted}: trong bài mới có các từ rời, chưa chỗ nào viết đủ cả cụm. Nếu hợp lý, viết đủ một lần.`, none: `Cụm liên quan ${quoted} chưa xuất hiện trong bài. Hãy nhắc 1–2 lần ở chỗ tự nhiên (đoạn đầu hoặc một đề mục).` });
    const density = (uses * lowerText(keyword).split(" ").length / words) * 100;
    return density > densityMax
      ? { id, ok: false, message: `Cụm liên quan ${quoted} lặp ${uses} lần, nhiều quá dễ bị Google coi là nhồi từ khóa; nên bớt vài chỗ.` }
      : { id, ok: true, message: `Cụm liên quan ${quoted} xuất hiện ${uses} lần trong bài.` };
  });
}

export function seoChecks(input: { title: string; seoTitle: string; seoDescription: string; excerpt: string; slug: string; hasCover: boolean; content?: PostLikeContent | null; focusKeyword?: string | null; relatedKeywords?: readonly string[] | null }): SeoCheck[] {
  const effectiveTitle = collapse(input.seoTitle) || collapse(input.title);
  const effectiveDescription = collapse(input.seoDescription) || suggestSeoDescription(input.excerpt, input.content) || "";
  const words = contentPlainText(input.content).split(" ").filter(Boolean).length;
  const slugWords = input.slug.split("-").filter(Boolean).length;
  const keyword = collapse(input.focusKeyword ?? "");
  const rich = richOf(input.content);
  const images = richImages(rich?.content);
  const missingAlt = images.filter((image) => !image.alt?.trim()).length;
  const headingCount = rich ? richTableOfContents(rich).length : 0;
  return [
    { id: "title", ok: effectiveTitle.length >= seoTitleMin && effectiveTitle.length <= seoTitleLimit, message: effectiveTitle.length < seoTitleMin ? `Tiêu đề hiển thị trên Google ngắn (${effectiveTitle.length} ký tự); nên 30–${seoTitleLimit}.` : effectiveTitle.length > seoTitleLimit ? `Tiêu đề dài ${effectiveTitle.length} ký tự, Google sẽ cắt bớt; nên tối đa ${seoTitleLimit}.` : `Tiêu đề ${effectiveTitle.length} ký tự — vừa đẹp.` },
    { id: "description", ok: effectiveDescription.length >= 70 && effectiveDescription.length <= 160, message: !effectiveDescription ? "Chưa có mô tả: thêm tóm tắt hoặc mô tả SEO." : effectiveDescription.length < 70 ? `Mô tả ngắn (${effectiveDescription.length} ký tự); nên 70–160 để Google hiển thị đầy đủ.` : effectiveDescription.length > 160 ? `Mô tả dài ${effectiveDescription.length} ký tự, sẽ bị cắt; nên tối đa 160.` : `Mô tả ${effectiveDescription.length} ký tự — vừa đẹp.` },
    { id: "excerpt", ok: Boolean(collapse(input.excerpt)), message: collapse(input.excerpt) ? "Có tóm tắt cho danh sách tin và mạng xã hội." : "Chưa có tóm tắt: danh sách tin và Facebook/Zalo sẽ thiếu đoạn giới thiệu." },
    { id: "cover", ok: input.hasCover, message: input.hasCover ? "Có ảnh bìa khi chia sẻ liên kết." : "Chưa có ảnh bìa: chia sẻ lên Facebook/Zalo sẽ không có hình." },
    { id: "length", ok: words >= 300, message: words >= 300 ? `Nội dung ${words} từ.` : `Nội dung mới ${words} từ; bài trên 300 từ thường được tìm thấy tốt hơn.` },
    { id: "slug", ok: slugWords > 0 && slugWords <= 8 && input.slug.length <= 75, message: !input.slug ? "Chưa có đường dẫn." : slugWords > 8 || input.slug.length > 75 ? "Đường dẫn dài; nên gọn 3–8 từ chính." : "Đường dẫn ngắn gọn." },
    // Chỉ xét khi nội dung là bài soạn thảo: ảnh thiếu alt mất lượt tìm trên Google Hình ảnh; bài dài cần đề mục để chia ý.
    ...images.length ? [{ id: "images_alt", ok: missingAlt === 0, message: missingAlt === 0 ? `${images.length} ảnh trong bài đều có mô tả ảnh (alt).` : `${missingAlt}/${images.length} ảnh trong bài chưa có mô tả ảnh (alt): thêm để Google Hình ảnh và người đọc màn hình hiểu ảnh.` }] : [],
    ...rich && words >= 300 ? [{ id: "headings", ok: headingCount > 0, message: headingCount > 0 ? `Có ${headingCount} đề mục (H2/H3) chia nhỏ bài.` : "Bài dài nhưng chưa có đề mục (tiêu đề nhỏ H2/H3); thêm đề mục giúp người đọc và Google nắm cấu trúc." }] : [],
    ...keyword ? keywordChecks(input, keyword, effectiveTitle, effectiveDescription, words) : [],
    ...input.content ? relatedKeywordChecks(input.content, normalizeRelatedKeywords(input.relatedKeywords, keyword), words) : [],
  ];
}

// Từ nối cắt cụm từ khóa gợi ý: "Phần mềm quản lý nhà hàng cho chủ quán" → "phần mềm quản lý nhà hàng".
const keywordBreakWords = new Set(["cho", "và", "của", "với", "để", "khi", "trong", "tại", "theo", "là", "như"]);
const suggestedKeywordMaxWords = 6;

/** Gợi ý cụm từ khách hay gõ từ tiêu đề: phần trước dấu ":", "|", "–", " - ", cắt ở từ nối, tối đa 6 từ, chữ thường. Rỗng khi quá ngắn. */
export function suggestFocusKeyword(title: string) {
  const head = collapse(title).split(/\s*[:|–—]\s*|\s-\s/)[0] ?? "";
  const words = head.split(" ").filter(Boolean);
  const cut = words.findIndex((word, index) => index >= 3 && keywordBreakWords.has(word.toLocaleLowerCase("vi")));
  const phrase = words.slice(0, cut > 0 ? cut : suggestedKeywordMaxWords).slice(0, suggestedKeywordMaxWords).join(" ").toLocaleLowerCase("vi");
  return phrase.length >= 4 ? phrase : "";
}

/** Việc sửa được bằng một cú bấm: thay giá trị của ô tiêu đề hoặc mô tả SEO. */
export type SeoFix = { field: "seoTitle" | "seoDescription"; value: string; label: string };
export type SeoGuideItem = { id: string; message: string; fix?: SeoFix };
export type SeoGuide = {
  passed: number;
  total: number;
  status: "ready" | "almost" | "needs";
  headline: string;
  /** Tối đa `limit` việc quan trọng nhất cần làm, theo thứ tự nên làm. */
  todo: SeoGuideItem[];
  /** Số việc còn lại không hiện trong `todo`. */
  hidden: number;
  /** Gợi ý nhỏ: mục đã đạt nhưng còn cách làm tốt hơn (ví dụ có đủ các từ của cụm nhưng chưa nguyên cụm). Tối đa 2. */
  hints: SeoGuideItem[];
};

// Thứ tự nên làm cho người không rành SEO: thứ Google hiện ra trước (mô tả, tiêu đề), rồi từ khóa, ảnh chia sẻ, cấu trúc bài.
const guidePriority = ["description", "title", "kw_title", "kw_description", "cover", "excerpt", "kw_slug", "kw_intro", "images_alt", "length", "headings", "kw_heading", "kw_density", "kw_related_1", "kw_related_2", "kw_related_3", "kw_related_4", "slug"];
const guideReadyShare = 0.75;

// Chỉ đề xuất cách sửa khi máy làm đúng được: rút gọn tiêu đề/mô tả quá dài. Viết lại tiêu đề, thêm từ khóa, viết thêm mô tả… cần người viết
// (thử ghép từ khóa vào đầu tiêu đề cho ra tiêu đề rác như "Iorder.vn: Trang chủ: iOrder - …", nên không làm).
function guideFix(check: SeoCheck, input: Parameters<typeof seoChecks>[0]): SeoFix | undefined {
  if (check.id === "title") {
    const title = collapse(input.seoTitle) || collapse(input.title);
    if (title.length > seoTitleLimit) return { field: "seoTitle", value: trimToLimit(title, seoTitleLimit, { min: seoTitleMin }), label: "Rút gọn giúp tôi" };
  }
  if (check.id === "description") {
    const description = collapse(input.seoDescription);
    if (description.length > 160) return { field: "seoDescription", value: trimToLimit(description, seoDescriptionLimit, { sentence: true, min: seoDescriptionMin }), label: "Rút gọn giúp tôi" };
  }
  return undefined;
}

/** Tóm tắt SEO cho người không rành: một điểm, vài việc quan trọng nhất kèm cách sửa nhanh khi làm được. */
export function seoGuide(input: Parameters<typeof seoChecks>[0], options: { checkIds?: readonly string[]; limit?: number } = {}): SeoGuide {
  const checks = seoChecks(input).filter((check) => !options.checkIds || options.checkIds.includes(check.id));
  const rank = (id: string) => { const index = guidePriority.indexOf(id); return index < 0 ? guidePriority.length : index; };
  const failed = checks.filter((check) => !check.ok).sort((a, b) => rank(a.id) - rank(b.id));
  const limit = options.limit ?? 3;
  const todo = failed.slice(0, limit).map((check): SeoGuideItem => ({ id: check.id, message: check.message, fix: guideFix(check, input) }));
  const passed = checks.length - failed.length;
  const status = !failed.length || !checks.length ? "ready" : passed / checks.length >= guideReadyShare ? "almost" : "needs";
  const headline = status === "ready" ? "Sẵn sàng lên Google" : status === "almost" ? `Gần xong, còn ${failed.length} việc nhỏ` : `Cần bổ sung ${failed.length} việc để lên Google tốt hơn`;
  const hints = checks.filter((check) => check.ok && check.partial).sort((a, b) => rank(a.id) - rank(b.id)).slice(0, 2).map((check): SeoGuideItem => ({ id: check.id, message: check.message }));
  return { passed, total: checks.length, status, headline, todo, hidden: failed.length - todo.length, hints };
}

// Việc SEO đủ quan trọng để nhắc ngay trước khi đăng. Ảnh bìa và tóm tắt đã có nhắc riêng; đường dẫn không đổi được an toàn khi đang đăng;
// độ dài bài chỉ là gợi ý nên không nhắc ở đây.
const prepublishSeoIds = ["title", "description", "kw_title", "kw_description", "images_alt"];

/** Các mục SEO chưa đạt đáng xử lý trước khi đăng (dùng cho khối "Nên có trước khi đăng"). */
export function seoPrepublishIssues(input: Parameters<typeof seoChecks>[0]): SeoCheck[] {
  return seoChecks(input).filter((check) => !check.ok && prepublishSeoIds.includes(check.id));
}
