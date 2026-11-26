import { requireSuperAdmin } from "@/lib/admin-guard";
import { IntegrationSecretsPanel } from "@/components/admin/integration-secrets-panel";
import { SettingsDetailPage } from "@/components/admin/settings-detail-page";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  await requireSuperAdmin();
  return <SettingsDetailPage bare description="Nhập khóa API cho các kết nối (Google Search Console, Umami, mã khách Gmail) ngay trong CMS, không cần sửa tệp cấu hình trên máy chủ. Muốn bấm Kết nối Gmail và chọn người nhận thư báo liên hệ mới thì vào mục Gmail báo liên hệ. Chỉ Super Admin, mỗi thay đổi cần nhập lại mật khẩu của bạn." title="Kết nối & khóa API">
    <IntegrationSecretsPanel />
  </SettingsDetailPage>;
}
