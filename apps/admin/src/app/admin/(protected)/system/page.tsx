import { requireAdminPermission } from "@/lib/admin-guard";
import { SystemStatusPanel } from "@/components/admin/system-status-panel";
import { AdminPage } from "@/components/admin/ui/admin-page";
import { AdminPageBarHelp } from "@/components/admin/ui/admin-page-bar";

export const dynamic = "force-dynamic";

export default async function SystemStatusPage() {
  await requireAdminPermission("system.view");
  return <AdminPage>
    <h1 className="sr-only">Tình trạng hệ thống</h1>
    <AdminPageBarHelp>Theo dõi database, kho tệp, website, sao lưu, tác vụ định kỳ và tài nguyên máy chủ ở một chỗ. Chỉ xem, không thay đổi gì trên hệ thống.</AdminPageBarHelp>
    <SystemStatusPanel />
  </AdminPage>;
}
