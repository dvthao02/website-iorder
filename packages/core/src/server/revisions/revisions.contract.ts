import { z } from "zod";

export const revisionTargetSchema = z.enum(["posts", "offerings", "pages", "equipment", "navigation", "downloads"]);
export const revisionHistoryResponseSchema = z.object({
  revisions: z.array(z.object({
    id: z.string().uuid(),
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    note: z.string().nullable(),
    snapshot: z.unknown().refine(value => value !== undefined),
    // Thời điểm lưu phiên bản (để hiển thị); dữ liệu cũ thiếu trường này vẫn hợp lệ.
    createdAt: z.string().optional(),
  })).superRefine((rows, context) => {
    if (new Set(rows.map(row => row.id)).size !== rows.length) {
      context.addIssue({ code: "custom", message: "Lịch sử có phiên bản trùng lặp." });
    }
  }),
});
export const restoreRevisionSchema = z.object({ revisionId: z.string().uuid(), expectedVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }).strict();
export type RevisionTarget = z.infer<typeof revisionTargetSchema>;
