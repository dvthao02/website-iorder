"use client";

import { useState } from "react";

import { defaultPromotionPopup, promotionPopupSchema, type PromotionPopupSettings } from "@iorder/shared/server/settings/consult-popup.contract";
import { MediaPicker } from "./media-picker";
import { PopupDisplayFields, PopupSiblingNote, PopupStatusSwitch } from "./popup-display-fields";
import { PromotionPreview } from "./popup-preview";
import { usePopupSettingEditor } from "./use-popup-setting-editor";
import { AdminButton } from "./ui/admin-button";
import { AdminEditorActions } from "./ui/admin-editor-actions";
import { AdminEditorSection } from "./ui/admin-editor-section";
import { AdminNotice } from "./ui/admin-feedback";
import { AdminFormField } from "./ui/admin-form-field";

type PromoLayout = PromotionPopupSettings["layout"];

const fields: Record<keyof PromotionPopupSettings, { label: string; message: string }> = {
  enabled: { label: "Trạng thái", message: "Chọn trạng thái quảng cáo." },
  layout: { label: "Mẫu hiển thị", message: "Chọn một mẫu hiển thị quảng cáo." },
  title: { label: "Tiêu đề", message: "Nhập tiêu đề quảng cáo, tối đa 120 ký tự." },
  description: { label: "Mô tả", message: "Mô tả quảng cáo tối đa 400 ký tự." },
  mediaId: { label: "Ảnh quảng cáo", message: "Chọn ảnh quảng cáo từ thư viện." },
  actionLabel: { label: "Chữ trên nút", message: "Nhập chữ trên nút quảng cáo, tối đa 60 ký tự." },
  actionUrl: { label: "Liên kết", message: "Nhập đường dẫn trong website, liên kết https://, tel: hoặc mailto:." },
  scrollPercent: { label: "Mức cuộn trang", message: "Nhập số từ 30 đến 100." },
  delaySeconds: { label: "Thời gian chờ", message: "Nhập số giây từ 0 đến 300." },
  repeatDays: { label: "Thời gian không hiện lại", message: "Nhập số ngày từ 0 đến 365." },
  scope: { label: "Trang hiển thị", message: "Chọn phạm vi hiển thị." },
};

const layoutChoices: Array<{ layout: PromoLayout; label: string; detail: string; description: string; badge?: string }> = [
  { layout: "card", label: "Thẻ tiêu chuẩn", detail: "Giữa màn hình · Ảnh phía trên", description: "Cân bằng ảnh, nội dung và nút; phù hợp đa số chiến dịch.", badge: "Khuyên dùng" },
  { layout: "split", label: "Chia đôi", detail: "Giữa màn hình · Ảnh bên trái", description: "Ảnh cạnh nội dung trên desktop, tự xếp dọc trên điện thoại." },
  { layout: "image", label: "Chỉ ảnh", detail: "Giữa màn hình · Toàn bộ là ảnh", description: "Dùng ảnh đã thiết kế hoàn chỉnh; bấm toàn bộ ảnh để mở liên kết." },
  { layout: "compact", label: "Thông báo gọn", detail: "Giữa màn hình · Không dùng ảnh", description: "Không dùng ảnh; tập trung vào thông điệp và một nút hành động." },
  { layout: "bar", label: "Thanh cuối màn hình", detail: "Cạnh dưới · Không phủ toàn trang", description: "Nằm sát cuối màn hình, không khóa cuộn và ít che nội dung." },
];

function PromoLayoutChoice({ badge, checked, description, detail, label, layout, onChange }: { badge?: string; checked: boolean; description: string; detail: string; label: string; layout: PromoLayout; onChange: () => void }) {
  return <label className={checked ? "admin-consult-popup__layout-choice admin-consult-popup__layout-choice--active" : "admin-consult-popup__layout-choice"} data-layout={layout} data-testid={`promotion-layout-${layout}`}>
    <input checked={checked} name="promotion-layout" onChange={onChange} type="radio" value={layout} />
    <span aria-hidden="true" className="admin-consult-popup__layout-preview" data-testid={`promotion-preview-${layout}`}>
      <span className="admin-consult-popup__preview-toolbar"><i /><i /><i /></span>
      <span className="admin-consult-popup__preview-canvas">
        <span className="admin-consult-popup__preview-page"><i /><i /><i /></span>
        <span className="admin-consult-popup__preview-window">
          <i className="admin-consult-popup__preview-media" />
          <span className="admin-consult-popup__preview-content"><i /><i /><i className="admin-consult-popup__preview-action" /></span>
        </span>
      </span>
    </span>
    <span className="admin-consult-popup__layout-copy"><span><strong>{label}</strong>{badge ? <em>{badge}</em> : null}</span><span className="admin-consult-popup__layout-detail">{detail}</span><small>{description}</small></span>
  </label>;
}

export function PromotionPopupEditor({ initial, initialVersion, formEnabled }: { initial: PromotionPopupSettings | null; initialVersion: number; formEnabled: boolean }) {
  const [uploading, setUploading] = useState(false);
  const { value: form, update, timingMode, setTimingMode, busy, locked, canUpdate, message, isDirty, save, discard, validation } = usePopupSettingEditor<PromotionPopupSettings>({
    endpoint: "/api/v1/admin/promotion-popup",
    responseKey: "promotion",
    schema: promotionPopupSchema,
    initial,
    fallback: defaultPromotionPopup,
    initialVersion,
    subject: "quảng cáo",
    formId: "promotion-popup",
    fields,
    pending: uploading,
  });
  const bannerOnly = form.layout === "image";
  const usesImage = form.layout === "card" || form.layout === "image" || form.layout === "split";
  const imageHint = form.layout === "image" ? "Chọn ảnh quảng cáo hoàn chỉnh có sẵn chữ. Ảnh giữ nguyên tỉ lệ." : form.layout === "split" ? "Bắt buộc có ảnh. Ưu tiên ảnh dọc hoặc vuông, chủ thể nằm giữa." : "Ưu tiên ảnh ngang 16:9. Có thể bỏ trống nếu chỉ muốn hiển thị chữ.";

  return <form className="admin-consult-popup" data-testid="promotion-popup-editor" noValidate onSubmit={save}>
    {!canUpdate ? <AdminNotice tone="info">Bạn chỉ có quyền xem cấu hình. Cần quyền sửa cài đặt để thay đổi.</AdminNotice> : null}
    {validation.summary}{message ? <AdminNotice tone="error">{message}</AdminNotice> : null}
    <PopupStatusSwitch checked={form.enabled} description={form.enabled ? "Quảng cáo có thể xuất hiện khi đạt điều kiện hiển thị bên dưới." : "Quảng cáo đang ẩn; nội dung vẫn được giữ nguyên."} disabled={locked} id="promotion-popup" label="Quảng cáo" onChange={(enabled) => update("enabled", enabled)} />
    <PopupSiblingNote siblingEnabled={formEnabled} siblingHref="/admin/consult-popup" siblingLabel="Biểu mẫu tư vấn" thisEnabled={form.enabled} />
    <div className="admin-consult-popup__workspace">
      <aside aria-label="Xem trước quảng cáo" className="admin-consult-popup__aside"><PromotionPreview value={form} /></aside>
      <fieldset className="admin-consult-popup__sections" disabled={locked}>
        <legend className="sr-only">Thiết lập quảng cáo</legend>
        <AdminEditorSection className="admin-consult-popup__section" id="promotion-content" step={1} title="Nội dung quảng cáo">
          <fieldset {...validation.props("layout")} className="admin-consult-popup__choice-field">
            <legend>Mẫu hiển thị</legend><p className="admin-help">Hình nhỏ mô phỏng vị trí quảng cáo trên trang; khung Xem trước bên cạnh hiện đúng chữ và ảnh bạn nhập.</p>
            <div className="admin-consult-popup__layout-choices">
              {layoutChoices.map((choice) => <PromoLayoutChoice {...choice} checked={form.layout === choice.layout} key={choice.layout} onChange={() => update("layout", choice.layout)} />)}
            </div>{validation.message("layout")}
          </fieldset>
          <div className="admin-form-grid">
            {usesImage ? <div className="admin-field admin-field--wide" {...validation.props("mediaId")} tabIndex={-1}><MediaPicker disabled={locked} hint={imageHint} label="Ảnh quảng cáo" onChange={(mediaId) => update("mediaId", mediaId)} onUploadingChange={setUploading} preview value={form.mediaId} />{validation.message("mediaId")}</div> : <p className="admin-consult-popup__layout-note">Mẫu này không dùng ảnh, giúp tải nhanh và tập trung vào thông điệp chính.</p>}
            <AdminFormField error={validation.message("title")} hint={bannerOnly ? "Dùng làm mô tả cho trình đọc màn hình, không chèn lên ảnh." : undefined} id={validation.props("title").id} label={bannerOnly ? "Mô tả nội dung ảnh" : "Tiêu đề quảng cáo"} wide><input {...validation.props("title")} className="block w-full" maxLength={120} onChange={(event) => update("title", event.target.value)} value={form.title} /></AdminFormField>
            {bannerOnly ? null : <AdminFormField error={validation.message("description")} id={validation.props("description").id} label="Mô tả" wide><textarea {...validation.props("description")} className="block w-full" maxLength={400} onChange={(event) => update("description", event.target.value || null)} rows={3} value={form.description ?? ""} /></AdminFormField>}
            {bannerOnly ? null : <AdminFormField error={validation.message("actionLabel")} id={validation.props("actionLabel").id} label="Chữ trên nút"><input {...validation.props("actionLabel")} className="block w-full" maxLength={60} onChange={(event) => update("actionLabel", event.target.value || null)} placeholder="Xem chi tiết" value={form.actionLabel ?? ""} /></AdminFormField>}
            <AdminFormField error={validation.message("actionUrl")} hint="Dùng /contact cho trang trong website hoặc dán liên kết https:// của Zalo, Facebook…" id={validation.props("actionUrl").id} label="Mở liên kết" wide={bannerOnly}><input {...validation.props("actionUrl")} className="block w-full" maxLength={1000} onChange={(event) => update("actionUrl", event.target.value || null)} placeholder="/contact hoặc https://…" value={form.actionUrl ?? ""} /></AdminFormField>
          </div>
        </AdminEditorSection>
        <AdminEditorSection className="admin-consult-popup__section" description="Chỉ áp dụng cho quảng cáo." id="promotion-display" step={2} title="Điều kiện hiển thị">
          <PopupDisplayFields name="promotion" onChange={update} setTimingMode={setTimingMode} timingMode={timingMode} validation={validation} value={form} />
        </AdminEditorSection>
      </fieldset>
    </div>
    <AdminEditorActions><p role="status">{uploading ? "Đang tải ảnh lên…" : busy ? "Đang lưu…" : isDirty ? "Có thay đổi chưa lưu." : "Mọi thay đổi đã được lưu."}</p>
      {isDirty ? <AdminButton disabled={busy || uploading} onClick={discard} variant="secondary">Bỏ thay đổi</AdminButton> : null}
      <AdminButton disabled={busy || uploading || !isDirty} permission="settings.update" type="submit">{busy ? "Đang lưu…" : "Lưu quảng cáo"}</AdminButton>
    </AdminEditorActions>
  </form>;
}
