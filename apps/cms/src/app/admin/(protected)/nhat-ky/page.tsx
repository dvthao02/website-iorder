import { AuditLogTable } from "@/components/admin/audit-log-table";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { getRecentAuditLogs } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  const entries = await getRecentAuditLogs();

  return <main className="mx-auto max-w-7xl p-5 md:p-8">
    <AdminCard className="p-4"><AuditLogTable entries={entries} /></AdminCard>
  </main>;
}
