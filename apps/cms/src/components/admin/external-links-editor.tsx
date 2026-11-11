"use client";

import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { externalLinksSchema, type ExternalLinks } from "@iorder/core/server/settings/external-links.contract";
import { expectedVersionSchema } from "@iorder/core/server/shared/content-version";
import { AdminNotice, useAdminToast } from "./ui/admin-feedback";
import { AdminEditorActions } from "./ui/admin-editor-actions";
import { AdminButton } from "./ui/admin-button";
import { useAdminPermissions } from "./ui/admin-permissions";
import { AdminFormField } from "./ui/admin-form-field";
import { useAdminFormValidation } from "./ui/use-admin-form-validation";
import { useUnsavedChanges } from "./ui/use-unsaved-changes";
import { useNavigationGuard } from "./ui/use-navigation-guard";

const fields = [
  ["appLogin", "Trang đăng nhập ứng dụng"], ["trial", "Trang đăng ký dùng thử"],
  ["facebook", "Facebook"], ["zalo", "Zalo"], ["youtube", "YouTube"],
  ["appStore", "Apple App Store"], ["googlePlay", "Google Play"],
] as const satisfies ReadonlyArray<readonly [keyof ExternalLinks, string]>;
const emptyLinks: ExternalLinks = { appLogin: null, trial: null, facebook: null, zalo: null, youtube: null, appStore: null, googlePlay: null };
const saveResponseSchema = z.object({ links: externalLinksSchema, version: expectedVersionSchema });
const fieldDefinitions = Object.fromEntries(fields.map(([key, label]) => [key, { label, message: "Nhập URL đầy đủ hợp lệ (tối đa 1.000 ký tự) hoặc để trống." }])) as Record<keyof ExternalLinks, { label: string; message: string }>;

export function ExternalLinksEditor({ initial, initialVersion }: { initial: ExternalLinks | null; initialVersion: number }) {
  const version = useRef(initialVersion);
  const { can } = useAdminPermissions();
  const canUpdate = can("settings.update");
  const [links, setLinks] = useState<ExternalLinks>(initial ?? emptyLinks);
  const { isDirty, markSaved, getSavedValue } = useUnsavedChanges(links);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [message, setMessage] = useState("");
  const { show: showToast } = useAdminToast();
  const validation = useAdminFormValidation("external-links", fieldDefinitions);
  useNavigationGuard(busy, () => showToast("Đang lưu liên kết. Vui lòng chờ trước khi rời trang.", "info"));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || !canUpdate || !isDirty) return;
    setMessage("");
    const values = Object.fromEntries(fields.map(([key]) => [key, links[key]?.trim() || null]));
    const parsed = externalLinksSchema.safeParse(values);
    if (!parsed.success) { validation.report(parsed.error.issues); return; }
    validation.reset();
    saving.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/external-links", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ values: parsed.data, expectedVersion: version.current }) });
      const body: unknown = await readAdminJson(response);
      if (!response.ok) throw adminApiError(body, "Không thể lưu liên kết ngoài.");
      const saved = saveResponseSchema.safeParse(body);
      if (!saved.success) throw new Error("Phản hồi lưu liên kết không hợp lệ. Hãy tải lại để kiểm tra trước khi lưu tiếp.");
      version.current = saved.data.version;
      setLinks(saved.data.links);
      markSaved(saved.data.links);
      showToast("Đã cập nhật liên kết ngoài trên website.", "success");
    } catch (error) {
      const notice = error instanceof Error ? error.message : "Không kết nối được máy chủ.";
      setMessage(notice); showToast(notice, "error");
    } finally { saving.current = false; setBusy(false); }
  }

  return <form className="grid gap-4" noValidate onSubmit={save}>
    {!canUpdate ? <AdminNotice tone="info">Bạn chỉ có quyền xem cấu hình. Cần quyền sửa cài đặt để thay đổi.</AdminNotice> : null}
    {validation.summary}
    {message ? <AdminNotice tone="error">{message}</AdminNotice> : null}
    <p className="admin-help">Điền URL đầy đủ, ví dụ https://ten-mien.vn. Để trống dịch vụ chưa sử dụng.</p>
    <fieldset className="grid gap-4" disabled={busy || !canUpdate}>
      {fields.map(([key, label]) => <AdminFormField error={validation.message(key)} id={validation.props(key).id} key={key} label={label}>
        <input {...validation.props(key)} className="block w-full" onChange={event => setLinks(current => ({ ...current, [key]: event.target.value || null }))} placeholder="https://…" type="url" value={links[key] ?? ""} />
      </AdminFormField>)}
    </fieldset>
    <AdminEditorActions><p role="status">{busy ? "Đang lưu liên kết…" : isDirty ? "Có thay đổi chưa lưu." : "Không có thay đổi chưa lưu."}</p>
      {isDirty ? <AdminButton disabled={busy} onClick={() => { setLinks(getSavedValue()); setMessage(""); validation.reset(); }} variant="secondary">Bỏ thay đổi</AdminButton> : null}
      <AdminButton disabled={busy || !isDirty} permission="settings.update" type="submit">{busy ? "Đang lưu…" : "Lưu liên kết ngoài"}</AdminButton>
    </AdminEditorActions>
  </form>;
}
