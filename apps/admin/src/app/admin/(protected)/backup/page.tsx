import { isSuperAdmin } from "@iorder/shared/server/auth/permissions";
import { BackupManager } from "@/components/admin/backup-manager";
import { BackupStatusCard } from "@/components/admin/backup-status-card";
import { AdminPageBarMeta } from "@/components/admin/ui/admin-page-bar";
import { requireAdminPermission } from "@/lib/admin-guard";
import { getBackupOverview } from "@/lib/backend";

export const dynamic = "force-dynamic";

const stateLabels = { ok: "Đang ổn", stale: "Quá hạn", failed: "Lần gần nhất bị lỗi", never: "Chưa có bản sao lưu" } as const;

export default async function BackupPage() {
  const administrator = await requireAdminPermission("settings.view");
  const overview = await getBackupOverview();
  if (!overview) return null;
  return <main className="admin-page">
    <h1 className="sr-only">Sao lưu & phục hồi</h1>
    <AdminPageBarMeta>{stateLabels[overview.status.state]} · {overview.history.length} lần gần đây</AdminPageBarMeta>
    <div className="admin-backup__layout">
      {/* Sao lưu/phục hồi/lên lịch chỉ Super Admin bấm được (xem apps/api/src/lib/admin-permission.ts); người chỉ xem được cài đặt chỉ thấy lịch sử và trạng thái. */}
      <BackupManager canOperate={isSuperAdmin(administrator)} history={overview.history} scheduled={overview.scheduled} />
      <aside><BackupStatusCard status={overview.status} title="Tình trạng" /></aside>
    </div>
  </main>;
}
