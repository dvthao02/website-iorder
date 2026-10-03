import { ExternalLinksEditor } from "@/components/admin/external-links-editor";
import { SettingsDetailPage } from "@/components/admin/settings-detail-page";
import { getExternalLinks } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function ExternalLinksPage() {
  return <SettingsDetailPage
    description="Quản lý các liên kết ứng dụng và mạng xã hội xuất hiện ở Footer hoặc nút kêu gọi hành động."
    eyebrow="Cài đặt"
    title="Liên kết ngoài"
  ><ExternalLinksEditor initial={await getExternalLinks()} /></SettingsDetailPage>;
}
