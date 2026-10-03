import { PublishingConfigEditor } from "@/components/admin/publishing-config-editor";
import { SettingsDetailPage } from "@/components/admin/settings-detail-page";
import { getPublishingConfig } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function SeoSettingsPage() {
  return <SettingsDetailPage
    description="Thiết lập tên miền chính thức, lập chỉ mục và thông tin hiển thị khi chia sẻ liên kết."
    eyebrow="Cài đặt"
    title="SEO & Xuất bản"
  ><PublishingConfigEditor initial={await getPublishingConfig()} /></SettingsDetailPage>;
}
