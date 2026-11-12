"use client";

import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { publishingConfigSchema, type PublishingConfig } from "@iorder/shared/server/settings/publishing.contract";
import { expectedVersionSchema } from "@iorder/shared/server/shared/content-version";
import { AdminNotice, useAdminToast } from "./ui/admin-feedback";
import { MediaPicker } from "./media-picker";
import { AdminButton } from "./ui/admin-button";
import { AdminEditorActions } from "./ui/admin-editor-actions";
import { useAdminPermissions } from "./ui/admin-permissions";
import { AdminFormField } from "./ui/admin-form-field";
import { useAdminFormValidation } from "./ui/use-admin-form-validation";
import { useNavigationGuard } from "./ui/use-navigation-guard";

const saveResponseSchema = z.object({ config: publishingConfigSchema, version: expectedVersionSchema });

export function PublishingConfigEditor({ initial, initialVersion }: { initial: PublishingConfig; initialVersion: number }) {
  const version = useRef(initialVersion);
  const { can } = useAdminPermissions();
  const canUpdate = can("settings.update");
  const [config, setConfig] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [savedConfig, setSavedConfig] = useState(initial);
  const [isUploading, setIsUploading] = useState(false);
  const saving = useRef(false);
  const uploading = useRef(false);
  const dirty = JSON.stringify(config) !== JSON.stringify(savedConfig);
  const { show: showToast } = useAdminToast();
  const validation = useAdminFormValidation<keyof PublishingConfig>("publishing", {
    siteUrl: { label: "Địa chỉ website chính thức", message: "Nhập URL HTTP hoặc HTTPS hợp lệ, tối đa 1.000 ký tự, hoặc để trống." },
    defaultTitle: { label: "Tiêu đề mặc định", message: "Nhập tiêu đề từ 1 đến 220 ký tự hoặc để trống." },
    defaultDescription: { label: "Mô tả mặc định", message: "Nhập mô tả từ 1 đến 180 ký tự hoặc để trống." },
    defaultOgMediaId: { label: "Ảnh chia sẻ mặc định", message: "Chọn ảnh hợp lệ từ thư viện." },
    allowSearchIndexing: { label: "Hiển thị trên công cụ tìm kiếm", message: "Chọn trạng thái cho phép công cụ tìm kiếm hiển thị website." },
  });
  useNavigationGuard(dirty);
  useNavigationGuard(busy || isUploading, () => showToast("Đang xử lý cấu hình. Vui lòng chờ trước khi rời trang.", "info"));
  const handleUploadingChange = useCallback((pending: boolean) => { uploading.current = pending; setIsUploading(pending); }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || uploading.current || !canUpdate || !dirty) return;
    setMessage("");
    const parsed = publishingConfigSchema.safeParse({ ...config, siteUrl: config.siteUrl?.trim() || null });
    if (!parsed.success) { validation.report(parsed.error.issues); return; }
    validation.reset();
    saving.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/v1/admin/publishing-config", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ values: parsed.data, expectedVersion: version.current }) });
      const body: unknown = await readAdminJson(response);
      if (!response.ok) throw adminApiError(body, "Không thể lưu cấu hình.");
      const result = saveResponseSchema.safeParse(body);
      if (!result.success) throw new Error("Phản hồi lưu cấu hình không hợp lệ. Hãy tải lại để kiểm tra trước khi lưu tiếp.");
      setConfig(result.data.config); setSavedConfig(result.data.config);
      version.current = result.data.version;
      showToast("Đã cập nhật cấu hình xuất bản.", "success");
    } catch (error) {
      const notice = error instanceof Error ? error.message : "Không kết nối được máy chủ.";
      setMessage(notice); showToast(notice, "error");
    } finally { saving.current = false; setBusy(false); }
  }

  return <form className="grid gap-4" noValidate onSubmit={save}>
    {!canUpdate ? <AdminNotice tone="info">Bạn chỉ có quyền xem cấu hình. Cần quyền sửa cài đặt để thay đổi.</AdminNotice> : null}
    {validation.summary}
    {message ? <AdminNotice tone="error">{message}</AdminNotice> : null}
    <fieldset className="grid gap-4" disabled={busy || isUploading || !canUpdate}>
      <AdminFormField error={validation.message("siteUrl")} hint="Dùng cho Google và khi chia sẻ liên kết. Để trống nếu chưa có tên miền chính thức." id="publishing-siteUrl" label="Địa chỉ website chính thức">
        <input {...validation.props("siteUrl")} aria-describedby={["publishing-siteUrl-hint", validation.props("siteUrl")["aria-describedby"]].filter(Boolean).join(" ")} className="block w-full" onChange={event => setConfig(current => ({ ...current, siteUrl: event.target.value || null }))} placeholder="https://www.ten-mien-cua-ban.vn" type="url" value={config.siteUrl ?? ""} />
      </AdminFormField>
      <AdminFormField error={validation.message("defaultTitle")} id="publishing-defaultTitle" label="Tiêu đề mặc định">
        <input {...validation.props("defaultTitle")} className="block w-full" maxLength={220} onChange={event => setConfig(current => ({ ...current, defaultTitle: event.target.value || null }))} placeholder="Tên thương hiệu – mô tả ngắn" value={config.defaultTitle ?? ""} />
      </AdminFormField>
      <AdminFormField error={validation.message("defaultDescription")} id="publishing-defaultDescription" label="Mô tả mặc định">
        <textarea {...validation.props("defaultDescription")} className="block w-full" maxLength={180} onChange={event => setConfig(current => ({ ...current, defaultDescription: event.target.value || null }))} placeholder="1–2 câu giới thiệu doanh nghiệp, dùng khi trang chưa có mô tả riêng." rows={3} value={config.defaultDescription ?? ""} />
      </AdminFormField>
      <div><label className="admin-check" htmlFor="publishing-allowSearchIndexing"><input {...validation.props("allowSearchIndexing")} checked={config.allowSearchIndexing} onChange={event => setConfig(current => ({ ...current, allowSearchIndexing: event.target.checked }))} type="checkbox" />Cho phép Google và các công cụ tìm kiếm hiển thị website</label>{validation.message("allowSearchIndexing")}</div>
      <div {...validation.props("defaultOgMediaId")} tabIndex={-1}><MediaPicker disabled={busy} hint="Hiện khi chia sẻ liên kết lên Facebook/Zalo nếu trang không có ảnh riêng. Nên dùng ảnh ngang 1200×630." label="Ảnh chia sẻ mặc định" value={config.defaultOgMediaId} onUploadingChange={handleUploadingChange} onChange={defaultOgMediaId => setConfig(current => ({ ...current, defaultOgMediaId }))} />{validation.message("defaultOgMediaId")}</div>
    </fieldset>
    <AdminEditorActions><p role="status">{isUploading ? "Đang tải ảnh chia sẻ lên…" : busy ? "Đang lưu cấu hình…" : dirty ? "Có thay đổi chưa lưu." : "Không có thay đổi chưa lưu."}</p>
      {dirty ? <AdminButton disabled={busy || isUploading} onClick={() => { setConfig(savedConfig); setMessage(""); validation.reset(); }} variant="secondary">Bỏ thay đổi</AdminButton> : null}
      <AdminButton disabled={busy || isUploading || !dirty} permission="settings.update" type="submit">{busy ? "Đang lưu…" : "Lưu thay đổi"}</AdminButton>
    </AdminEditorActions>
  </form>;
}
