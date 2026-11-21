import { richPlainText, type RichDocument, type RichNode } from "@iorder/shared/server/shared/rich-text";

// Ảnh trong bài nhập từ Word thường không có mô tả (alt): Google Hình ảnh không hiểu ảnh và người đọc bằng trình đọc màn hình chỉ nghe "hình ảnh".
// Chỉ lúc hiển thị (dữ liệu lưu không đổi), ảnh thiếu alt được gán mô tả từ ngữ cảnh: chú thích ảnh nếu có, không thì đề mục đứng trước ảnh.
// Alt do người biên tập nhập luôn được giữ nguyên.

function mapNodes(nodes: RichNode[] | undefined, visit: (node: RichNode) => RichNode): RichNode[] | undefined {
  return nodes?.map((node) => {
    const next = visit(node);
    return "content" in next && next.content ? { ...next, content: mapNodes(next.content, visit) } as RichNode : next;
  });
}

export function withImageAlts(doc: RichDocument, subject: string): RichDocument {
  let context = subject.trim();
  let counter = 0;
  const content = mapNodes(doc.content, (node) => {
    if (node.type === "heading") {
      const text = richPlainText({ type: "doc", content: [node] });
      // Bỏ số thứ tự đầu đề mục của bài Word ("II. ", "2. ", "3) ") cho mô tả ảnh đọc tự nhiên.
      const label = text.replace(/^(?:[IVXLC]+|\d+)[.)]\s+/, "").trim();
      if (node.attrs.level <= 3 && label) { context = label; counter = 0; }
      return node;
    }
    if (node.type !== "image" || node.attrs.alt?.trim()) return node;
    counter += 1;
    const caption = node.attrs.title?.trim();
    return { ...node, attrs: { ...node.attrs, alt: caption || (context ? `${context} – hình ${counter}` : `Hình minh họa ${counter}`) } };
  });
  return { ...doc, content: content ?? [] };
}
