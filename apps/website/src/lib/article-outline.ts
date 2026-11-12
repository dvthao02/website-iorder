import type { PostContentDocument } from "@iorder/shared/server/posts/posts.contract";
import { promoteOutlineHeadings, richPlainText, richTableOfContents, type RichDocument } from "@iorder/shared/server/shared/rich-text";

import { fold } from "@/lib/fold";

export type OutlineEntry = ReturnType<typeof richTableOfContents>[number];

// Bài nhập từ Word thường mở đầu bằng vài dòng lặp lại tiêu đề trang ("Bán hàng", "Hướng dẫn sử dụng",
// "Tính năng Bán hàng") — trên web tiêu đề đã có ở H1 nên các dòng đó được ẩn khi hiển thị.
function withoutRepeatedTitle(doc: RichDocument, title: string): RichDocument {
  const name = fold(title).trim();
  const repeats = new Set([name, "huong dan su dung", `tinh nang ${name}`, `huong dan ${name}`]);
  let skip = 0;
  while (skip < 3 && doc.content[skip]?.type === "paragraph" && repeats.has(fold(richPlainText({ type: "doc", content: [doc.content[skip]] })).trim())) skip++;
  return skip ? { ...doc, content: doc.content.slice(skip) } : doc;
}

/**
 * Chuẩn bị nội dung bài để hiển thị kèm mục lục (chỉ lúc hiển thị, dữ liệu lưu không đổi): bỏ các dòng mở đầu lặp tiêu đề;
 * bài chưa có tiêu đề thì dòng in đậm đánh số ("I. …", "1. …", "Bước n: …") được coi là tiêu đề; mục lục lấy từ H2/H3.
 */
export function articleOutline(document: PostContentDocument, title: string): { document: PostContentDocument; toc: OutlineEntry[] } {
  if (document.version !== 2) return { document, toc: [] };
  const doc = promoteOutlineHeadings(withoutRepeatedTitle(document.doc, title));
  return { document: doc === document.doc ? document : { ...document, doc }, toc: richTableOfContents(doc) };
}
