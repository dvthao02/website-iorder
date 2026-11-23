import { listAuditActors, listAuditLogs, listAuditLogsPage, purgeAuditLogRows, type AuditPurgeScope } from "./audit.repository";
import { auditListQuerySchema, auditPurgeRequestSchema } from "./audit.contract";

export async function getRecentAuditLogs() { return listAuditLogs(); }
export async function getAuditLogsPage(input: unknown) { return listAuditLogsPage(auditListQuerySchema.parse(input)); }
export async function getAuditActors() { return listAuditActors(); }

/**
 * Dọn nhật ký hoạt động (chỉ Super Admin gọi được, xem route): theo các dòng đã chọn, theo bộ lọc đang áp dụng, các dòng
 * cũ hơn N ngày, hoặc toàn bộ. Luôn để lại dòng audit.purge; dryRun chỉ đếm. Không có thao tác sửa nội dung từng dòng:
 * nhật ký chỉ có ý nghĩa khi không ai chỉnh được nội dung đã ghi.
 */
export async function purgeAuditLogs(input: unknown, actorId: string, now = new Date()) {
  const request = auditPurgeRequestSchema.parse(input);
  const scope: AuditPurgeScope = request.mode === "selected" ? { mode: "selected", ids: [...new Set(request.ids)] }
    : request.mode === "filtered" ? { mode: "filtered", filter: request.filter }
    : request.mode === "older_than" ? { mode: "older_than", days: request.days, cutoff: new Date(now.getTime() - request.days * 86_400_000) }
    : { mode: "all" };
  const { affected } = await purgeAuditLogRows({ scope, dryRun: request.dryRun, actorId });
  return { affected, dryRun: request.dryRun };
}
