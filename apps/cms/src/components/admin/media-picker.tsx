"use client";

import { FileArchive, FileText, FolderOpen, LoaderCircle, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { MediaAsset, MediaUsage } from "@iorder/core/server/media/media.contract";

type MediaPickerProps = {
  disabled?: boolean;
  files?: boolean;
  onChange: (id: string | null) => void;
  onUploaded?: (asset: MediaAsset) => Promise<void> | void;
  value: string | null;
};

function isAllowedDocument(asset: MediaAsset) {
  return ["application/pdf", "application/zip"].includes(asset.mimeType);
}

export function MediaPicker({ disabled = false, value, onChange, files = false, onUploaded }: MediaPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [error, setError] = useState("");
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [usage, setUsage] = useState<MediaUsage[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/media", { signal: controller.signal }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Không tải được thư viện tệp.");
      setAssets(payload.assets.filter((asset: MediaAsset) => files ? isAllowedDocument(asset) : ["image/png", "image/jpeg", "image/webp"].includes(asset.mimeType)));
      setLoaded(true);
    }).catch((loadError) => {
      if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "Không tải được thư viện tệp.");
    });
    return () => controller.abort();
  }, [files]);

  useEffect(() => {
    if (!value) return;
    const controller = new AbortController();
    fetch(`/api/admin/media/${value}/usage`, { signal: controller.signal }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Không kiểm tra được nơi sử dụng tệp.");
      setUsage(payload.items);
    }).catch((usageError) => {
      if (!controller.signal.aborted) setError(usageError instanceof Error ? usageError.message : "Không kiểm tra được nơi sử dụng tệp.");
    });
    return () => controller.abort();
  }, [value]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError("");
    setIsUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/admin/media", { method: "POST", body });
      const payload = await response.json().catch(() => null) as { asset?: MediaAsset; error?: { message?: string } } | null;
      if (!response.ok || !payload?.asset) throw new Error(payload?.error?.message || "Không thể tải tệp lên.");
      setAssets((current) => [payload.asset!, ...current.filter((asset) => asset.id !== payload.asset!.id)]);
      onChange(payload.asset.id);
      await onUploaded?.(payload.asset);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Không thể tải tệp lên.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const selected = assets.find((asset) => asset.id === value);
  const label = files ? "Tệp tải xuống" : "Ảnh bìa";

  return <section className="media-picker">
    <div className="media-picker__heading"><div><h3>{label}</h3><p>{files ? "PDF hoặc ZIP, tối đa 20 MB" : "PNG, JPEG hoặc WebP, tối đa 20 MB"}</p></div>{selected ? <span className="media-picker__selected">Đã chọn</span> : null}</div>
    <input accept={files ? ".pdf,.zip,application/pdf,application/zip" : "image/png,image/jpeg,image/webp"} className="sr-only" disabled={disabled || isUploading} onChange={(event) => void upload(event.target.files?.[0])} ref={inputRef} type="file" />
    <button className="media-picker__upload" disabled={disabled || isUploading} onClick={() => inputRef.current?.click()} type="button">
      {isUploading ? <LoaderCircle aria-hidden="true" className="animate-spin" size={20} /> : <Upload aria-hidden="true" size={20} />}
      <span><strong>{isUploading ? "Đang tải tệp lên…" : files ? "Tải PDF hoặc ZIP lên" : "Tải ảnh lên"}</strong><small>{files ? "Tệp mới sẽ được gắn và lưu ngay vào tài nguyên này." : "Tải trực tiếp từ máy tính của bạn."}</small></span>
    </button>
    {selected ? <div className="media-picker__file"><span className="media-picker__file-icon">{selected.mimeType === "application/zip" ? <FileArchive aria-hidden="true" size={20} /> : <FileText aria-hidden="true" size={20} />}</span><span><strong>{selected.originalName}</strong><small>{selected.mimeType === "application/pdf" ? "Tài liệu PDF" : selected.mimeType === "application/zip" ? "Tệp ZIP" : "Tệp đã chọn"}</small></span><a href={selected.url} rel="noreferrer" target="_blank">Mở tệp</a></div> : null}
    <div className="media-picker__library"><button disabled={disabled || !loaded} onClick={() => setIsLibraryOpen((current) => !current)} type="button"><FolderOpen aria-hidden="true" size={16} />{isLibraryOpen ? "Ẩn thư viện tệp" : "Chọn từ thư viện"}</button>{value ? <button disabled={disabled} onClick={() => onChange(null)} type="button">Bỏ chọn</button> : null}</div>
    {isLibraryOpen ? <label className="media-picker__library-select">Tệp đã tải lên trước đó<select className="admin-input" disabled={disabled || !loaded} onChange={(event) => onChange(event.target.value || null)} value={value ?? ""}><option value="">Chưa chọn tệp</option>{value && !selected ? <option value={value}>Tệp đang liên kết</option> : null}{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.originalName}</option>)}</select></label> : null}
    {value && usage ? <div className="media-picker__usage"><strong>{usage.length ? `Đang dùng tại ${usage.length} vị trí` : "Tệp chưa được dùng ở nơi khác"}</strong>{usage.length ? <ul>{usage.slice(0, 4).map((item) => <li key={`${item.entityType}-${item.entityId}`}>{item.location}: {item.label}</li>)}</ul> : null}</div> : null}
    {error ? <p className="media-picker__error" role="alert">{error}</p> : null}
  </section>;
}
