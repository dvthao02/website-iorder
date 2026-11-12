import { hasCmsPermission, type CmsActor } from "@iorder/shared/server/auth/permissions";
import { auditSeo } from "./seo-audit";
import { listSeoAuditEntries } from "./seo-audit.repository";

// Chỉ kiểm module người xem có quyền xem; trùng lặp vì thế chỉ so trong phạm vi đó.
export async function getSeoAudit(actor: CmsActor) {
  const can = (permission: Parameters<typeof hasCmsPermission>[1]) => hasCmsPermission(actor, permission);
  const entries = await listSeoAuditEntries({ pages: can("pages.view"), posts: can("posts.view"), offerings: can("offerings.view"), equipment: can("equipment.view") });
  return auditSeo(entries);
}
