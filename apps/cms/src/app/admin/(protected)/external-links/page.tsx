import { requireAdminPermission } from "@/lib/admin-guard";
import { ExternalLinksEditor } from "@/components/admin/external-links-editor";
import { SettingsDetailPage } from "@/components/admin/settings-detail-page";
import { getExternalLinks, getExternalLinksVersion } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function ExternalLinksPage() {
  await requireAdminPermission("settings.view");
  return <SettingsDetailPage
    description="Quản lý các liên kết ứng dụng và mạng xã hội xuất hiện ở Footer hoặc nút kêu gọi hành động."
    eyebrow="Cài đặt"
    title="Liên kết & Mạng xã hội"
  ><ExternalLinksEditor initial={await getExternalLinks()} initialVersion={await getExternalLinksVersion()} /></SettingsDetailPage>;
}
