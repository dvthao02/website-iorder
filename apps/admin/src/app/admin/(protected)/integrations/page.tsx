import { requireSuperAdmin } from "@/lib/admin-guard";
import { IntegrationSecretsPanel } from "@/components/admin/integration-secrets-panel";
import { SettingsDetailPage } from "@/components/admin/settings-detail-page";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  await requireSuperAdmin();
  return <SettingsDetailPage bare description="Nhập thông tin để CMS nối với Umami, Google Search Console và Gmail, không cần sửa tệp cấu hình trên máy chủ. Chỉ Super Admin." title="Kết nối & khóa API">
    <IntegrationSecretsPanel />
  </SettingsDetailPage>;
}
