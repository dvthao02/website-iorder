"use client";

import { FileArchive, FileText, ImageIcon, UploadCloud } from "lucide-react";
import Image from "next/image";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";

import type { MediaAsset } from "@iorder/core/server/media/media.contract";

import { AdminButton } from "./ui/admin-button";
import { AdminCard } from "./ui/admin-card";
import { AdminEmptyState } from "./ui/admin-empty-state";
import { AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";

type MediaFilter = "all" | "images" | "documents";

export function MediaManager({ initialAssets }: { initialAssets: MediaAsset[] }) {
  const { show: showToast } = useAdminToast();
  const [assets, setAssets] = useState(initialAssets);
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [busy, setBusy] = useState(false);
  const visibleAssets = useMemo(() => assets.filter((asset) => filter === "all" || (filter === "images" ? isImage(asset) : !isImage(asset))), [assets, filter]);
  const imageCount = assets.filter(isImage).length;

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/media", { method: "POST", body: new FormData(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Không thể tải tệp lên.");
      setAssets((current) => [result.asset, ...current]);
      form.reset();
      showToast("Đã tải tệp lên thư viện.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      setBusy(false);
    }
  }

  return <div className="grid gap-5">
    <div className="grid gap-3 sm:grid-cols-3">
      <MediaSummary icon={<FileArchive aria-hidden="true" size={18} />} label="Tất cả tệp" value={assets.length} />
      <MediaSummary icon={<ImageIcon aria-hidden="true" size={18} />} label="Hình ảnh" value={imageCount} />
      <MediaSummary icon={<FileText aria-hidden="true" size={18} />} label="Tài liệu" value={assets.length - imageCount} />
    </div>

    <AdminCard className="p-5 sm:p-6">
      <form className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end" onSubmit={upload}>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Chọn ảnh hoặc tài liệu
          <input accept="image/png,image/jpeg,image/webp,application/pdf,application/zip" className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-normal file:mr-4 file:rounded-lg file:border-0 file:bg-blue-100 file:px-3 file:py-2 file:font-bold file:text-blue-800" name="file" required type="file" />
          <span className="font-normal text-slate-500">PNG, JPEG, WebP, PDF hoặc ZIP; dung lượng tối đa 20 MB.</span>
        </label>
        <AdminButton disabled={busy} type="submit"><UploadCloud aria-hidden="true" size={17} />{busy ? "Đang tải…" : "Tải lên"}</AdminButton>
      </form>
    </AdminCard>

    <AdminCard className="p-0">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
        <div><h2 className="text-lg font-extrabold text-slate-950">Thư viện tệp</h2><p className="mt-1 text-sm text-slate-600">Bổ sung mô tả thay thế cho hình ảnh trước khi đưa lên website.</p></div>
        <div aria-label="Lọc loại tệp" className="flex gap-2">{(["all", "images", "documents"] as const).map((value) => <button className={filter === value ? "rounded-full bg-blue-100 px-3 py-1.5 text-sm font-bold text-blue-800" : "rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-200"} key={value} onClick={() => setFilter(value)} type="button">{value === "all" ? "Tất cả" : value === "images" ? "Hình ảnh" : "Tài liệu"}</button>)}</div>
      </header>
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        {visibleAssets.map((asset) => <MediaEditor asset={asset} key={asset.id} />)}
        {visibleAssets.length === 0 ? <div className="lg:col-span-2"><AdminEmptyState description={assets.length === 0 ? "Tải ảnh và tài liệu lên để sử dụng trong trang, bài viết, catalog và nội dung thương hiệu." : "Không có tệp nào thuộc loại đang chọn."} icon={<ImageIcon aria-hidden="true" size={21} />} title={assets.length === 0 ? "Thư viện chưa có tệp" : "Không có kết quả"} /></div> : null}
      </div>
    </AdminCard>
  </div>;
}

function MediaEditor({ asset }: { asset: MediaAsset }) {
  const { show: showToast } = useAdminToast();
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/media/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ altText: String(form.get("altText") || "").trim() || null, caption: String(form.get("caption") || "").trim() || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Không thể lưu thông tin tệp.");
      showToast("Đã lưu thông tin tệp.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      setBusy(false);
    }
  }

  return <form className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4" onSubmit={save}>
    <div className="grid grid-cols-[5rem_1fr] gap-4">
      <a className="relative grid h-20 w-20 place-items-center overflow-hidden rounded-xl bg-slate-100 text-slate-500" href={asset.url} rel="noreferrer" target="_blank">{isImage(asset) ? <Image alt={asset.altText || asset.originalName} className="object-cover" fill sizes="80px" src={asset.url} unoptimized /> : <FileText aria-hidden="true" size={25} />}</a>
      <div className="min-w-0"><a className="block truncate font-bold text-blue-700 hover:underline" href={asset.url} rel="noreferrer" target="_blank">{asset.originalName}</a><p className="mt-1 text-xs text-slate-500">{asset.mimeType} · {formatFileSize(asset.fileSize)}</p><div className="mt-2"><AdminStatusBadge tone={isImage(asset) && !asset.altText ? "warning" : "success"}>{isImage(asset) && !asset.altText ? "Thiếu mô tả ảnh" : "Đã sẵn sàng"}</AdminStatusBadge></div></div>
    </div>
    <label className="grid gap-1.5 text-sm font-bold text-slate-700">Mô tả thay thế ảnh<input className="rounded-lg border border-slate-300 px-3 py-2 font-normal" defaultValue={asset.altText ?? ""} maxLength={500} name="altText" placeholder="Mô tả nội dung hình ảnh cho SEO và trợ năng" /></label>
    <label className="grid gap-1.5 text-sm font-bold text-slate-700">Chú thích<textarea className="rounded-lg border border-slate-300 px-3 py-2 font-normal" defaultValue={asset.caption ?? ""} maxLength={10000} name="caption" rows={3} /></label>
    <AdminButton className="justify-self-start" disabled={busy} type="submit" variant="secondary">{busy ? "Đang lưu…" : "Lưu thông tin"}</AdminButton>
  </form>;
}

function MediaSummary({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return <section className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700">{icon}</span><span><small className="block text-sm text-slate-500">{label}</small><strong className="text-xl text-slate-950">{value}</strong></span></section>;
}

function isImage(asset: MediaAsset) { return asset.mimeType.startsWith("image/"); }
function formatFileSize(bytes: number) { return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`; }
