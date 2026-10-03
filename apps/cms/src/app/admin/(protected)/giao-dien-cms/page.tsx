import { AdminThemeSettings } from "@/components/admin/admin-theme-settings";
import { SettingsDetailPage } from "@/components/admin/settings-detail-page";

export default function CmsAppearancePage() {
  return <SettingsDetailPage
    description="Chọn màu sắc và chế độ hiển thị phù hợp khi bạn làm việc trong CMS."
    eyebrow="Cài đặt"
    title="Giao diện CMS"
  ><AdminThemeSettings /></SettingsDetailPage>;
}
