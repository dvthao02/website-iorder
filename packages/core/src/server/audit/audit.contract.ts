import { z } from "zod";
import { adminListQuerySchema } from "../shared/admin-list.contract";

export const auditListQuerySchema = adminListQuerySchema.extend({
  entityType: z.string().trim().max(100).default(""),
});
export type AuditListQuery = z.infer<typeof auditListQuerySchema>;
export const auditListPageSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(), action: z.string(), entityType: z.string(), entityId: z.string().uuid().nullable(),
    createdAt: z.date(), userName: z.string().nullable(), userUsername: z.string().nullable(),
  })),
  page: z.number().int().positive(), pageSize: z.number().int().min(5).max(100),
  total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), totalPages: z.number().int().positive(),
}).superRefine((value, ctx) => {
  const expected = Math.max(0, Math.min(value.pageSize, value.total - (value.page - 1) * value.pageSize));
  if (value.totalPages !== Math.max(1, Math.ceil(value.total / value.pageSize)) || value.items.length !== expected || new Set(value.items.map(row => row.id)).size !== value.items.length) {
    ctx.addIssue({ code: "custom", message: "Phản hồi phân trang nhật ký không nhất quán." });
  }
});
