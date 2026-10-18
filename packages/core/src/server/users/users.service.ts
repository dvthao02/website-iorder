import { hashPassword } from "@iorder/core/server/auth/password";
import { cmsUserInputSchema, cmsUserListPageSchema, cmsUserListQuerySchema } from "./users.contract";
import { listCmsUsersPage, writeCmsUser } from "./users.repository";

export async function getCmsUsersPage(input: unknown) { return cmsUserListPageSchema.parse(await listCmsUsersPage(cmsUserListQuerySchema.parse(input))); }
export async function saveCmsUser(id: string | null, input: unknown, actorId: string) {
  const { password, ...values } = cmsUserInputSchema.parse(input);
  const passwordHash = password ? await hashPassword(password) : undefined;
  return writeCmsUser(id, { ...values, ...(passwordHash ? { passwordHash } : {}) }, actorId);
}
