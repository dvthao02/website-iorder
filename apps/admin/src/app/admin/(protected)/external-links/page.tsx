import { requireAdminPermission } from "@/lib/admin-guard";
import { ExternalLinksEditor } from "@/components/admin/external-links-editor";
import { SettingsDetailPage } from "@/components/admin/settings-detail-page";
import { getExternalLinks, getExternalLinksVersion } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function ExternalLinksPage() {
  await requireAdminPermission("settings.view");
  return <SettingsDetailPage
    description="Quản lý các liên kết ứng dụng và mạng xã hội xuất hiện ở chân trang hoặc nút kêu gọi hành động. Điền URL đầy đủ, ví dụ https://ten-mien.vn. Để trống dịch vụ chưa sử dụng."
    eyebrow="Cài đặt"
    title="Liên kết & Mạng xã hội"
  ><ExternalLinksEditor initial={await getExternalLinks()} initialVersion={await getExternalLinksVersion()} /></SettingsDetailPage>;
}
