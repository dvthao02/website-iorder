import { requireAdminPermission } from "@/lib/admin-guard";
import { PublishingConfigEditor } from "@/components/admin/publishing-config-editor";
import { SettingsDetailPage } from "@/components/admin/settings-detail-page";
import { getPublishingConfig, getPublishingConfigVersion } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function SeoSettingsPage() {
  await requireAdminPermission("settings.view");
  return <SettingsDetailPage
    description="Thiết lập tên miền chính thức, lập chỉ mục và thông tin hiển thị khi chia sẻ liên kết."
    eyebrow="Cài đặt"
    title="Tên miền & SEO"
  ><PublishingConfigEditor initial={await getPublishingConfig()} initialVersion={await getPublishingConfigVersion()} /></SettingsDetailPage>;
}
