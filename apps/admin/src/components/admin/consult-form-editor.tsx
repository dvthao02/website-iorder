"use client";

import { consultFormSchema, defaultConsultForm, type ConsultFormSettings } from "@iorder/shared/server/settings/consult-popup.contract";
import { PopupDisplayFields, PopupSiblingNote, PopupStatusSwitch } from "./popup-display-fields";
import { ConsultFormPreview } from "./popup-preview";
import { usePopupSettingEditor } from "./use-popup-setting-editor";
import { AdminButton } from "./ui/admin-button";
import { AdminEditorActions } from "./ui/admin-editor-actions";
import { AdminEditorSection } from "./ui/admin-editor-section";
import { AdminNotice } from "./ui/admin-feedback";
import { AdminFormField } from "./ui/admin-form-field";
import { AdminListEditor } from "./ui/admin-list-editor";

const fields: Record<keyof ConsultFormSettings, { label: string; message: string }> = {
  enabled: { label: "Trạng thái", message: "Chọn trạng thái biểu mẫu." },
  title: { label: "Tiêu đề", message: "Nhập tiêu đề biểu mẫu, tối đa 120 ký tự." },
  description: { label: "Mô tả", message: "Mô tả biểu mẫu tối đa 400 ký tự." },
  submitLabel: { label: "Chữ trên nút gửi", message: "Nhập chữ trên nút gửi, tối đa 60 ký tự." },
  needOptions: { label: "Nhu cầu khách có thể chọn", message: "Mỗi lựa chọn tối đa 120 ký tự, tối đa 10 lựa chọn." },
  scrollPercent: { label: "Mức cuộn trang", message: "Nhập số từ 30 đến 100." },
  delaySeconds: { label: "Thời gian chờ", message: "Nhập số giây từ 0 đến 300." },
  repeatDays: { label: "Thời gian không hiện lại", message: "Nhập số ngày từ 0 đến 365." },
  scope: { label: "Trang hiển thị", message: "Chọn phạm vi hiển thị." },
};

export function ConsultFormEditor({ initial, initialVersion, promotionEnabled }: { initial: ConsultFormSettings | null; initialVersion: number; promotionEnabled: boolean }) {
  const { value: form, update, timingMode, setTimingMode, busy, locked, canUpdate, message, isDirty, save, discard, validation } = usePopupSettingEditor<ConsultFormSettings>({
    endpoint: "/api/v1/admin/consult-form",
    responseKey: "form",
    schema: consultFormSchema,
    initial,
    fallback: defaultConsultForm,
    initialVersion,
    subject: "biểu mẫu tư vấn",
    formId: "consult-form",
    fields,
    prepare: (value) => ({ ...value, needOptions: value.needOptions.map((option) => option.trim()).filter(Boolean) }),
  });

  return <form className="admin-consult-popup" data-testid="consult-form-editor" noValidate onSubmit={save}>
    {!canUpdate ? <AdminNotice tone="info">Bạn chỉ có quyền xem cấu hình. Cần quyền sửa cài đặt để thay đổi.</AdminNotice> : null}
    {validation.summary}{message ? <AdminNotice tone="error">{message}</AdminNotice> : null}
    <PopupStatusSwitch checked={form.enabled} description={form.enabled ? "Khách có thể nhận biểu mẫu khi đạt điều kiện hiển thị bên dưới." : "Biểu mẫu đang ẩn; nội dung vẫn được giữ nguyên."} disabled={locked} id="consult-form" label="Biểu mẫu tư vấn" onChange={(enabled) => update("enabled", enabled)} />
    <PopupSiblingNote siblingEnabled={promotionEnabled} siblingHref="/admin/promotion-popup" siblingLabel="Quảng cáo" thisEnabled={form.enabled} />
    <div className="admin-consult-popup__workspace">
      <aside aria-label="Xem trước biểu mẫu" className="admin-consult-popup__aside"><ConsultFormPreview value={form} /></aside>
      <fieldset className="admin-consult-popup__sections" disabled={locked}>
        <legend className="sr-only">Thiết lập biểu mẫu tư vấn</legend>
        <AdminEditorSection className="admin-consult-popup__section" description="Thông tin khách để lại sẽ vào mục Khách hàng tiềm năng." id="consult-form-content" step={1} title="Nội dung biểu mẫu">
          <div className="admin-form-grid">
            <AdminFormField error={validation.message("title")} id={validation.props("title").id} label="Tiêu đề" wide><input {...validation.props("title")} className="block w-full" maxLength={120} onChange={(event) => update("title", event.target.value)} value={form.title} /></AdminFormField>
            <AdminFormField error={validation.message("description")} id={validation.props("description").id} label="Mô tả" wide><textarea {...validation.props("description")} className="block w-full" maxLength={400} onChange={(event) => update("description", event.target.value || null)} rows={3} value={form.description ?? ""} /></AdminFormField>
            <AdminFormField error={validation.message("submitLabel")} id={validation.props("submitLabel").id} label="Chữ trên nút gửi"><input {...validation.props("submitLabel")} className="block w-full" maxLength={60} onChange={(event) => update("submitLabel", event.target.value)} value={form.submitLabel} /></AdminFormField>
            <div className="admin-field admin-field--wide" {...validation.props("needOptions")} tabIndex={-1}>
              <span className="admin-consult-popup__field-label">Nhu cầu khách có thể chọn</span><p className="admin-help">Có thể để trống nếu chỉ cần họ tên và số điện thoại.</p>
              <AdminListEditor addLabel="Thêm nhu cầu" itemLabel="Nhu cầu" items={form.needOptions} maxItems={10} maxLength={120} onChange={(needOptions) => update("needOptions", needOptions)} placeholder="Ví dụ: Phần mềm bán hàng" />
              {validation.message("needOptions")}
            </div>
          </div>
        </AdminEditorSection>
        <AdminEditorSection className="admin-consult-popup__section" description="Chỉ áp dụng cho biểu mẫu tư vấn." id="consult-form-display" step={2} title="Điều kiện hiển thị">
          <PopupDisplayFields name="consult-form" onChange={update} setTimingMode={setTimingMode} timingMode={timingMode} validation={validation} value={form} />
        </AdminEditorSection>
      </fieldset>
    </div>
    <AdminEditorActions><p role="status">{busy ? "Đang lưu…" : isDirty ? "Có thay đổi chưa lưu." : "Mọi thay đổi đã được lưu."}</p>
      {isDirty ? <AdminButton disabled={busy} onClick={discard} variant="secondary">Bỏ thay đổi</AdminButton> : null}
      <AdminButton disabled={busy || !isDirty} permission="settings.update" type="submit">{busy ? "Đang lưu…" : "Lưu biểu mẫu"}</AdminButton>
    </AdminEditorActions>
  </form>;
}
