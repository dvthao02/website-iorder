"use client";

import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { publishingConfigSchema, type PublishingConfig } from "@iorder/core/server/settings/publishing.contract";
import { useAdminToast } from "@/components/admin/ui/admin-feedback";
import { MediaPicker } from "./media-picker";
import { AdminButton } from "./ui/admin-button";
import { useNavigationGuard } from "./ui/use-navigation-guard";

export function PublishingConfigEditor({ initial, initialVersion }: { initial: PublishingConfig; initialVersion: number }) {
  const version = useRef(initialVersion);
  const [config, setConfig] = useState(initial); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const [savedConfig, setSavedConfig] = useState(initial);
  const [isUploading, setIsUploading] = useState(false);
  const saving = useRef(false);
  const uploading = useRef(false);
  const dirty = JSON.stringify(config) !== JSON.stringify(savedConfig);
  useNavigationGuard(dirty || busy || isUploading);
  const handleUploadingChange = useCallback((pending: boolean) => {
    uploading.current = pending;
    setIsUploading(pending);
  }, []);
  const { show: showToast } = useAdminToast();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || uploading.current || !dirty) return;
    setMessage("");
    const parsed = publishingConfigSchema.safeParse(config);
    if (!parsed.success) {
      const notice = "Kiểm tra URL website, tiêu đề, mô tả và ảnh chia sẻ trước khi lưu.";
      setMessage(notice);
      showToast(notice, "error");
      return;
    }
    saving.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/publishing-config", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ values: parsed.data, expectedVersion: version.current }) });
      const body = await readAdminJson(response);
      if (!response.ok) throw adminApiError(body, "Không thể lưu cấu hình.");
      const result = publishingConfigSchema.safeParse(body.config);
      if (!result.success) throw new Error("Phản hồi lưu cấu hình không hợp lệ. Hãy kiểm tra lại cấu hình trước khi thử lưu lần nữa.");
      setConfig(current => JSON.stringify(current) === JSON.stringify(config) ? result.data : current);
      setSavedConfig(result.data);
      if (typeof body.version === "number") version.current = body.version;
      showToast("Đã cập nhật cấu hình xuất bản.", "success");
    } catch (error) {
      const notice = error instanceof Error ? error.message : "Không kết nối được máy chủ.";
      setMessage(notice);
      showToast(notice, "error");
    } finally { saving.current = false; setBusy(false); }
  }
  return <form className="grid gap-4" onSubmit={save}>
    <p>URL chính thức giúp tạo canonical, sitemap.xml và robots.txt. Để trống nếu chưa có domain production; website sẽ không tự công bố sitemap.</p>
    <label>URL website chính thức<input className="block w-full" type="url" value={config.siteUrl ?? ""} onChange={event => setConfig(current => ({ ...current, siteUrl: event.target.value || null }))} placeholder="https://www.ten-mien-cua-ban.vn" /></label>
    <label>Tiêu đề mặc định<input className="block w-full" maxLength={220} value={config.defaultTitle ?? ""} onChange={event => setConfig(current => ({ ...current, defaultTitle: event.target.value || null }))} /></label>
    <label>Mô tả mặc định<textarea className="block w-full" maxLength={180} rows={3} value={config.defaultDescription ?? ""} onChange={event => setConfig(current => ({ ...current, defaultDescription: event.target.value || null }))} /></label>
    <label className="flex gap-2"><input type="checkbox" checked={config.allowSearchIndexing} onChange={event => setConfig(current => ({ ...current, allowSearchIndexing: event.target.checked }))} />Cho phép công cụ tìm kiếm index website</label>
    <p>Ảnh chia sẻ mặc định</p>
    <MediaPicker disabled={busy} value={config.defaultOgMediaId} onUploadingChange={handleUploadingChange} onChange={defaultOgMediaId => setConfig(current => ({ ...current, defaultOgMediaId }))} />
    <AdminButton className="justify-self-start" disabled={busy || isUploading || !dirty} permission="settings.update" type="submit">{busy ? "Đang lưu…" : "Lưu cấu hình xuất bản"}</AdminButton>
    <p role="status">{isUploading ? "Đang tải ảnh chia sẻ lên…" : message || (dirty ? "Có thay đổi chưa lưu." : "Không có thay đổi chưa lưu.")}</p>
  </form>;
}
