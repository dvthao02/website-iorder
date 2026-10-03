import { CatalogContentEditor } from "@/components/admin/catalog-content-editor";
import { SettingsDetailPage } from "@/components/admin/settings-detail-page";
import { getCatalogContent } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function CatalogTitlesPage() {
  return <SettingsDetailPage
    description="Cập nhật dòng giới thiệu, tiêu đề và mô tả của trang Phần mềm, Giải pháp và Dịch vụ."
    eyebrow="Cài đặt"
    title="Tiêu đề trang catalog"
  ><CatalogContentEditor initial={await getCatalogContent()} /></SettingsDetailPage>;
}
