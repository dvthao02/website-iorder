"use client";

import { ImageIcon, LayoutPanelTop, Megaphone, MessageSquareText } from "lucide-react";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";

import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { consultPopupSchema, defaultConsultPopup, type ConsultPopup } from "@iorder/shared/server/settings/consult-popup.contract";
import { expectedVersionSchema } from "@iorder/shared/server/shared/content-version";
import { MediaPicker } from "./media-picker";
import { AdminButton } from "./ui/admin-button";
import { AdminEditorActions } from "./ui/admin-editor-actions";
import { AdminEditorSection } from "./ui/admin-editor-section";
import { AdminNotice, useAdminToast } from "./ui/admin-feedback";
import { AdminFormField } from "./ui/admin-form-field";
import { AdminListEditor } from "./ui/admin-list-editor";
import { useAdminFormValidation } from "./ui/use-admin-form-validation";
import { useAdminPermissions } from "./ui/admin-permissions";
import { useNavigationGuard } from "./ui/use-navigation-guard";
import { useUnsavedChanges } from "./ui/use-unsaved-changes";

type FormField = "form.title" | "form.description" | "form.submitLabel" | "form.needOptions" | "promo.layout" | "promo.title" | "promo.description" | "promo.mediaId" | "promo.actionLabel" | "promo.actionUrl" | "scrollPercent" | "delaySeconds" | "repeatDays" | "scope";
type TimingPreset = "balanced" | "late" | "custom";

const saveResponseSchema = z.object({ popup: consultPopupSchema, version: expectedVersionSchema });
const fieldDefinitions: Record<FormField, { label: string; message: string }> = {
  "form.title": { label: "Tiêu đề biểu mẫu", message: "Nhập tiêu đề biểu mẫu, tối đa 120 ký tự." },
  "form.description": { label: "Mô tả biểu mẫu", message: "Mô tả biểu mẫu tối đa 400 ký tự." },
  "form.submitLabel": { label: "Chữ trên nút gửi", message: "Nhập chữ trên nút gửi, tối đa 60 ký tự." },
  "form.needOptions": { label: "Nhu cầu khách có thể chọn", message: "Mỗi lựa chọn tối đa 120 ký tự, tối đa 10 lựa chọn." },
  "promo.layout": { label: "Bố cục quảng cáo", message: "Chọn một bố cục quảng cáo." },
  "promo.title": { label: "Tên quảng cáo", message: "Nhập tên quảng cáo, tối đa 120 ký tự." },
  "promo.description": { label: "Mô tả quảng cáo", message: "Mô tả quảng cáo tối đa 400 ký tự." },
  "promo.mediaId": { label: "Ảnh quảng cáo", message: "Chọn ảnh quảng cáo từ thư viện." },
  "promo.actionLabel": { label: "Chữ trên nút quảng cáo", message: "Nhập chữ trên nút quảng cáo, tối đa 60 ký tự." },
  "promo.actionUrl": { label: "Liên kết quảng cáo", message: "Nhập đường dẫn trong website, liên kết https://, tel: hoặc mailto:." },
  scrollPercent: { label: "Mức cuộn trang", message: "Nhập số từ 30 đến 100." },
  delaySeconds: { label: "Thời gian chờ", message: "Nhập số giây từ 0 đến 300." },
  repeatDays: { label: "Thời gian không hiện lại", message: "Nhập số ngày từ 0 đến 365." },
  scope: { label: "Trang hiển thị", message: "Chọn phạm vi hiển thị." },
};

const timingValues: Record<Exclude<TimingPreset, "custom">, Pick<ConsultPopup, "scrollPercent" | "delaySeconds" | "repeatDays">> = {
  balanced: { scrollPercent: 60, delaySeconds: 5, repeatDays: 7 },
  late: { scrollPercent: 85, delaySeconds: 8, repeatDays: 3 },
};

function getTimingPreset(form: ConsultPopup): TimingPreset {
  for (const [preset, values] of Object.entries(timingValues)) {
    if (form.scrollPercent === values.scrollPercent && form.delaySeconds === values.delaySeconds && form.repeatDays === values.repeatDays) return preset as TimingPreset;
  }
  return "custom";
}

function timingSummary(form: ConsultPopup) {
  const repeat = form.repeatDays === 0 ? "chỉ ghi nhớ trong phiên hiện tại" : `không hiện lại nội dung vừa đóng trong ${form.repeatDays} ngày`;
  return `Sau khi khách lướt ${form.scrollPercent}% trang và ở lại ít nhất ${form.delaySeconds} giây; ${repeat}.`;
}

function Choice({ checked, description, icon, label, name, onChange, value }: { checked: boolean; description: string; icon: ReactNode; label: string; name: string; onChange: () => void; value: string }) {
  return <label className={checked ? "admin-consult-popup__choice admin-consult-popup__choice--active" : "admin-consult-popup__choice"}>
    <input checked={checked} name={name} onChange={onChange} type="radio" value={value} />
    <span className="admin-consult-popup__choice-icon">{icon}</span>
    <span><strong>{label}</strong><small>{description}</small></span>
  </label>;
}

function FeatureHeader({ checked, description, disabled, icon, label, onChange }: { checked: boolean; description: string; disabled: boolean; icon: ReactNode; label: string; onChange: (checked: boolean) => void }) {
  return <div className="admin-consult-popup__feature-head">
    <span className="admin-consult-popup__feature-icon">{icon}</span>
    <span><strong>{label}</strong><small>{description}</small></span>
    <label className="admin-consult-popup__switch"><input checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} type="checkbox" /><span>{checked ? "Đang bật" : "Đang tắt"}</span></label>
  </div>;
}

export function ConsultPopupEditor({ initial, initialVersion }: { initial: ConsultPopup | null; initialVersion: number }) {
  const version = useRef(initialVersion);
  const { can } = useAdminPermissions();
  const canUpdate = can("settings.update");
  const [form, setForm] = useState<ConsultPopup>(initial ?? defaultConsultPopup);
  const [timingMode, setTimingMode] = useState<TimingPreset>(() => getTimingPreset(initial ?? defaultConsultPopup));
  const { isDirty, markSaved, getSavedValue } = useUnsavedChanges(form);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const saving = useRef(false);
  const [message, setMessage] = useState("");
  const { show: showToast } = useAdminToast();
  const validation = useAdminFormValidation("consult-popup", fieldDefinitions);
  useNavigationGuard(busy || uploading, () => showToast("Đang lưu cửa sổ tư vấn. Vui lòng chờ trước khi rời trang.", "info"));

  const activeCount = Number(form.form.enabled) + Number(form.promo.enabled);
  const bannerOnly = form.promo.layout === "image";
  const patch = (values: Partial<ConsultPopup>) => setForm((current) => ({ ...current, ...values }));
  const update = <Key extends keyof ConsultPopup>(key: Key, value: ConsultPopup[Key]) => patch({ [key]: value });
  const updateForm = <Key extends keyof ConsultPopup["form"]>(key: Key, value: ConsultPopup["form"][Key]) => setForm((current) => ({ ...current, form: { ...current.form, [key]: value } }));
  const updatePromo = <Key extends keyof ConsultPopup["promo"]>(key: Key, value: ConsultPopup["promo"][Key]) => setForm((current) => ({ ...current, promo: { ...current.promo, [key]: value } }));
  const numberInput = (key: "scrollPercent" | "delaySeconds" | "repeatDays", min: number, max: number) =>
    <input {...validation.props(key)} className="block w-full" max={max} min={min} onChange={(event) => { setTimingMode("custom"); update(key, event.currentTarget.valueAsNumber); }} type="number" value={Number.isFinite(form[key]) ? form[key] : ""} />;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || !canUpdate || !isDirty || uploading) return;
    setMessage("");
    const parsed = consultPopupSchema.safeParse({ ...form, form: { ...form.form, needOptions: form.form.needOptions.map((option) => option.trim()).filter(Boolean) } });
    if (!parsed.success) { validation.report(parsed.error.issues); return; }
    validation.reset();
    saving.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/v1/admin/consult-popup", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ values: parsed.data, expectedVersion: version.current }) });
      const body: unknown = await readAdminJson(response);
      if (!response.ok) throw adminApiError(body, "Không thể lưu cửa sổ tư vấn.");
      const saved = saveResponseSchema.safeParse(body);
      if (!saved.success) throw new Error("Phản hồi lưu cửa sổ tư vấn không hợp lệ. Hãy tải lại trước khi lưu tiếp.");
      version.current = saved.data.version;
      setForm(saved.data.popup);
      setTimingMode(getTimingPreset(saved.data.popup));
      markSaved(saved.data.popup);
      showToast("Đã cập nhật biểu mẫu tư vấn và quảng cáo trên website.", "success");
    } catch (error) {
      const notice = error instanceof Error ? error.message : "Không kết nối được máy chủ.";
      setMessage(notice);
      showToast(notice, "error");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return <form className="admin-consult-popup" noValidate onSubmit={save}>
    {!canUpdate ? <AdminNotice tone="info">Bạn chỉ có quyền xem cấu hình. Cần quyền sửa cài đặt để thay đổi.</AdminNotice> : null}
    {validation.summary}
    {message ? <AdminNotice tone="error">{message}</AdminNotice> : null}

    <div className="admin-consult-popup__statusbar">
      <div><strong>{activeCount ? `Đang bật ${activeCount} nội dung` : "Chưa bật nội dung nào"}</strong><span>{activeCount === 2 ? "Quảng cáo hiện trước; biểu mẫu tư vấn hiện ở lần xem trang phù hợp tiếp theo." : activeCount === 1 ? "Nội dung đang bật sẽ hiện khi khách đủ điều kiện." : "Bật biểu mẫu tư vấn, quảng cáo hoặc cả hai."}</span></div>
      <span className="admin-consult-popup__count">{activeCount}/2 đang bật</span>
    </div>

    <fieldset className="grid gap-4" disabled={busy || !canUpdate}>
      <AdminEditorSection className="admin-consult-popup__section" title="Biểu mẫu tư vấn">
        <FeatureHeader checked={form.form.enabled} description="Thu họ tên, số điện thoại và nhu cầu của khách." disabled={busy || !canUpdate} icon={<MessageSquareText aria-hidden="true" size={20} />} label="Nhận yêu cầu tư vấn" onChange={(enabled) => updateForm("enabled", enabled)} />
        {form.form.enabled ? <div className="admin-form-grid">
          <AdminFormField error={validation.message("form.title")} id={validation.props("form.title").id} label="Tiêu đề" wide><input {...validation.props("form.title")} className="block w-full" maxLength={120} onChange={(event) => updateForm("title", event.target.value)} value={form.form.title} /></AdminFormField>
          <AdminFormField error={validation.message("form.description")} id={validation.props("form.description").id} label="Mô tả" wide><textarea {...validation.props("form.description")} className="block w-full" maxLength={400} onChange={(event) => updateForm("description", event.target.value || null)} rows={2} value={form.form.description ?? ""} /></AdminFormField>
          <AdminFormField error={validation.message("form.submitLabel")} id={validation.props("form.submitLabel").id} label="Chữ trên nút gửi"><input {...validation.props("form.submitLabel")} className="block w-full" maxLength={60} onChange={(event) => updateForm("submitLabel", event.target.value)} value={form.form.submitLabel} /></AdminFormField>
          <div className="admin-field admin-field--wide" {...validation.props("form.needOptions")} tabIndex={-1}>
            <span className="admin-consult-popup__field-label">Nhu cầu khách có thể chọn</span>
            <p className="admin-help">Có thể để trống nếu chỉ cần họ tên và số điện thoại.</p>
            <AdminListEditor addLabel="Thêm nhu cầu" itemLabel="Nhu cầu" items={form.form.needOptions} maxItems={10} maxLength={120} onChange={(needOptions) => updateForm("needOptions", needOptions)} placeholder="Ví dụ: Phần mềm bán hàng" />
            {validation.message("form.needOptions")}
          </div>
        </div> : <p className="admin-consult-popup__disabled-note">Biểu mẫu đang tắt. Bật lên để chỉnh nội dung và nhận thông tin khách hàng.</p>}
      </AdminEditorSection>

      <AdminEditorSection className="admin-consult-popup__section" title="Quảng cáo">
        <FeatureHeader checked={form.promo.enabled} description="Hiển thị ảnh quảng cáo và dẫn khách tới liên kết thật." disabled={busy || !canUpdate} icon={<Megaphone aria-hidden="true" size={20} />} label="Hiển thị quảng cáo" onChange={(enabled) => updatePromo("enabled", enabled)} />
        {form.promo.enabled ? <>
          <fieldset {...validation.props("promo.layout")} className="admin-consult-popup__choice-field">
            <legend>Bố cục quảng cáo</legend>
            <div className="admin-consult-popup__choices admin-consult-popup__choices--compact">
              <Choice checked={bannerOnly} description="Ảnh đã có sẵn chữ và nút; cả ảnh là liên kết." icon={<ImageIcon aria-hidden="true" size={20} />} label="Chỉ ảnh" name="consult-popup-layout" onChange={() => updatePromo("layout", "image")} value="image" />
              <Choice checked={!bannerOnly} description="Ảnh ở trên; tiêu đề, mô tả và nút ở dưới." icon={<LayoutPanelTop aria-hidden="true" size={20} />} label="Ảnh kèm nội dung" name="consult-popup-layout" onChange={() => updatePromo("layout", "card")} value="card" />
            </div>
            {validation.message("promo.layout")}
          </fieldset>
          <div className="admin-form-grid">
            <div className="admin-field admin-field--wide" {...validation.props("promo.mediaId")} tabIndex={-1}>
              <MediaPicker disabled={busy || !canUpdate} hint={bannerOnly ? "Chọn ảnh quảng cáo hoàn chỉnh có sẵn chữ. Ảnh giữ nguyên tỉ lệ." : "Ưu tiên ảnh ngang 16:9. Có thể bỏ trống nếu chỉ hiển thị chữ."} label="Ảnh quảng cáo" onChange={(mediaId) => updatePromo("mediaId", mediaId)} onUploadingChange={setUploading} preview value={form.promo.mediaId} />
              {validation.message("promo.mediaId")}
            </div>
            <AdminFormField error={validation.message("promo.title")} hint={bannerOnly ? "Dùng làm mô tả cho trình đọc màn hình, không chèn lên ảnh." : undefined} id={validation.props("promo.title").id} label={bannerOnly ? "Mô tả nội dung ảnh" : "Tiêu đề quảng cáo"} wide><input {...validation.props("promo.title")} className="block w-full" maxLength={120} onChange={(event) => updatePromo("title", event.target.value)} value={form.promo.title} /></AdminFormField>
            {bannerOnly ? null : <AdminFormField error={validation.message("promo.description")} id={validation.props("promo.description").id} label="Mô tả" wide><textarea {...validation.props("promo.description")} className="block w-full" maxLength={400} onChange={(event) => updatePromo("description", event.target.value || null)} rows={2} value={form.promo.description ?? ""} /></AdminFormField>}
            {bannerOnly ? null : <AdminFormField error={validation.message("promo.actionLabel")} id={validation.props("promo.actionLabel").id} label="Chữ trên nút"><input {...validation.props("promo.actionLabel")} className="block w-full" maxLength={60} onChange={(event) => updatePromo("actionLabel", event.target.value || null)} placeholder="Xem chi tiết" value={form.promo.actionLabel ?? ""} /></AdminFormField>}
            <AdminFormField error={validation.message("promo.actionUrl")} hint="Dùng /lien-he cho trang trong website hoặc dán liên kết https:// của Shopee, Zalo, Facebook…" id={validation.props("promo.actionUrl").id} label="Mở liên kết" wide={bannerOnly}><input {...validation.props("promo.actionUrl")} className="block w-full" maxLength={1000} onChange={(event) => updatePromo("actionUrl", event.target.value || null)} placeholder="/lien-he hoặc https://…" value={form.promo.actionUrl ?? ""} /></AdminFormField>
          </div>
        </> : <p className="admin-consult-popup__disabled-note">Quảng cáo đang tắt. Bật lên rồi chọn ảnh và liên kết thật để quảng cáo xuất hiện.</p>}
      </AdminEditorSection>

      <AdminEditorSection className="admin-consult-popup__section" description="Áp dụng chung cho cả quảng cáo và biểu mẫu tư vấn." title="Thời điểm hiển thị">
        <fieldset {...validation.props("scope")} className="admin-consult-popup__choice-field">
          <legend>Trang hiển thị</legend>
          <div className="admin-consult-popup__choices admin-consult-popup__choices--compact">
            <Choice checked={form.scope === "all"} description="Không hiện ở trang Liên hệ, bản xem trước và trình dựng trang." icon={<span aria-hidden="true">01</span>} label="Mọi trang phù hợp" name="consult-popup-scope" onChange={() => update("scope", "all")} value="all" />
            <Choice checked={form.scope === "home"} description="Chỉ xuất hiện khi khách đang ở trang chủ." icon={<span aria-hidden="true">02</span>} label="Chỉ trang chủ" name="consult-popup-scope" onChange={() => update("scope", "home")} value="home" />
          </div>
          {validation.message("scope")}
        </fieldset>
        <fieldset className="admin-consult-popup__choice-field">
          <legend>Thời điểm và tần suất</legend>
          <div className="admin-consult-popup__timing">
            <label className={timingMode === "late" ? "admin-consult-popup__timing-option admin-consult-popup__timing-option--active" : "admin-consult-popup__timing-option"}><input checked={timingMode === "late"} name="consult-popup-timing" onChange={() => { setTimingMode("late"); patch(timingValues.late); }} type="radio" /><span><strong>Gần cuối trang</strong><small>85% trang · chờ 8 giây · nhắc lại sau 3 ngày</small></span></label>
            <label className={timingMode === "balanced" ? "admin-consult-popup__timing-option admin-consult-popup__timing-option--active" : "admin-consult-popup__timing-option"}><input checked={timingMode === "balanced"} name="consult-popup-timing" onChange={() => { setTimingMode("balanced"); patch(timingValues.balanced); }} type="radio" /><span><strong>Cân bằng</strong><small>60% trang · chờ 5 giây · nhắc lại sau 7 ngày</small></span></label>
            <label className={timingMode === "custom" ? "admin-consult-popup__timing-option admin-consult-popup__timing-option--active" : "admin-consult-popup__timing-option"}><input checked={timingMode === "custom"} name="consult-popup-timing" onChange={() => setTimingMode("custom")} type="radio" /><span><strong>Tùy chỉnh</strong><small>Tự đặt ba thông số bên dưới</small></span></label>
          </div>
        </fieldset>
        {timingMode === "custom" ? <div className="admin-consult-popup__custom-timing">
          <AdminFormField error={validation.message("scrollPercent")} hint="Tính theo quãng đường cuộn thực tế." id={validation.props("scrollPercent").id} label="Lướt đến (% trang)">{numberInput("scrollPercent", 30, 100)}</AdminFormField>
          <AdminFormField error={validation.message("delaySeconds")} hint="Tính từ lúc mở trang." id={validation.props("delaySeconds").id} label="Chờ ít nhất (giây)">{numberInput("delaySeconds", 0, 300)}</AdminFormField>
          <AdminFormField error={validation.message("repeatDays")} hint="Nhập 0 để chỉ nhớ trong phiên hiện tại." id={validation.props("repeatDays").id} label="Không hiện lại (ngày)">{numberInput("repeatDays", 0, 365)}</AdminFormField>
        </div> : null}
        <p className="admin-consult-popup__summary"><strong>Cách hoạt động:</strong> {timingSummary(form)}</p>
      </AdminEditorSection>
    </fieldset>

    <AdminEditorActions><p role="status">{uploading ? "Đang tải ảnh lên…" : busy ? "Đang lưu…" : isDirty ? "Có thay đổi chưa lưu." : "Mọi thay đổi đã được lưu."}</p>
      {isDirty ? <AdminButton disabled={busy || uploading} onClick={() => { const saved = getSavedValue(); setForm(saved); setTimingMode(getTimingPreset(saved)); setMessage(""); validation.reset(); }} variant="secondary">Bỏ thay đổi</AdminButton> : null}
      <AdminButton disabled={busy || uploading || !isDirty} permission="settings.update" type="submit">{busy ? "Đang lưu…" : "Lưu thay đổi"}</AdminButton>
    </AdminEditorActions>
  </form>;
}
