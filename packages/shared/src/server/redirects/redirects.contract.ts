import { z } from "zod";
import { expectedVersionSchema } from "../shared/content-version";

const internalPath = z.string().trim().min(1).max(1_000).refine((value) => value.startsWith("/") && !value.startsWith("//") && !/[\\\u0000-\u0020\u007f]/.test(value), "Đường dẫn nội bộ phải bắt đầu bằng một dấu gạch chéo và không chứa khoảng trắng, ký tự điều khiển hoặc gạch chéo ngược.");

export const redirectInputSchema = z.object({
  sourcePath: internalPath.max(500).refine((value) => {
    try { return new URL(value, "https://redirect.invalid").pathname === value; } catch { return false; }
  }, "Đường dẫn nguồn phải ở dạng URL đã mã hóa, không có query, fragment hoặc đoạn . và .."),
  destinationPath: internalPath,
  statusCode: z.union([z.literal(301), z.literal(308)]),
  isEnabled: z.boolean(),
}).strict().superRefine((value, context) => {
  try {
    if (value.sourcePath === new URL(value.destinationPath, "https://redirect.invalid").pathname) context.addIssue({ code: "custom", path: ["destinationPath"], message: "Đích chuyển hướng phải khác đường dẫn nguồn, kể cả sau khi chuẩn hóa URL." });
  } catch {
    context.addIssue({ code: "custom", path: ["destinationPath"], message: "Đường dẫn đích không hợp lệ." });
  }
});

export const redirectRequestSchema = z.object({ id: z.string().uuid().nullable(), values: redirectInputSchema, expectedVersion: expectedVersionSchema.optional() }).strict().superRefine((value, context) => {
  if (value.id && value.expectedVersion === undefined) context.addIssue({ code: "custom", path: ["expectedVersion"], message: "Vui lòng tải lại để lấy phiên bản trước khi lưu." });
});
export type RedirectInput = z.infer<typeof redirectInputSchema>;

// Kết quả lưu chuyển hướng: các liên kết nội dung (menu, trang, bài viết…) đã tự đổi sang đường dẫn mới. API trả về, CMS dùng để báo người vận hành.
export const linkUpdateSummarySchema = z.object({
  links: z.number().int().nonnegative(),
  places: z.array(z.object({ label: z.string(), items: z.number().int().nonnegative(), links: z.number().int().nonnegative() })),
});
export type LinkUpdateSummary = z.infer<typeof linkUpdateSummarySchema>;
export type LinkUpdatePlace = LinkUpdateSummary["places"][number];

/** Câu báo sau khi lưu chuyển hướng; rỗng khi không có liên kết nào phải đổi. */
export function describeLinkUpdates(summary: LinkUpdateSummary) {
  if (!summary.links) return "";
  return `Đã đổi ${summary.links} liên kết trỏ tới đường dẫn cũ sang đường dẫn mới (${summary.places.map((place) => `${place.label}: ${place.items}`).join(", ")}).`;
}
