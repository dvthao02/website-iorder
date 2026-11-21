import { richPlainText, richTableOfContents, type RichDocument, type RichNode } from "@iorder/shared/server/shared/rich-text";
import { truncateAtWord } from "@iorder/shared/server/shared/seo";

export type SummaryPoint = { id: string; heading: string; text: string };

// Phần kêu gọi/điều hướng cuối bài không phải ý chính của nội dung.
const skippedHeading = /^(bắt đầu|cần hỗ trợ|xem thêm|đọc thêm|bài viết liên quan|tìm hiểu thêm|liên hệ|câu hỏi thường gặp|đăng ký)/i;
const minSentence = 30;
const maxSentence = 160;
const minPoints = 3;

const textOf = (node: RichNode) => richPlainText({ type: "doc", content: [node] }).trim();

// Câu đầu quá cụt ("Đừng vội quy kết.") không nói được ý gì: ghép thêm câu kế tiếp cho tới khi đủ rõ (nhưng không vượt giới hạn).
const minClear = 25;

function firstSentence(text: string) {
  const sentences = text.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [text];
  let result = sentences[0] ?? text;
  for (let next = 1; result.length < minClear && next < sentences.length; next++) result = `${result} ${sentences[next]}`;
  return result.length > maxSentence ? truncateAtWord(result, maxSentence) : result;
}

/** Câu đầu tiên của nội dung ngay dưới một đề mục: đoạn văn đầu tiên; không có đoạn văn thì mục đầu tiên của danh sách. */
function leadOf(nodes: readonly RichNode[]) {
  for (const node of nodes) {
    if (node.type === "heading") return null;
    if (node.type === "paragraph") { const text = textOf(node); if (text.length >= minSentence) return firstSentence(text); }
    if (node.type === "bulletList" || node.type === "orderedList") { const item = node.content?.[0]; const text = item ? textOf(item) : ""; if (text.length >= minSentence) return firstSentence(text); }
  }
  return null;
}

/**
 * "Tóm tắt nhanh" của bài, tự rút từ nội dung (không cần nhập thêm trong CMS): với mỗi đề mục H2, lấy câu đầu tiên ngay dưới đề mục —
 * thường là câu nêu ý chính của phần đó. Bỏ các phần kêu gọi cuối bài; tối đa `max` ý; ít hơn 3 ý thì không tạo (null) vì không còn là bản tóm tắt.
 * Mã neo khớp mục lục (cùng thứ tự đề mục H2/H3), để bấm vào ý chính nhảy tới đúng phần.
 */
export function articleSummary(doc: RichDocument, max = 5): SummaryPoint[] | null {
  const ids = richTableOfContents(doc).map((entry) => entry.id);
  const points: SummaryPoint[] = [];
  let headingIndex = 0;
  doc.content.forEach((node, index) => {
    if (node.type !== "heading" || node.attrs.level > 3 || !textOf(node)) return;
    const id = ids[headingIndex++];
    const heading = textOf(node);
    if (node.attrs.level !== 2 || skippedHeading.test(heading)) return;
    const text = leadOf(doc.content.slice(index + 1));
    if (text && id) points.push({ id, heading, text });
  });
  return points.length >= minPoints ? points.slice(0, max) : null;
}
