import { createHash } from "node:crypto";

// Tìm và thay các chuỗi cần dịch trong nội dung công khai (JSON do Backend trả về), không phụ thuộc cấu trúc từng loại nội dung:
// chỉ chuỗi nằm ở trường có tên trong danh sách `translatableKeys` mới tính. Cùng một hàm duyệt dùng cho cả hai việc (liệt kê chuỗi để xuất file,
// và thay bằng bản dịch khi trả về cho website) nên hai bên luôn thấy đúng cùng một tập chuỗi.
//
// Khóa của một chuỗi là mã băm của chính câu tiếng Việt (bỏ khoảng trắng đầu/cuối), không phải vị trí: đổi thứ tự khối, chèn thêm khối hay
// một câu xuất hiện ở nhiều trang đều không làm lệch bản dịch; câu tiếng Việt bị sửa thì thành một khóa mới (chưa dịch) chứ không bao giờ
// hiện sai bản dịch cũ dưới câu mới.

/** Tên trường chứa chữ người đọc thấy. Trường kỹ thuật (href, slug, id, icon, layout, màu…) không có ở đây nên không bao giờ bị đụng tới. */
export const translatableKeys: ReadonlySet<string> = new Set([
  // Chữ chung của khối và trang
  "title", "description", "eyebrow", "label", "name", "text", "heading", "subtitle", "caption", "footnote", "note", "meta", "badge", "quote", "placeholder",
  "summary", "excerpt", "category", "alt", "altText", "coverAlt",
  // Danh sách chữ (mỗi phần tử là một chuỗi) và hỏi đáp
  "bullets", "features", "benefits", "metrics", "tags", "needOptions", "faq", "question", "answer",
  // Catalog (phần mềm, giải pháp, thiết bị)
  "bestFor", "keyValue", "groupName", "groupLabel", "price", "period", "value",
  // Biểu mẫu và nút
  "submitLabel", "trialTitle", "trialLabel", "actionLabel",
  // Đánh giá khách hàng, tác giả
  "authorRole", "company",
  // SEO và thông tin công ty
  "seoTitle", "seoDescription", "defaultTitle", "defaultDescription", "address", "workingHours",
]);

const maxUnitLength = 8000;
// Đường dẫn/neo ("/support/guides", "#tu-van") chỉ gồm ký tự an toàn của URL, không khoảng trắng và không chữ có dấu; "/Năm", "/3 Năm" (đơn vị giá) vẫn là chữ cần dịch.
const nonTextPattern = /^(?:https?:|mailto:|tel:)|^[/#][\w\-.~:/?#[\]@!$&'()*+,;=%]*$/i;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const filePattern = /^[\w.-]+\.(png|jpe?g|webp|gif|svg|pdf|zip|docx?|xlsx?)$/i;

/** Tách khoảng trắng đầu/cuối (nhất là ở đoạn chữ trong bài: "Bấm " + "Lưu") để bản dịch được gắn lại đúng chỗ. */
export function splitUnit(raw: string) {
  const lead = raw.match(/^\s*/)?.[0] ?? "";
  const trail = raw.slice(lead.length).match(/\s*$/)?.[0] ?? "";
  return { lead, core: raw.slice(lead.length, raw.length - trail.length), trail };
}

/** Chuỗi có đáng dịch không: có chữ cái, không phải đường dẫn, địa chỉ email, mã định danh hay tên tệp. */
export function isTranslatableText(core: string) {
  if (core.length < 2 || core.length > maxUnitLength) return false;
  if (!/\p{L}/u.test(core)) return false;
  return !(nonTextPattern.test(core) || uuidPattern.test(core) || emailPattern.test(core) || filePattern.test(core));
}

/** Khóa ổn định của một câu tiếng Việt (16 ký tự thập lục phân). */
export function sourceKey(core: string) {
  return createHash("sha256").update(core.normalize("NFC")).digest("hex").slice(0, 16);
}

/** Trả về bản dịch cho `core` (đã bỏ khoảng trắng đầu/cuối), hoặc undefined để giữ nguyên. `place` là đường dẫn của chuỗi, để liệt kê "dùng ở đâu". */
export type UnitVisitor = (core: string, place: string) => string | undefined;

type Plain = Record<string, unknown>;

// Chỉ duyệt mảng và đối tượng thuần (JSON); ngày, Buffer… giữ nguyên.
function isPlain(value: unknown): value is Plain {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function translateString(value: string, place: string, visit: UnitVisitor) {
  const { lead, core, trail } = splitUnit(value);
  if (!isTranslatableText(core)) return value;
  const translated = visit(core, place);
  return translated === undefined ? value : `${lead}${translated}${trail}`;
}

// Đoạn văn / tiêu đề trong bài viết: nếu chỉ gồm chữ trơn (không đậm, nghiêng, liên kết) thì dịch cả đoạn như một câu để bản dịch tự nhiên.
// Đoạn có định dạng xen giữa thì để từng mảnh chữ tự dịch riêng (giữ nguyên đậm/nghiêng/liên kết, đổi lại là mảnh nhỏ hơn).
function translateParagraph(node: Plain, place: string, visit: UnitVisitor): Plain | undefined {
  if ((node.type !== "paragraph" && node.type !== "heading") || !Array.isArray(node.content) || node.content.length === 0) return undefined;
  const plainText = node.content.every((child) => isPlain(child) && child.type === "text" && typeof child.text === "string" && !(Array.isArray(child.marks) && child.marks.length));
  if (!plainText) return undefined;
  const { lead, core, trail } = splitUnit((node.content as Plain[]).map((child) => child.text as string).join(""));
  if (!isTranslatableText(core)) return node;
  const translated = visit(core, place);
  return translated === undefined ? node : { ...node, content: [{ type: "text", text: `${lead}${translated}${trail}` }] };
}

function walk(value: unknown, key: string, place: string, visit: UnitVisitor): unknown {
  if (typeof value === "string") return translatableKeys.has(key) ? translateString(value, place, visit) : value;
  // Mảng kế thừa tên trường của cha: `bullets: ["a", "b"]` và `faq: [["hỏi", "đáp"]]` đều là chữ cần dịch.
  if (Array.isArray(value)) return value.map((item, index) => walk(item, key, `${place}.${index}`, visit));
  if (!isPlain(value)) return value;
  const paragraph = translateParagraph(value, place, visit);
  if (paragraph) return paragraph;
  return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, walk(item, name, `${place}.${name}`, visit)]));
}

/**
 * Duyệt toàn bộ chuỗi cần dịch trong `value` và thay bằng kết quả của `visit` (trả undefined thì giữ nguyên). Không sửa `value` gốc.
 * `scope` là tên nội dung (ví dụ "page:home") đứng đầu đường dẫn của từng chuỗi.
 */
export function mapTranslatable<T>(value: T, visit: UnitVisitor, scope = ""): T {
  return walk(value, "", scope, visit) as T;
}
