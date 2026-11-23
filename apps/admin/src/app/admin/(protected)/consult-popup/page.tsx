import { requireAdminPermission } from "@/lib/admin-guard";
import { ConsultFormEditor } from "@/components/admin/consult-form-editor";
import { SettingsDetailPage } from "@/components/admin/settings-detail-page";
import { getConsultForm, getConsultFormVersion, getPromotionPopup } from "@/lib/backend";
import { defaultPromotionPopup } from "@iorder/shared/server/settings/consult-popup.contract";

export const dynamic = "force-dynamic";

export default async function ConsultPopupPage() {
  await requireAdminPermission("settings.view");
  const [form, version, promotion] = await Promise.all([getConsultForm(), getConsultFormVersion(), getPromotionPopup()]);
  return <SettingsDetailPage
    bare
    description="Thu họ tên, số điện thoại và nhu cầu của khách. Cấu hình này không ảnh hưởng tới quảng cáo."
    eyebrow="Khách hàng tiềm năng"
    title="Biểu mẫu tư vấn"
  ><ConsultFormEditor initial={form} initialVersion={version} promotionEnabled={(promotion ?? defaultPromotionPopup).enabled} /></SettingsDetailPage>;
}
