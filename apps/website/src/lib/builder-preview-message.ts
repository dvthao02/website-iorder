/**
 * Tin nhắn CMS gửi vào khung xem trước để tô sáng một khối: đúng loại, `index` là số nguyên trong [-19, 99], không có khóa thừa.
 * Trả về `index`, hoặc null nếu tin không hợp lệ.
 *
 * Viết tay thay vì dùng zod: BuilderPreviewBridge được layout import tĩnh nên mọi thứ nó import đều đi cùng bundle của MỌI trang website,
 * và zod một mình là ~30 KB gz (107 KB chưa nén) phải tải, phân tích và chạy trước khi trang hiện ra, chỉ để phục vụ khung xem trước trong CMS.
 */
export function parseHighlightMessage(data: unknown): number | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  if (Object.keys(record).length !== 2 || record.type !== "iorder:highlight-block") return null;
  const index = record.index;
  return typeof index === "number" && Number.isInteger(index) && index >= -19 && index <= 99 ? index : null;
}
