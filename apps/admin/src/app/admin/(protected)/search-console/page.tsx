import { requireAdminPermission } from "@/lib/admin-guard";
import { SearchConsoleSettings } from "@/components/admin/search-console-settings";
import { AdminPage } from "@/components/admin/ui/admin-page";
import { AdminPageBarHelp } from "@/components/admin/ui/admin-page-bar";

export const dynamic = "force-dynamic";

export default async function SearchConsoleSettingsPage() {
  await requireAdminPermission("settings.view");
  return <AdminPage>
    <h1 className="sr-only">Google Search Console</h1>
    <AdminPageBarHelp>Nối Google Search Console để thấy khách gõ gì trên Google để tìm website. Chỉ đọc số liệu, không thay đổi gì trên Google.</AdminPageBarHelp>
    <SearchConsoleSettings />
  </AdminPage>;
}
