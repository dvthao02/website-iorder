import { z } from "zod";

export const cmsRoleSchema = z.enum(["admin", "editor"]);
export const cmsUserInputSchema = z.object({ username: z.string().trim().min(3).max(80).regex(/^[a-z0-9._-]+$/i), email: z.string().trim().email().max(320).nullable(), fullName: z.string().trim().min(1).max(180), role: cmsRoleSchema, status: z.enum(["active", "disabled"]), password: z.string().min(10).max(1_024).nullable() }).strict();
export const cmsUserRequestSchema = z.object({ id: z.string().uuid().nullable(), values: cmsUserInputSchema }).strict().superRefine((value, context) => { if (!value.id && !value.values.password) context.addIssue({ code: "custom", path: ["values", "password"], message: "Tài khoản mới cần mật khẩu." }); });
export type CmsUserInput = z.infer<typeof cmsUserInputSchema>;
