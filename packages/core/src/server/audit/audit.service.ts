import { listAuditLogs, listAuditLogsPage } from "./audit.repository";
import { auditListQuerySchema } from "./audit.contract";

export async function getRecentAuditLogs() { return listAuditLogs(); }
export async function getAuditLogsPage(input: unknown) { return listAuditLogsPage(auditListQuerySchema.parse(input)); }
