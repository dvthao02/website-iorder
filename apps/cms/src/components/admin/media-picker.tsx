"use client";

import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { FileArchive, FileText, FolderOpen, LoaderCircle, Upload } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";

import type { MediaAsset, MediaUsage } from "@iorder/core/server/media/media.contract";
import { mediaAssetSchema, mediaListResponseSchema, mediaUsageSchema } from "@iorder/core/server/media/media.contract";
import { mergeMediaAssets } from "./ui/merge-media-assets";
import { isSelectableMediaType } from "./ui/media-selection-policy";

type MediaPickerProps = {
  disabled?: boolean;
  files?: boolean;
  /** Tiêu đề và gợi ý riêng cho từng chỗ dùng (mặc định: "Ảnh bìa"/"Tệp tải xuống"). */
  label?: string;
  hint?: string;
  /** Ảnh đã chọn hiện lớn theo khung chia sẻ 1200×630 (ảnh bìa bài viết…), nút "Tải ảnh khác"/"Bỏ ảnh" thay cho khung tải lên. */
  preview?: boolean;
  onChange: (id: string | null) => void;
  onUploaded?: (asset: MediaAsset) => Promise<void> | void;
  onUploadingChange?: (pending: boolean) => void;
  value: string | null;
};

export function MediaPicker({ disabled = false, value, onChange, files = false, onUploaded, onUploadingChange, label: customLabel, hint, preview = false }: MediaPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploading = useRef(false);
  const uploadController = useRef<AbortController | null>(null);
  const uploadingCallback = useRef(onUploadingChange);
  const attachment = useRef({ onChange, onUploaded, value, files });
  useEffect(() => { attachment.current = { onChange, onUploaded, value, files }; }, [onChange, onUploaded, value, files]);
  useEffect(() => { uploadingCallback.current = onUploadingChange; }, [onUploadingChange]);
  useEffect(() => () => {
    uploadController.current?.abort();
    if (uploading.current) uploadingCallback.current?.(false);
  }, []);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [error, setError] = useState("");
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [libraryAttempt, setLibraryAttempt] = useState(0);
  const [libraryPage, setLibraryPage] = useState(1);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => { if (searchDraft !== libraryQuery) { setLoaded(false); setLibraryError(""); setLibraryQuery(searchDraft); setLibraryPage(1); } }, 300);
    return () => clearTimeout(timer);
  }, [searchDraft, libraryQuery]);
  const [libraryAssets, setLibraryAssets] = useState<MediaAsset[]>([]);
  const [libraryTotal, setLibraryTotal] = useState(0);
  const [libraryPages, setLibraryPages] = useState(1);
  const [metadataResult, setMetadataResult] = useState<{ id: string; error?: string } | null>(null);
  const [usageResult, setUsageResult] = useState<{ id: string; items: MediaUsage[]; error?: string } | null>(null);
  const usage = usageResult?.id === value && !usageResult.error ? usageResult.items : null;
  const usageError = usageResult?.id === value ? usageResult.error : undefined;
  const shouldLoadLibrary = isLibraryOpen;

  useEffect(() => {
    if (!value) return;
    const controller = new AbortController();
    fetch(`/api/admin/media/${encodeURIComponent(value)}`, { signal: controller.signal }).then(async response => {
      const payload = await readAdminJson(response);
      if (!response.ok) throw adminApiError(payload, "Không tải được thông tin tệp đang chọn.");
      const parsed = mediaAssetSchema.safeParse(payload.asset);
      if (!parsed.success || parsed.data.id !== value) throw new Error("Thông tin tệp đang chọn không hợp lệ.");
      if (!isSelectableMediaType(parsed.data.mimeType, files)) throw new Error("Tệp đang chọn không đúng định dạng cho trường này. Vui lòng chọn lại tệp phù hợp.");
      if (controller.signal.aborted) return;
      setAssets(current => mergeMediaAssets(current, [parsed.data]).slice(-26));
      setMetadataResult({ id: value });
    }).catch(error => {
      if (!controller.signal.aborted) setMetadataResult({ id: value, error: error instanceof Error ? error.message : "Không tải được thông tin tệp đang chọn." });
    });
    return () => controller.abort();
  }, [value, files, libraryAttempt]);

  useEffect(() => {
    if (!shouldLoadLibrary) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(libraryPage), pageSize: "25", query: libraryQuery, type: files ? "documents" : "images" });
    fetch(`/api/admin/media?${params}`, { signal: controller.signal }).then(async (response) => {
      const payload = await readAdminJson(response);
      if (!response.ok) throw adminApiError(payload, "Không tải được thư viện tệp.");
      const parsed = mediaListResponseSchema.safeParse(payload);
      if (!parsed.success || parsed.data.page !== libraryPage || parsed.data.pageSize !== 25) throw new Error("Dữ liệu thư viện tệp không hợp lệ. Vui lòng thử tải lại.");
      if (controller.signal.aborted) return;
      setAssets(current => mergeMediaAssets(current.filter(asset => asset.id === attachment.current.value), parsed.data.assets));
      setLibraryAssets(parsed.data.assets.filter(asset => isSelectableMediaType(asset.mimeType, files)));
      setLibraryTotal(parsed.data.total);
      setLibraryPages(parsed.data.totalPages);
      setLoaded(true);
      setLibraryError("");
    }).catch((loadError) => {
      if (!controller.signal.aborted) setLibraryError(loadError instanceof Error ? loadError.message : "Không tải được thư viện tệp.");
    });
    return () => controller.abort();
  }, [files, libraryAttempt, shouldLoadLibrary, libraryPage, libraryQuery]);

  useEffect(() => {
    if (!value) return;
    const controller = new AbortController();
    fetch(`/api/admin/media/${value}/usage`, { signal: controller.signal }).then(async (response) => {
      const payload = await readAdminJson(response);
      if (!response.ok) throw adminApiError(payload, "Không kiểm tra được nơi sử dụng tệp.");
      const parsed = mediaUsageSchema.safeParse(payload);
      if (!parsed.success) throw new Error("Dữ liệu nơi sử dụng tệp không hợp lệ.");
      if (!controller.signal.aborted) setUsageResult({ id: value, items: parsed.data.items });
    }).catch((loadError) => {
      if (!controller.signal.aborted) setUsageResult({ id: value, items: [], error: loadError instanceof Error ? loadError.message : "Không kiểm tra được nơi sử dụng tệp." });
    });
    return () => controller.abort();
  }, [value]);

  async function upload(file: File | undefined) {
    if (!file || disabled || uploading.current) return;
    uploading.current = true;
    const controller = new AbortController();
    uploadController.current = controller;
    const initialSelection = attachment.current.value;
    const initialFiles = attachment.current.files;
    uploadingCallback.current?.(true);
    setError("");
    setIsUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/admin/media", { method: "POST", body, signal: controller.signal });
      const payload = await response.json().catch(() => null) as { asset?: MediaAsset; error?: { message?: string } } | null;
      if (controller.signal.aborted) return;
      if (!response.ok || !payload?.asset) throw adminApiError(payload, "Không thể tải tệp lên.");
      const parsed = mediaAssetSchema.safeParse(payload.asset);
      if (!parsed.success) throw new Error("Máy chủ đã nhận tệp nhưng phản hồi không hợp lệ. Hãy kiểm tra thư viện trước khi tải lại để tránh trùng tệp.");
      const asset = parsed.data;
      if (!isSelectableMediaType(asset.mimeType, initialFiles)) throw new Error("Tệp đã tải lên thư viện nhưng không đúng định dạng cho trường này. Hãy kiểm tra thư viện và chọn tệp phù hợp.");
      setAssets((current) => mergeMediaAssets(current, [asset]).slice(-26));
      if (attachment.current.value !== initialSelection || attachment.current.files !== initialFiles) {
        setError("Tệp đã được tải lên thư viện nhưng lựa chọn đã thay đổi. Hãy chọn lại tệp từ thư viện nếu cần gắn vào nội dung.");
        return;
      }
      try {
        attachment.current.onChange(asset.id);
        await attachment.current.onUploaded?.(asset);
      } catch (attachmentError) {
        const detail = attachmentError instanceof Error ? attachmentError.message : "Không thể lưu liên kết tệp.";
        if (!controller.signal.aborted) setError(`Tệp đã được tải lên thư viện, nhưng chưa hoàn tất gắn vào nội dung. ${detail}`);
      }
    } catch (uploadError) {
      if (!controller.signal.aborted) setError(uploadError instanceof Error ? uploadError.message : "Không thể tải tệp lên.");
    } finally {
      uploading.current = false;
      uploadController.current = null;
      if (!controller.signal.aborted) {
        setIsUploading(false);
        uploadingCallback.current?.(false);
      }
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function dropFile(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    if (!disabled && !isUploading) void upload(event.dataTransfer.files?.[0]);
  }
  const dropTarget = {
    onDragOver: (event: DragEvent<HTMLElement>) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setDragging(true); } },
    onDragLeave: () => setDragging(false),
    onDrop: dropFile,
  };
  const formats = files ? "PDF hoặc ZIP, tối đa 20 MB" : "PNG, JPEG hoặc WebP · tối đa 20 MB";
  const selected = assets.find((asset) => asset.id === value);
  // Ảnh đã chọn hiện bản xem trước nhỏ thay cho biểu tượng tệp.
  // eslint-disable-next-line @next/next/no-img-element -- ảnh xem trước nhỏ trong CMS
  const thumbnail = selected?.mimeType.startsWith("image/") ? <img alt="" src={selected.url} /> : null;
  const label = customLabel ?? (files ? "Tệp tải xuống" : "Ảnh bìa");
  const showPreview = preview && Boolean(thumbnail);
  // eslint-disable-next-line @next/next/no-img-element -- ảnh xem trước lớn trong CMS
  const largeImage = showPreview && selected ? <img alt={selected.altText ?? ""} src={selected.url} /> : null;

  return <section className="media-picker">
    <div className="media-picker__heading"><div><h3>{label}</h3><p>{hint ?? formats}</p></div>{selected ? <span className="media-picker__selected">Đã chọn</span> : null}</div>
    <input accept={files ? ".pdf,.zip,application/pdf,application/zip" : "image/png,image/jpeg,image/webp"} className="sr-only" disabled={disabled || isUploading} onChange={(event) => void upload(event.target.files?.[0])} ref={inputRef} type="file" />
    {showPreview && selected ? <figure className={dragging ? "media-picker__preview media-picker__preview--drop" : "media-picker__preview"} {...dropTarget}>{largeImage}<figcaption>{selected.originalName}</figcaption></figure> : null}
    {showPreview ? null : <button className={dragging ? "media-picker__upload media-picker__upload--drop" : "media-picker__upload"} disabled={disabled || isUploading} onClick={() => inputRef.current?.click()} type="button" {...dropTarget}>
      {isUploading ? <LoaderCircle aria-hidden="true" className="animate-spin" size={20} /> : <Upload aria-hidden="true" size={20} />}
      <span><strong>{isUploading ? "Đang tải tệp lên…" : dragging ? "Thả tệp để tải lên" : files ? "Kéo tệp vào đây hoặc bấm để chọn" : "Kéo ảnh vào đây hoặc bấm để chọn"}</strong><small>{files ? "Tệp mới sẽ được gắn và lưu ngay vào tài nguyên này." : hint ? formats : "Tải trực tiếp từ máy tính của bạn."}</small></span>
    </button>}
    {selected && !showPreview ? <div className="media-picker__file"><span className="media-picker__file-icon">{thumbnail ?? (selected.mimeType === "application/zip" ? <FileArchive aria-hidden="true" size={20} /> : <FileText aria-hidden="true" size={20} />)}</span><span><strong>{selected.originalName}</strong><small>{selected.mimeType === "application/pdf" ? "Tài liệu PDF" : selected.mimeType === "application/zip" ? "Tệp ZIP" : selected.mimeType.startsWith("image/") ? "Ảnh đã chọn" : "Tệp đã chọn"}</small></span><a href={selected.url} rel="noreferrer" target="_blank">Mở tệp</a></div> : null}
    <div className="media-picker__library">{showPreview ? <button disabled={disabled || isUploading} onClick={() => inputRef.current?.click()} type="button"><Upload aria-hidden="true" size={16} />{isUploading ? "Đang tải…" : "Tải ảnh khác"}</button> : null}<button aria-expanded={isLibraryOpen} disabled={disabled || isUploading} onClick={() => { setLoaded(false); setLibraryError(""); setIsLibraryOpen((current) => !current); }} type="button"><FolderOpen aria-hidden="true" size={16} />{isLibraryOpen ? "Đóng thư viện" : "Chọn từ thư viện"}</button>{value ? <button disabled={disabled || isUploading} onClick={() => onChange(null)} type="button">{showPreview ? "Bỏ ảnh" : "Bỏ chọn"}</button> : null}</div>
    {isLibraryOpen ? <div className="grid gap-3">
      <label>{files ? "Tìm tệp" : "Tìm ảnh"}<input className="admin-input" disabled={disabled || isUploading} maxLength={160} onChange={event => setSearchDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} placeholder="Tên tệp, mô tả hoặc chú thích…" value={searchDraft} /></label>
      {files ? <label className="media-picker__library-select">Tệp đã tải lên trước đó<select className="admin-input" disabled={disabled || isUploading || !loaded || searchDraft !== libraryQuery} onChange={(event) => { if (!disabled && !uploading.current && loaded && searchDraft === libraryQuery) onChange(event.target.value || null); }} value={value ?? ""}>
        <option value="">Chưa chọn tệp</option>
        {value && !libraryAssets.some(asset => asset.id === value) ? <option value={value}>{selected?.originalName ?? "Tệp đang liên kết"} (đang chọn)</option> : null}
        {libraryAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.originalName}</option>)}
      </select></label> : <div aria-label="Ảnh trong thư viện" className="media-picker__grid" role="listbox">
        {libraryAssets.map(asset => <button aria-label={asset.originalName} aria-selected={asset.id === value} className={asset.id === value ? "media-picker__thumb media-picker__thumb--selected" : "media-picker__thumb"} disabled={disabled || isUploading || !loaded || searchDraft !== libraryQuery} key={asset.id} onClick={() => { if (!disabled && !uploading.current && loaded && searchDraft === libraryQuery) { onChange(asset.id); setIsLibraryOpen(false); } }} role="option" title={asset.originalName} type="button">
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh thu nhỏ trong CMS */}
          <img alt="" loading="lazy" src={asset.url} />
          <span>{asset.originalName}</span>
        </button>)}
        {loaded && !libraryAssets.length ? <p className="admin-help">Không có ảnh phù hợp.</p> : null}
      </div>}
      {/* Chỉ hiện nút trang khi có nhiều trang; luôn báo số kết quả. */}
      <div className="flex flex-wrap items-center gap-3">
        {libraryPages > 1 ? <button disabled={disabled || isUploading || !loaded || libraryPage <= 1 || searchDraft !== libraryQuery} onClick={() => { setLoaded(false); setLibraryPage(page => page - 1); }} type="button">Trang trước</button> : null}
        <span className="admin-help" role="status">{loaded ? `${libraryTotal} ${files ? "tệp" : "ảnh"}${libraryPages > 1 ? ` · Trang ${libraryPage}/${libraryPages}` : ""}` : "Đang tải kết quả…"}</span>
        {libraryPages > 1 ? <button disabled={disabled || isUploading || !loaded || libraryPage >= libraryPages || searchDraft !== libraryQuery} onClick={() => { setLoaded(false); setLibraryPage(page => page + 1); }} type="button">Trang sau</button> : null}
      </div>
    </div> : null}
    {value && usage ? <div className="media-picker__usage"><strong>{usage.length ? `Đang dùng tại ${usage.length} vị trí` : "Tệp chưa được dùng ở nơi khác"}</strong>{usage.length ? <ul>{usage.slice(0, 4).map((item) => <li key={`${item.entityType}-${item.entityId}`}>{item.location}: {item.label}</li>)}</ul> : null}</div> : null}
    {error ? <p className="media-picker__error" role="alert">{error}</p> : null}
    {value && metadataResult?.id === value && metadataResult.error ? <div role="alert"><p className="media-picker__error">{metadataResult.error}</p><button disabled={disabled || isUploading} onClick={() => { setMetadataResult(null); setLibraryAttempt(attempt => attempt + 1); }} type="button">Thử tải lại thông tin tệp</button></div> : value && metadataResult?.id !== value ? <p role="status">Đang tải thông tin tệp đang chọn…</p> : null}
    {shouldLoadLibrary && libraryError ? <div role="alert"><p className="media-picker__error">{libraryError}</p><button disabled={disabled} onClick={() => { setLibraryError(""); setLoaded(false); setLibraryAttempt((attempt) => attempt + 1); }} type="button">Thử tải lại thư viện</button></div> : shouldLoadLibrary && !loaded ? <p role="status">Đang tải thư viện tệp…</p> : null}
    {usageError ? <p className="media-picker__error" role="alert">{usageError}</p> : null}
  </section>;
}
