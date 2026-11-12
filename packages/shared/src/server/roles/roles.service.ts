import { cmsRoleInputSchema, cmsRoleListSchema } from "./roles.contract";
import { deleteCmsRole, listCmsRoles, writeCmsRole } from "./roles.repository";

export async function getCmsRoles() { return cmsRoleListSchema.parse(await listCmsRoles()); }
export function saveCmsRole(id: string | null, input: unknown, actorId: string) { return writeCmsRole(id, cmsRoleInputSchema.parse(input), actorId); }
export function removeCmsRole(id: string, actorId: string) { return deleteCmsRole(id, actorId); }
