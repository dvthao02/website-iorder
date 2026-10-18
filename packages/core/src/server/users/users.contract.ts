import { z } from "zod";
import { adminListQuerySchema } from "../shared/admin-list.contract";

export const cmsUserListQuerySchema = adminListQuerySchema.extend({
  status: z.enum(["all", "active", "disabled"]).default("all"),
  role: z.string().trim().min(1).max(80).regex(/^[a-z0-9_]+$/).default("all"),
});
export type CmsUserListQuery = z.infer<typeof cmsUserListQuerySchema>;
export const cmsUserListPageSchema = z.object({
  counts: z.object({ all: z.number().int().nonnegative(), active: z.number().int().nonnegative(), admins: z.number().int().nonnegative() }),
  items: z.array(z.object({
    id: z.string().uuid(), username: z.string().min(1).max(80), email: z.string().nullable(),
    fullName: z.string().min(1).max(180), status: z.enum(["active", "disabled"]), role: z.string().min(1).max(80), lastLoginAt: z.date().nullable(),
  })),
  page: z.number().int().positive(), pageSize: z.number().int().min(5).max(100),
  total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), totalPages: z.number().int().positive(),
}).superRefine((value, context) => {
  const expected = Math.max(0, Math.min(value.pageSize, value.total - (value.page - 1) * value.pageSize));
  if (value.totalPages !== Math.max(1, Math.ceil(value.total / value.pageSize)) || value.items.length !== expected || new Set(value.items.map(user => user.id)).size !== value.items.length || value.counts.admins > value.counts.active || value.counts.active > value.counts.all || value.total > value.counts.all) {
    context.addIssue({ code: "custom", message: "Phản hồi phân trang tài khoản không nhất quán." });
  }
});

export const cmsRoleSchema = z.string().trim().min(1).max(80).regex(/^[a-z0-9_]+$/);
export const cmsUserRoleOptionsSchema = z.array(z.object({ code: z.string().min(1).max(80), name: z.string().min(1).max(120), isSystem: z.boolean() }));
export type CmsUserRoleOption = z.infer<typeof cmsUserRoleOptionsSchema>[number];
export const cmsUserSaveResponseSchema = z.object({ id: z.string().uuid() });
export const cmsUserInputSchema = z.object({ username: z.string().trim().min(3).max(80).regex(/^[a-z0-9._-]+$/i), email: z.string().trim().email().max(320).nullable(), fullName: z.string().trim().min(1).max(180), role: cmsRoleSchema, status: z.enum(["active", "disabled"]), password: z.string().min(10).max(1_024).nullable() }).strict();
export const cmsUserRequestSchema = z.object({ id: z.string().uuid().nullable(), values: cmsUserInputSchema }).strict().superRefine((value, context) => { if (!value.id && !value.values.password) context.addIssue({ code: "custom", path: ["values", "password"], message: "Tài khoản mới cần mật khẩu." }); });
export type CmsUserInput = z.infer<typeof cmsUserInputSchema>;
