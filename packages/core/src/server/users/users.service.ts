import { z } from "zod";
import { hashPassword } from "@iorder/core/server/auth/password";
import { cmsUserInputSchema, cmsUserListPageSchema, cmsUserListQuerySchema } from "./users.contract";
import { listCmsUsersPage, writeCmsUser } from "./users.repository";

export async function getCmsUsersPage(input: unknown) { return cmsUserListPageSchema.parse(await listCmsUsersPage(cmsUserListQuerySchema.parse(input))); }
export async function saveCmsUser(id: string | null, input: unknown, actorId: string) {
  const { password, ...values } = cmsUserInputSchema.parse(input);
  if (id === actorId && (values.role !== "admin" || values.status !== "active")) throw new z.ZodError([{ code: "custom", path: ["role"], message: "Không thể hạ quyền hoặc khóa chính tài khoản đang đăng nhập." }]);
  const passwordHash = password ? await hashPassword(password) : undefined;
  return writeCmsUser(id, { ...values, ...(passwordHash ? { passwordHash } : {}) }, actorId);
}
