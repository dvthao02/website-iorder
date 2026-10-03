"use client";

import { useState, type FormEvent } from "react";
import type { ProfileInput } from "@iorder/core/server/settings/profile.contract";
import { useAdminToast } from "@/components/admin/ui/admin-feedback";
import { AdminEditorActions } from "@/components/admin/ui/admin-editor-actions";
import { MediaPicker } from "./media-picker";

const fields = [
  ["companyName", "Tên doanh nghiệp"], ["legalName", "Tên pháp lý"], ["hotline", "Hotline"],
  ["supportEmail", "Email hỗ trợ"], ["salesEmail", "Email kinh doanh"], ["address", "Địa chỉ"], ["workingHours", "Giờ làm việc"],
] as const;

export function ProfileEditor({ initial }: { initial: ProfileInput | null }) {
  const [logo, setLogo] = useState(initial?.logoMediaId ?? null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const { show: showToast } = useAdminToast();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = Object.fromEntries(fields.map(([key]) => [key, String(data.get(key) ?? "").trim() || null]));
    setBusy(true);
    try {
      const response = await fetch("/api/admin/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, logoMediaId: logo }) });
      const payload = await response.json();
      if (response.ok) showToast("Đã cập nhật thông tin doanh nghiệp trên website.", "success");
      else { const notice = payload.error?.message || "Không thể lưu thông tin."; setMessage(notice); showToast(notice, "error"); }
    } catch { const notice = "Không kết nối được máy chủ."; setMessage(notice); showToast(notice, "error"); }
    finally { setBusy(false); }
  }
  return <form className="grid gap-4" onSubmit={submit}>
    {fields.map(([key, label]) => <label key={key}>{label}<input className="block w-full rounded border p-2" name={key} required={key === "companyName"} type={key.endsWith("Email") ? "email" : "text"} defaultValue={initial?.[key] ?? ""} /></label>)}
    <p>Logo doanh nghiệp</p><MediaPicker value={logo} onChange={setLogo} />
    <AdminEditorActions><p role="status">{message}</p><button disabled={busy} className="rounded bg-blue-700 px-4 py-2 text-white">{busy ? "Đang lưu…" : "Lưu thông tin doanh nghiệp"}</button></AdminEditorActions>
  </form>;
}
