import { requireAdminPermission } from "@/lib/admin-guard";
import { PromotionPopupEditor } from "@/components/admin/promotion-popup-editor";
import { SettingsDetailPage } from "@/components/admin/settings-detail-page";
import { getConsultForm, getPromotionPopup, getPromotionPopupVersion } from "@/lib/backend";
import { defaultConsultForm } from "@iorder/shared/server/settings/consult-popup.contract";

export const dynamic = "force-dynamic";

export default async function PromotionPopupPage() {
  await requireAdminPermission("settings.view");
  const [promotion, version, form] = await Promise.all([getPromotionPopup(), getPromotionPopupVersion(), getConsultForm()]);
  return <SettingsDetailPage
    bare
    description="Tạo quảng cáo bằng ảnh hoặc nội dung và đặt lịch hiển thị riêng. Cấu hình này không ảnh hưởng tới biểu mẫu tư vấn."
    eyebrow="Quảng bá"
    title="Quảng cáo"
  ><PromotionPopupEditor formEnabled={(form ?? defaultConsultForm).enabled} initial={promotion} initialVersion={version} /></SettingsDetailPage>;
}
