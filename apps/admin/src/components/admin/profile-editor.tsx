"use client";

import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { profileInputSchema, type ProfileInput } from "@iorder/shared/server/settings/profile.contract";
import { expectedVersionSchema } from "@iorder/shared/server/shared/content-version";
import { AdminNotice, useAdminToast } from "./ui/admin-feedback";
import { AdminEditorActions } from "./ui/admin-editor-actions";
import { AdminButton } from "./ui/admin-button";
import { useAdminPermissions } from "./ui/admin-permissions";
import { AdminFormField } from "./ui/admin-form-field";
import { useAdminFormValidation } from "./ui/use-admin-form-validation";
import { useUnsavedChanges } from "./ui/use-unsaved-changes";
import { useNavigationGuard } from "./ui/use-navigation-guard";
import { MediaPicker } from "./media-picker";

const fields = [
  ["companyName", "Tên doanh nghiệp"], ["legalName", "Tên pháp lý"], ["hotline", "Hotline"],
  ["supportEmail", "Email hỗ trợ"], ["salesEmail", "Email kinh doanh"], ["address", "Địa chỉ"], ["workingHours", "Giờ làm việc"],
] as const;
const saveResponseSchema = z.object({ profile: profileInputSchema, version: expectedVersionSchema });

export function ProfileEditor({ initial, initialVersion }: { initial: ProfileInput | null; initialVersion: number }) {
  const version = useRef(initialVersion);
  const { can } = useAdminPermissions();
  const canUpdate = can("settings.update");
  const [form, setForm] = useState<ProfileInput>(() => initial ?? {
    companyName: "", legalName: null, hotline: null, supportEmail: null,
    salesEmail: null, address: null, workingHours: null, logoMediaId: null,
  });
  const { isDirty, markSaved, getSavedValue } = useUnsavedChanges(form);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const uploading = useRef(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const { show: showToast } = useAdminToast();
  const validation = useAdminFormValidation<keyof ProfileInput>("profile", {
    companyName: { label: "Tên doanh nghiệp", message: "Nhập tên doanh nghiệp từ 1 đến 220 ký tự." },
    legalName: { label: "Tên pháp lý", message: "Tên pháp lý không vượt quá 220 ký tự." },
    hotline: { label: "Hotline", message: "Hotline không vượt quá 60 ký tự." },
    supportEmail: { label: "Email hỗ trợ", message: "Nhập email hợp lệ (tối đa 320 ký tự) hoặc để trống." },
    salesEmail: { label: "Email kinh doanh", message: "Nhập email hợp lệ (tối đa 320 ký tự) hoặc để trống." },
    address: { label: "Địa chỉ", message: "Địa chỉ không vượt quá 5.000 ký tự." },
    workingHours: { label: "Giờ làm việc", message: "Giờ làm việc không vượt quá 255 ký tự." },
    logoMediaId: { label: "Logo", message: "Chọn logo hợp lệ từ thư viện." },
  });
  const handleUploadingChange = useCallback((pending: boolean) => { uploading.current = pending; setIsUploading(pending); }, []);
  useNavigationGuard(busy || isUploading, () => showToast("Đang xử lý thông tin doanh nghiệp. Vui lòng chờ trước khi rời trang.", "info"));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || uploading.current || !canUpdate || !isDirty) return;
    setMessage("");
    const values = { ...form, ...Object.fromEntries(fields.map(([key]) => [key, key === "companyName" ? form.companyName.trim() : form[key]?.trim() || null])) };
    const parsed = profileInputSchema.safeParse(values);
    if (!parsed.success) { validation.report(parsed.error.issues); return; }
    validation.reset();
    saving.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/v1/admin/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ values: parsed.data, expectedVersion: version.current }) });
      const payload: unknown = await readAdminJson(response);
      if (!response.ok) throw adminApiError(payload, "Không thể lưu thông tin doanh nghiệp.");
      const saved = saveResponseSchema.safeParse(payload);
      if (!saved.success) throw new Error("Phản hồi lưu thông tin không hợp lệ. Hãy tải lại để kiểm tra trước khi lưu tiếp.");
      version.current = saved.data.version;
      setForm(saved.data.profile); markSaved(saved.data.profile);
      showToast("Đã cập nhật thông tin doanh nghiệp trên website.", "success");
    } catch (error) {
      const notice = error instanceof Error ? error.message : "Không kết nối được máy chủ.";
      setMessage(notice); showToast(notice, "error");
    } finally { saving.current = false; setBusy(false); }
  }

  return <form className="grid gap-4" noValidate onSubmit={submit}>
    {!canUpdate ? <AdminNotice tone="info">Bạn chỉ có quyền xem cấu hình. Cần quyền sửa cài đặt để thay đổi.</AdminNotice> : null}
    {validation.summary}
    {message ? <AdminNotice tone="error">{message}</AdminNotice> : null}
    <fieldset className="grid gap-4" disabled={busy || isUploading || !canUpdate}>
      <div className="admin-form-grid">{fields.map(([key, label]) => <AdminFormField error={validation.message(key)} id={validation.props(key).id} key={key} label={label} wide={key === "address"}>
        <input {...validation.props(key)} className="block w-full" name={key} onChange={(event) => setForm((current) => ({ ...current, [key]: key === "companyName" ? event.target.value : event.target.value || null }))} required={key === "companyName"} type={key.endsWith("Email") ? "email" : "text"} value={form[key] ?? ""} />
      </AdminFormField>)}</div>
      <div {...validation.props("logoMediaId")} tabIndex={-1}>
        <MediaPicker disabled={busy} hint="Hiện ở đầu và cuối website. Nên dùng PNG hoặc WebP nền trong suốt." label="Logo doanh nghiệp" value={form.logoMediaId} onUploadingChange={handleUploadingChange} onChange={(logoMediaId) => setForm((current) => ({ ...current, logoMediaId }))} />
        {validation.message("logoMediaId")}
      </div>
    </fieldset>
    <AdminEditorActions><p role="status">{isUploading ? "Đang tải logo lên…" : busy ? "Đang lưu thông tin…" : isDirty ? "Có thay đổi chưa lưu." : "Không có thay đổi chưa lưu."}</p>
      {isDirty ? <AdminButton disabled={busy || isUploading} onClick={() => { setForm(getSavedValue()); setMessage(""); validation.reset(); }} variant="secondary">Bỏ thay đổi</AdminButton> : null}
      <AdminButton disabled={busy || isUploading || !isDirty} permission="settings.update" type="submit">{busy ? "Đang lưu…" : "Lưu thông tin doanh nghiệp"}</AdminButton>
    </AdminEditorActions>
  </form>;
}
