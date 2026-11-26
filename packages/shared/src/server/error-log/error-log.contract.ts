import { z } from "zod";

import { adminListQuerySchema, createAdminListPageSchema } from "../shared/admin-list.contract";

// Lỗi đã được logger tuần tự hóa (serializeError): tên, câu báo lỗi, vài dòng stack đầu, và trường riêng của database (mã lỗi, ràng buộc, bảng…).
export const logErrorSchema = z.object({
  name: z.string().optional(),
  message: z.string().optional(),
  code: z.union([z.string(), z.number()]).optional(),
  severity: z.string().optional(),
  constraint_name: z.string().optional(),
  table_name: z.string().optional(),
  column_name: z.string().optional(),
  routine: z.string().optional(),
  digest: z.string().optional(),
  stack: z.array(z.string()).max(30).optional(),
  get cause() { return logErrorSchema.optional(); },
});
export type LogError = z.infer<typeof logErrorSchema>;

/** Nội dung cột JSONB `error_logs.details`: lỗi gốc cùng các trường kèm theo dòng log (đã che khóa nhạy cảm, không có giá trị tham số SQL). */
export const errorLogDetailsSchema = z.object({
  error: logErrorSchema.optional(),
  context: z.record(z.string(), z.unknown()).default({}),
});
export type ErrorLogDetails = z.infer<typeof errorLogDetailsSchema>;

export const errorLogListQuerySchema = adminListQuerySchema;
export type ErrorLogListQuery = z.infer<typeof errorLogListQuerySchema>;

export const errorLogItemSchema = z.object({
  id: z.string().uuid(),
  message: z.string(),
  errorName: z.string().nullable(),
  errorMessage: z.string().nullable(),
  method: z.string().nullable(),
  path: z.string().nullable(),
  requestId: z.string().nullable(),
  occurrences: z.number().int().positive(),
  firstSeenAt: z.date(),
  lastSeenAt: z.date(),
  details: errorLogDetailsSchema,
});
export type ErrorLogItem = z.infer<typeof errorLogItemSchema>;
export const errorLogListPageSchema = createAdminListPageSchema(errorLogItemSchema);
export type ErrorLogListPage = z.infer<typeof errorLogListPageSchema>;

// Xóa nhật ký lỗi (chỉ Super Admin, xem apps/api/src/lib/admin-permission.ts): một dòng đã đọc xong, hoặc toàn bộ để bắt đầu lại sau khi sửa lỗi.
export const errorLogClearRequestSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("one"), id: z.string().uuid() }).strict(),
  z.object({ mode: z.literal("all") }).strict(),
]);
export type ErrorLogClearRequest = z.infer<typeof errorLogClearRequestSchema>;
