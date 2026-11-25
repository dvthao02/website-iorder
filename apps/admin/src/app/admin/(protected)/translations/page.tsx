import { requireAdminPermission } from "@/lib/admin-guard";
import { SettingsDetailPage } from "@/components/admin/settings-detail-page";
import { TranslationsManager } from "@/components/admin/translations-manager";
import { getTranslationOverview } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function TranslationsPage() {
  await requireAdminPermission("settings.view");
  return <SettingsDetailPage
    bare
    description="Dịch nội dung website sang ngôn ngữ khác mà không đổi đường dẫn: xuất file mẫu, điền bản dịch, nhập lại. Câu nào chưa dịch vẫn hiện tiếng Việt."
    eyebrow="Cài đặt"
    title="Đa ngôn ngữ"
  ><TranslationsManager overview={await getTranslationOverview()} /></SettingsDetailPage>;
}
