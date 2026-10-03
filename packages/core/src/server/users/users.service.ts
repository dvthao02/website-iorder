import { z } from "zod";
import { hashPassword } from "@iorder/core/server/auth/password";
import { cmsRoleSchema, cmsUserInputSchema } from "./users.contract";
import { activeAdminCount, listCmsUsers, writeCmsUser } from "./users.repository";

export async function getCmsUsers() { return (await listCmsUsers()).map(user => ({ ...user, role: cmsRoleSchema.parse(user.role) })); }
export async function saveCmsUser(id: string | null, input: unknown, actorId: string) { const values = cmsUserInputSchema.parse(input); if (id === actorId && (values.role !== "admin" || values.status !== "active")) throw new z.ZodError([{ code: "custom", path: ["role"], message: "Không thể hạ quyền hoặc khóa chính tài khoản đang đăng nhập." }]); if (id && (values.role !== "admin" || values.status !== "active") && await activeAdminCount() <= 1) throw new z.ZodError([{ code: "custom", path: ["role"], message: "Hệ thống phải luôn còn ít nhất một quản trị viên đang hoạt động." }]); const passwordHash = values.password ? await hashPassword(values.password) : undefined; return writeCmsUser(id, { ...values, ...(passwordHash ? { passwordHash } : {}) }, actorId); }
