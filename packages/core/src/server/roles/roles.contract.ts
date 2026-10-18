import { z } from "zod";

import { isCmsPermissionCode } from "../auth/permissions";

const permissionCodeSchema = z.string().refine(isCmsPermissionCode, "Quyền không hợp lệ.");

export const cmsRoleInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).transform((value) => value || null).nullable(),
  permissions: z.array(permissionCodeSchema).max(200).transform((codes) => [...new Set(codes)].sort()),
}).strict();

export const cmsRoleRequestSchema = z.object({ id: z.string().uuid().nullable(), values: cmsRoleInputSchema }).strict();
export const cmsRoleDeleteRequestSchema = z.object({ id: z.string().uuid() }).strict();

export const cmsRoleSchema = z.object({
  id: z.string().uuid(),
  code: z.string().max(80),
  name: z.string().max(120),
  description: z.string().max(500).nullable(),
  isSystem: z.boolean(),
  permissions: z.array(z.string()),
  userCount: z.number().int().nonnegative(),
});

export const cmsRoleListSchema = z.array(cmsRoleSchema);
export const cmsRoleSaveResponseSchema = z.object({ id: z.string().uuid() });

export type CmsRoleInput = z.infer<typeof cmsRoleInputSchema>;
export type CmsRole = z.infer<typeof cmsRoleSchema>;
