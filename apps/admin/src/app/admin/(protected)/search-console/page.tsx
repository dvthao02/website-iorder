import { requireAdminPermission } from "@/lib/admin-guard";
import { SearchConsoleSettings } from "@/components/admin/search-console-settings";
import { SettingsDetailPage } from "@/components/admin/settings-detail-page";

export const dynamic = "force-dynamic";

export default async function SearchConsoleSettingsPage() {
  await requireAdminPermission("settings.view");
  return <SettingsDetailPage bare description="Nối Google Search Console để thấy khách gõ gì trên Google để tìm website. Chỉ đọc số liệu, không thay đổi gì trên Google." title="Google Search Console">
    <SearchConsoleSettings />
  </SettingsDetailPage>;
}
