import { hasCmsPermission, type CmsActor } from "@iorder/shared/server/auth/permissions";
import { getPublishingConfig } from "@iorder/shared/server/settings/publishing.service";
import { auditSeo } from "./seo-audit";
import { listSeoAuditEntries } from "./seo-audit.repository";

// Chỉ kiểm module người xem có quyền xem; trùng lặp vì thế chỉ so trong phạm vi đó.
// Địa chỉ website (Cài đặt xuất bản) dùng để so canonical với địa chỉ thật của từng trang.
export async function getSeoAudit(actor: CmsActor) {
  const can = (permission: Parameters<typeof hasCmsPermission>[1]) => hasCmsPermission(actor, permission);
  const [entries, config] = await Promise.all([
    listSeoAuditEntries({ pages: can("pages.view"), posts: can("posts.view"), offerings: can("offerings.view"), equipment: can("equipment.view") }),
    getPublishingConfig(),
  ]);
  return auditSeo(entries, { siteUrl: config.siteUrl });
}
