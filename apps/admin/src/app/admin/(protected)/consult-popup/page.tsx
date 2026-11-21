import { requireAdminPermission } from "@/lib/admin-guard";
import { ConsultPopupEditor } from "@/components/admin/consult-popup-editor";
import { SettingsDetailPage } from "@/components/admin/settings-detail-page";
import { getConsultPopup, getConsultPopupVersion } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function ConsultPopupPage() {
  await requireAdminPermission("settings.view");
  return <SettingsDetailPage
    description="Bật riêng biểu mẫu tư vấn, quảng cáo hoặc cả hai. Nội dung, phạm vi và tần suất đều chỉnh tại đây."
    eyebrow="Cài đặt"
    title="Cửa sổ tư vấn"
  ><ConsultPopupEditor initial={await getConsultPopup()} initialVersion={await getConsultPopupVersion()} /></SettingsDetailPage>;
}
