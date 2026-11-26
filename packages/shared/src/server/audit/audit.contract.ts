import { z } from "zod";
import { adminListQuerySchema, listDateSchema } from "../shared/admin-list.contract";

// Nhóm thao tác theo động từ cuối mã (post.create → create; user.login_failed → login_failed).
export const auditVerbs = ["create", "update", "delete", "archive", "restore", "status_update", "upload", "export", "login", "login_failed", "logout", "password_change"] as const;

export const auditListQuerySchema = adminListQuerySchema.extend({
  entityType: z.string().trim().max(100).default(""),
  userId: z.string().uuid().optional().catch(undefined),
  verb: z.enum(auditVerbs).optional().catch(undefined),
  from: listDateSchema,
  to: listDateSchema,
});
export const auditActorSchema = z.object({ id: z.string().uuid(), fullName: z.string(), username: z.string() });
export type AuditListQuery = z.infer<typeof auditListQuerySchema>;
export const auditListPageSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(), action: z.string(), entityType: z.string(), entityId: z.string().uuid().nullable(),
    createdAt: z.date(), userName: z.string().nullable(), userUsername: z.string().nullable(),
    ipAddress: z.string().nullable(), userAgent: z.string().nullable(), requestId: z.string().nullable(),
    // Tên trường khác nhau giữa dữ liệu trước/sau (chỉ khi cả hai là object).
    changedFields: z.array(z.string()),
  })),
  page: z.number().int().positive(), pageSize: z.number().int().min(5).max(100),
  total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), totalPages: z.number().int().positive(),
}).superRefine((value, ctx) => {
  const expected = Math.max(0, Math.min(value.pageSize, value.total - (value.page - 1) * value.pageSize));
  if (value.totalPages !== Math.max(1, Math.ceil(value.total / value.pageSize)) || value.items.length !== expected || new Set(value.items.map(row => row.id)).size !== value.items.length) {
    ctx.addIssue({ code: "custom", message: "Phản hồi phân trang nhật ký không nhất quán." });
  }
});

// --- Dọn nhật ký (chỉ Super Admin) ---
// Bộ lọc khi xóa theo bộ lọc: nghiêm ngặt, KHÔNG như bộ lọc xem danh sách (ở đó giá trị sai bị bỏ qua cho dễ dùng, còn khi xóa
// một giá trị sai bị bỏ qua sẽ làm phạm vi xóa rộng hơn người dùng thấy).
const purgeDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00+07:00`)));
export const auditPurgeFilterSchema = z.object({
  query: z.string().trim().max(160).default(""),
  entityType: z.string().trim().max(100).default(""),
  userId: z.string().uuid().optional(),
  verb: z.enum(auditVerbs).optional(),
  from: purgeDate.optional(),
  to: purgeDate.optional(),
}).strict().refine((filter) => Boolean(filter.query || filter.entityType || filter.userId || filter.verb || filter.from || filter.to), { message: "Bộ lọc rỗng: muốn xóa toàn bộ nhật ký, chọn \"toàn bộ\"." });
export type AuditPurgeFilter = z.infer<typeof auditPurgeFilterSchema>;

export const auditPurgeDays = [1, 7, 30, 90, 180, 365] as const;
const dryRun = z.boolean().default(false);
// dryRun: chỉ đếm số dòng sẽ bị xóa (để hộp xác nhận cho biết trước), không xóa gì.
export const auditPurgeRequestSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("selected"), ids: z.array(z.string().uuid()).min(1).max(200), dryRun }).strict(),
  z.object({ mode: z.literal("filtered"), filter: auditPurgeFilterSchema, dryRun }).strict(),
  z.object({ mode: z.literal("older_than"), days: z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(90), z.literal(180), z.literal(365)]), dryRun }).strict(),
  z.object({ mode: z.literal("all"), dryRun }).strict(),
]);
export type AuditPurgeRequest = z.infer<typeof auditPurgeRequestSchema>;
