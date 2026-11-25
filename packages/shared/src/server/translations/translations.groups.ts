/**
 * Vùng nội dung để chọn khi xuất file dịch (và để người dịch biết câu thuộc phần nào của website). Một câu dùng ở nhiều vùng thuộc về tất cả các vùng đó.
 * Thứ tự ở đây là thứ tự hiện trong CMS.
 */
export const translationGroups = [
  { id: "ui", label: "Chữ giao diện website" },
  { id: "site", label: "Thông tin chung và trang danh sách" },
  { id: "navigation", label: "Menu và chân trang" },
  { id: "pages", label: "Trang" },
  { id: "software", label: "Phần mềm" },
  { id: "solutions", label: "Giải pháp" },
  { id: "equipment", label: "Thiết bị" },
  { id: "news", label: "Bài viết: Tin tức" },
  { id: "promotion", label: "Bài viết: Khuyến mãi" },
  { id: "case-study", label: "Bài viết: Câu chuyện khách hàng" },
  { id: "announcement", label: "Bài viết: Thông báo" },
  { id: "guide", label: "Bài viết: Hướng dẫn" },
  { id: "taxonomy", label: "Chuyên mục và thẻ" },
  { id: "other", label: "Tải về, đối tác, đánh giá, tác giả" },
] as const;

export type TranslationGroupId = (typeof translationGroups)[number]["id"];
export const translationGroupIds = translationGroups.map((group) => group.id) as [TranslationGroupId, ...TranslationGroupId[]];

const groupIdSet = new Set<string>(translationGroupIds);
export const isTranslationGroupId = (value: unknown): value is TranslationGroupId => typeof value === "string" && groupIdSet.has(value);

export const translationGroupLabel = (id: string) => translationGroups.find((group) => group.id === id)?.label ?? id;

// Loại bài viết trong cơ sở dữ liệu (news, case_study…) → vùng. Loại lạ (thêm sau này mà chưa khai báo ở đây) rơi vào "other" thay vì mất khỏi file.
const postGroups: Record<string, TranslationGroupId> = { news: "news", promotion: "promotion", case_study: "case-study", announcement: "announcement", guide: "guide" };
export const postGroupId = (type: string): TranslationGroupId => postGroups[type] ?? "other";

/**
 * Đọc danh sách vùng từ tham số `?groups=ui,pages`. Không có (hoặc rỗng) nghĩa là mọi vùng; trả về `null` khi có mã vùng lạ để route báo lỗi rõ ràng.
 */
export function parseGroupSelection(raw: string | null | undefined): TranslationGroupId[] | null {
  const parts = (raw ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return [...translationGroupIds];
  if (!parts.every(isTranslationGroupId)) return null;
  return [...new Set(parts)] as TranslationGroupId[];
}
