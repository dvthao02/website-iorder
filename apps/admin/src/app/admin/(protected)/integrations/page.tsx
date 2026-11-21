import { requireSuperAdmin } from "@/lib/admin-guard";
import { IntegrationSecretsPanel } from "@/components/admin/integration-secrets-panel";
import { AdminPage } from "@/components/admin/ui/admin-page";
import { AdminPageBarHelp } from "@/components/admin/ui/admin-page-bar";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  await requireSuperAdmin();
  return <AdminPage>
    <h1 className="sr-only">Kết nối &amp; khóa API</h1>
    <AdminPageBarHelp>Nhập khóa API cho các kết nối (Google Search Console, Umami) ngay trong CMS, không cần sửa tệp cấu hình trên máy chủ. Chỉ Super Admin, mỗi thay đổi cần nhập lại mật khẩu của bạn.</AdminPageBarHelp>
    <IntegrationSecretsPanel />
  </AdminPage>;
}
