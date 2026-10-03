import { ListingContentEditor } from "@/components/admin/listing-content-editor";
import { SettingsDetailPage } from "@/components/admin/settings-detail-page";
import { getListingContent } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function ListingTitlesPage() {
  return <SettingsDetailPage
    description="Cập nhật dòng giới thiệu, tiêu đề và mô tả của trang Tin tức, Hỗ trợ, Thiết bị và Hướng dẫn."
    eyebrow="Cài đặt"
    title="Tiêu đề trang danh sách"
  ><ListingContentEditor initial={await getListingContent()} /></SettingsDetailPage>;
}
