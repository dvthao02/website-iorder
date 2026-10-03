import { listAuditLogs } from "./audit.repository";

export async function getRecentAuditLogs() { return listAuditLogs(); }
