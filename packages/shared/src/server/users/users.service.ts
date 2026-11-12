import { hashPassword } from "@iorder/shared/server/auth/password";
import { cmsUserInputSchema, cmsUserListPageSchema, cmsUserListQuerySchema } from "./users.contract";
import { deleteCmsUser, listCmsUsersPage, writeCmsUser } from "./users.repository";
import { z } from "zod";

export async function getCmsUsersPage(input: unknown) { return cmsUserListPageSchema.parse(await listCmsUsersPage(cmsUserListQuerySchema.parse(input))); }
export async function saveCmsUser(id: string | null, input: unknown, actorId: string) {
  const { password, ...values } = cmsUserInputSchema.parse(input);
  const passwordHash = password ? await hashPassword(password) : undefined;
  return writeCmsUser(id, { ...values, ...(passwordHash ? { passwordHash } : {}) }, actorId);
}
export async function removeCmsUser(id: string, actorId: string) {
  return z.string().uuid().safeParse(id).success ? deleteCmsUser(id, actorId) : undefined;
}
