import { BackupManager } from "@/components/admin/backup-manager";
import { BackupStatusCard } from "@/components/admin/backup-status-card";
import { AdminPageBarMeta } from "@/components/admin/ui/admin-page-bar";
import { requireAdminPermission } from "@/lib/admin-guard";
import { getBackupOverview } from "@/lib/backend";

export const dynamic = "force-dynamic";

const stateLabels = { ok: "Đang ổn", stale: "Quá hạn", failed: "Lần gần nhất bị lỗi", never: "Chưa có bản sao lưu" } as const;

export default async function BackupPage() {
  await requireAdminPermission("settings.view");
  const overview = await getBackupOverview();
  if (!overview) return null;
  return <main className="admin-page">
    <h1 className="sr-only">Sao lưu & phục hồi</h1>
    <AdminPageBarMeta>{stateLabels[overview.status.state]} · {overview.history.length} lần gần đây</AdminPageBarMeta>
    <div className="admin-backup__layout">
      <BackupManager history={overview.history} />
      <aside><BackupStatusCard status={overview.status} /></aside>
    </div>
  </main>;
}
