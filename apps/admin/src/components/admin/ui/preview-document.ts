import { pageBlockInputSchema } from "@iorder/shared/server/pages/pages.contract";

// Thành phần đang soạn dở làm tài liệu xem trước không hợp lệ theo schema, và khi đó cả canvas đứng yên ở lần hợp lệ cuối
// (bên trái đã sửa nhưng bên phải không đổi). Ví dụ: vừa thêm một câu hỏi (đáp án còn trống), vừa thêm điểm nổi bật rồi xóa chữ, khối Hình ảnh chưa chọn ảnh.
// Bản xem trước vì vậy dùng bản "đã làm hợp lệ" của tài liệu, vị trí mọi khối và mục con giữ nguyên nên chỉ số trên canvas vẫn khớp với form:
//  - ô chữ bắt buộc đang trống được điền tạm "…" (chỉ trong bản xem trước, form giữ nguyên);
//  - khối Hình ảnh chưa chọn ảnh, khối Video chưa có link được thay bằng một khối ẩn.
// Lỗi khác (sai định dạng link, giá trị ngoài danh sách…) vẫn giữ nguyên để canvas báo "chưa đủ thông tin".
const hiddenWhenIncomplete = new Set(["image", "video"]);
const hiddenPlaceholder = { type: "rich_text", isEnabled: false, data: { heading: null, body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Đang soạn" }] }] } } };
const blankMark = "…";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function read(root: unknown, path: ReadonlyArray<PropertyKey>) {
  let value = root;
  for (const key of path) value = isRecord(value) ? Reflect.get(value, key) : undefined;
  return value;
}

function write(root: unknown, path: ReadonlyArray<PropertyKey>, next: string) {
  const parent = read(root, path.slice(0, -1));
  const key = path.at(-1);
  if (isRecord(parent) && key !== undefined) Reflect.set(parent, key, next);
}

// Điền tạm các ô chữ bắt buộc còn trống; trả về null nếu vẫn không hợp lệ vì lý do khác.
function repairBlankText(block: unknown) {
  const copy = structuredClone(block);
  for (let round = 0; round < 8; round += 1) {
    const result = pageBlockInputSchema.safeParse(copy);
    if (result.success) return copy;
    let changed = false;
    for (const issue of result.error.issues) {
      if (issue.code === "too_small" && issue.origin === "string" && issue.path.length && read(copy, issue.path) === "") { write(copy, issue.path, blankMark); changed = true; }
    }
    if (!changed) return null;
  }
  return null;
}

function previewBlocks(blocks: unknown[]) {
  return blocks.map((block) => {
    if (!isRecord(block) || pageBlockInputSchema.safeParse(block).success) return block;
    if (typeof block.type === "string" && hiddenWhenIncomplete.has(block.type)) return hiddenPlaceholder;
    return repairBlankText(block) ?? block;
  });
}

export function previewReadyDocument(document: unknown): unknown {
  if (!isRecord(document) || !isRecord(document.values)) return document;
  const { values } = document;
  if ((document.kind === "page" || document.kind === "equipment") && Array.isArray(values.blocks)) return { ...document, values: { ...values, blocks: previewBlocks(values.blocks) } };
  if (document.kind === "offering" && isRecord(values.content) && Array.isArray(values.content.blocks)) return { ...document, values: { ...values, content: { ...values.content, blocks: previewBlocks(values.content.blocks) } } };
  return document;
}

// Số thứ tự (từ 1) của thành phần đầu tiên chưa hoàn chỉnh trong tài liệu, theo đường dẫn lỗi của schema; không xác định được thì null.
export function incompleteBlockNumber(path: ReadonlyArray<PropertyKey>): number | null {
  const at = path.findIndex((part) => part === "blocks");
  const index = at >= 0 ? path[at + 1] : undefined;
  return typeof index === "number" ? index + 1 : null;
}
