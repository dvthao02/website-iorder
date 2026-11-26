import { GmailConnectionCard } from "@/components/admin/gmail-connection-card";
import { SettingsDetailPage } from "@/components/admin/settings-detail-page";
import { requireSuperAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export default async function GmailNotificationsPage() {
  await requireSuperAdmin();
  return <SettingsDetailPage bare description="Kết nối Gmail của bạn để CMS gửi thư báo mỗi khi có liên hệ mới từ website, kèm danh sách địa chỉ nhận bản sao (CC). Chỉ Super Admin." title="Gmail báo liên hệ">
    <div className="admin-status-stack admin-status-stack--wide"><GmailConnectionCard /></div>
  </SettingsDetailPage>;
}
