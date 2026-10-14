"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import type { ProfileInput } from "@iorder/core/server/settings/profile.contract";
import { useAdminToast } from "@/components/admin/ui/admin-feedback";
import { AdminEditorActions } from "@/components/admin/ui/admin-editor-actions";
import { AdminButton } from "./ui/admin-button";
import { useUnsavedChanges } from "./ui/use-unsaved-changes";
import { useNavigationGuard } from "./ui/use-navigation-guard";
import { MediaPicker } from "./media-picker";

const fields = [
  ["companyName", "Tên doanh nghiệp"], ["legalName", "Tên pháp lý"], ["hotline", "Hotline"],
  ["supportEmail", "Email hỗ trợ"], ["salesEmail", "Email kinh doanh"], ["address", "Địa chỉ"], ["workingHours", "Giờ làm việc"],
] as const;

export function ProfileEditor({ initial }: { initial: ProfileInput | null }) {
  const [form, setForm] = useState<ProfileInput>(() => initial ?? {
    companyName: "", legalName: null, hotline: null, supportEmail: null,
    salesEmail: null, address: null, workingHours: null, logoMediaId: null,
  });
  const { isDirty, markSaved } = useUnsavedChanges(form);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const uploading = useRef(false);
  const [isUploading, setIsUploading] = useState(false);
  const handleUploadingChange = useCallback((pending: boolean) => {
    uploading.current = pending;
    setIsUploading(pending);
  }, []);
  useNavigationGuard(busy || isUploading);
  const [message, setMessage] = useState("");
  const { show: showToast } = useAdminToast();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || uploading.current || !isDirty) return;
    saving.current = true;
    const body = Object.fromEntries(fields.map(([key]) => [key, (form[key] ?? "").trim() || null]));
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, logoMediaId: form.logoMediaId }) });
      const payload = await response.json();
      if (response.ok) { markSaved(); showToast("Đã cập nhật thông tin doanh nghiệp trên website.", "success"); }
      else { const notice = payload.error?.message || "Không thể lưu thông tin."; setMessage(notice); showToast(notice, "error"); }
    } catch { const notice = "Không kết nối được máy chủ."; setMessage(notice); showToast(notice, "error"); }
    finally { saving.current = false; setBusy(false); }
  }
  return <form className="grid gap-4" onSubmit={submit}>
    {fields.map(([key, label]) => <label key={key}>{label}<input className="block w-full rounded border p-2" name={key} required={key === "companyName"} type={key.endsWith("Email") ? "email" : "text"} value={form[key] ?? ""} onChange={(event) => setForm((current) => ({ ...current, [key]: key === "companyName" ? event.target.value : event.target.value || null }))} /></label>)}
    <p>Logo doanh nghiệp</p><MediaPicker disabled={busy} value={form.logoMediaId} onUploadingChange={handleUploadingChange} onChange={(logoMediaId) => setForm((current) => ({ ...current, logoMediaId }))} />
    <AdminEditorActions><p role="status">{isUploading ? "Đang tải logo lên…" : message || (isDirty ? "Có thay đổi chưa lưu." : "Không có thay đổi chưa lưu.")}</p><AdminButton disabled={busy || isUploading || !isDirty} type="submit">{busy ? "Đang lưu…" : "Lưu thông tin doanh nghiệp"}</AdminButton></AdminEditorActions>
  </form>;
}
