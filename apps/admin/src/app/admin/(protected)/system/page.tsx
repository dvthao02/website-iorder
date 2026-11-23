import { requireAdminPermission } from "@/lib/admin-guard";
import { SystemStatusPanel } from "@/components/admin/system-status-panel";
import { SettingsDetailPage } from "@/components/admin/settings-detail-page";

export const dynamic = "force-dynamic";

export default async function SystemStatusPage() {
  await requireAdminPermission("system.view");
  return <SettingsDetailPage bare description="Theo dõi database, kho tệp, website, sao lưu, tác vụ định kỳ và tài nguyên máy chủ ở một chỗ. Chỉ xem, không thay đổi gì trên hệ thống." title="Tình trạng hệ thống">
    <SystemStatusPanel />
  </SettingsDetailPage>;
}
