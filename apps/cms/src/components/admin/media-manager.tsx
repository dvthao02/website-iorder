"use client";

import { adminApiError } from "@/lib/admin-api";
import { FileText, ImageIcon, UploadCloud } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import type { MediaAsset, MediaListQuery } from "@iorder/core/server/media/media.contract";
import { mediaAssetSchema, mediaListResponseSchema } from "@iorder/core/server/media/media.contract";

import { AdminButton } from "./ui/admin-button";
import { AdminCard } from "./ui/admin-card";
import { AdminEmptyState } from "./ui/admin-empty-state";
import { useAdminConfirm } from "./ui/admin-confirm-dialog";
import { AdminNotice, AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";
import { AdminFilterBar } from "./ui/admin-filter-bar";
import { AdminListHeader } from "./ui/admin-list-header";
import { AdminListPage } from "./ui/admin-list-page";
import { AdminSearchField } from "./ui/admin-search-field";
import { useUnsavedChanges } from "./ui/use-unsaved-changes";
import { useNavigationGuard } from "./ui/use-navigation-guard";

type MediaFilter = "all" | "images" | "documents";

export function MediaManager({ initialPage, initialQuery }: { initialPage: { assets: MediaAsset[]; page: number; pageSize: number; total: number; totalPages: number }; initialQuery: MediaListQuery }) {
  const { show: showToast } = useAdminToast();
  const [assets, setAssets] = useState(initialPage.assets);
  const [page, setPage] = useState(initialPage.page);
  const [total, setTotal] = useState(initialPage.total);
  const totalPages = Math.max(1, Math.ceil(total / 25));
  const [loading, setLoading] = useState(false);
  const listing = useRef(false);
  const [listError, setListError] = useState("");
  const [query, setQuery] = useState(initialQuery.query);
  const [searchDraft, setSearchDraft] = useState(initialQuery.query);
  const [filter, setFilter] = useState<MediaFilter>(initialQuery.type);
  const [busy, setBusy] = useState(false);
  const uploading = useRef(false);
  const editorStates = useRef(new Map<string, { dirty: boolean; pending: boolean }>());
  const reportEditorState = useCallback((id: string, state: { dirty: boolean; pending: boolean } | null) => {
    if (state) editorStates.current.set(id, state);
    else editorStates.current.delete(id);
  }, []);
  useNavigationGuard(busy, () => showToast("Đang tải tệp lên. Vui lòng chờ trước khi rời thư viện.", "info"));

  async function loadPage(nextPage: number, nextFilter: MediaFilter = filter, nextQuery: string = query) {
    if (listing.current || uploading.current || [...editorStates.current.values()].some(state => state.pending || state.dirty)) {
      showToast("Hãy hoàn tất xử lý và lưu hoặc bỏ thay đổi thông tin tệp trước khi chuyển bộ lọc.", "warning");
      return;
    }
    listing.current = true;
    setLoading(true);
    setListError("");
    try {
      const params = new URLSearchParams({ page: String(nextPage), pageSize: "25", type: nextFilter, query: nextQuery });
      const response = await fetch(`/api/admin/media?${params}`);
      const body = await response.json();
      if (!response.ok) throw adminApiError(body, "Không tải được danh sách tệp.");
      const result = mediaListResponseSchema.safeParse(body);
      if (!result.success || result.data.page !== nextPage || result.data.pageSize !== 25) throw new Error("Phản hồi danh sách tệp không hợp lệ.");
      setAssets(result.data.assets);
      setPage(result.data.page);
      setTotal(result.data.total);
      setFilter(nextFilter);
      setQuery(nextQuery);
      const url = new URL(window.location.href);
      url.searchParams.set("page", String(result.data.page));
      url.searchParams.set("type", nextFilter);
      if (nextQuery) url.searchParams.set("query", nextQuery); else url.searchParams.delete("query");
      window.history.replaceState(null, "", url);
    } catch (error) { setListError(error instanceof Error ? error.message : "Không tải được danh sách tệp."); }
    finally { listing.current = false; setLoading(false); }
  }

  function changeFilter(next: MediaFilter) { void loadPage(1, next); }

  function handleDeleted(id: string) {
    setAssets(current => current.filter(item => item.id !== id));
    setTotal(current => Math.max(0, current - 1));
  }
  const visibleAssets = useMemo(() => assets.filter((asset) => filter === "all" || (filter === "images" ? isImage(asset) : !isImage(asset))), [assets, filter]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading.current || listing.current) return;
    if ([...editorStates.current.values()].some(state => state.pending || state.dirty)) {
      showToast("Hãy lưu hoặc bỏ thay đổi thông tin tệp trước khi tải tệp mới lên.", "warning");
      return;
    }
    uploading.current = true;
    const form = event.currentTarget;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/media", { method: "POST", body: new FormData(form) });
      const result = await response.json();
      if (!response.ok || !result.asset?.id) throw adminApiError(result, "Không thể tải tệp lên.");
      const parsed = mediaAssetSchema.safeParse(result.asset);
      if (!parsed.success) throw new Error("Máy chủ đã nhận tệp nhưng phản hồi không hợp lệ. Hãy kiểm tra thư viện trước khi tải lại.");
      if (!query && page === 1 && (filter === "all" || (filter === "images" ? isImage(parsed.data) : !isImage(parsed.data)))) {
        setAssets((current) => [parsed.data, ...current.filter(asset => asset.id !== parsed.data.id)].slice(0, 25));
      }
      if (!query && (filter === "all" || (filter === "images" ? isImage(parsed.data) : !isImage(parsed.data)))) {
        setTotal(total + 1);
      }
      form.reset();
      showToast(query ? "Đã tải tệp lên. Tìm kiếm lại hoặc xóa từ khóa để thấy tệp mới." : "Đã tải tệp lên thư viện.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      uploading.current = false;
      setBusy(false);
    }
  }

  return <AdminListPage>
    <AdminCard>
      <AdminListHeader description={`${total} tệp`} title="Thư viện media" />
      <form className="admin-list-toolbar" onSubmit={upload}>
        <input accept="image/png,image/jpeg,image/webp,application/pdf,application/zip" aria-label="Chọn ảnh hoặc tài liệu" name="file" required type="file" />
        <span className="admin-field__hint">PNG, JPEG, WebP, PDF hoặc ZIP; tối đa 20 MB.</span>
        <AdminButton className="ml-auto" disabled={busy || loading} permission="media.create" type="submit"><UploadCloud aria-hidden="true" />{busy ? "Đang tải…" : "Tải lên"}</AdminButton>
      </form>
      <AdminFilterBar onSubmit={(event) => { event.preventDefault(); void loadPage(1, filter, searchDraft); }}>
        <AdminSearchField disabled={loading || busy} label="Tìm tệp" maxLength={160} onChange={event => setSearchDraft(event.target.value)} placeholder="Tên tệp, mô tả hoặc chú thích" value={searchDraft} />
        <select aria-label="Lọc loại tệp" disabled={loading || busy} onChange={(event) => changeFilter(event.target.value as MediaFilter)} value={filter}><option value="all">Tất cả loại tệp</option><option value="images">Hình ảnh</option><option value="documents">Tài liệu</option></select>
      </AdminFilterBar>
      {listError ? <div className="admin-list-toolbar"><AdminNotice tone="error">{listError}</AdminNotice><AdminButton disabled={loading} onClick={() => void loadPage(page)} size="sm" variant="secondary">Thử lại</AdminButton></div> : null}
      <fieldset className="min-w-0" disabled={loading || busy}>
      <div className="admin-card-grid">
        {assets.map((asset) => <div key={asset.id}><MediaEditor asset={asset} onStateChange={reportEditorState} onDeleted={handleDeleted} onSaved={(saved) => setAssets((current) => current.map((item) => item.id === saved.id ? saved : item))} /></div>)}
        {visibleAssets.length === 0 ? <div><AdminEmptyState description={filter === "all" && !query && total === 0 ? "Tải ảnh và tài liệu lên để sử dụng trong trang, bài viết, catalog và nội dung thương hiệu." : "Thử từ khóa hoặc bộ lọc khác; nếu trang hiện tại đã hết dữ liệu, hãy quay về trang trước."} icon={<ImageIcon aria-hidden="true" size={21} />} title={filter === "all" && !query && total === 0 ? "Thư viện chưa có tệp" : "Không có kết quả"} /></div> : null}
      </div>
      </fieldset>
      <nav aria-label="Phân trang" className="admin-pagination">
        <span role="status">{loading ? "Đang tải danh sách…" : `${total} tệp`}</span>
        <div>
          {page > totalPages ? <AdminButton disabled={loading || busy} onClick={() => void loadPage(totalPages)} size="sm" variant="secondary">Về trang cuối có dữ liệu</AdminButton> : null}
          <AdminButton disabled={loading || busy || page <= 1} onClick={() => void loadPage(page - 1)} size="sm" variant="secondary">Trang trước</AdminButton>
          <span className="admin-pagination__page">{page}/{Math.max(page, totalPages)}</span>
          <AdminButton disabled={loading || busy || page >= totalPages} onClick={() => void loadPage(page + 1)} size="sm" variant="secondary">Trang sau</AdminButton>
        </div>
      </nav>
    </AdminCard>
  </AdminListPage>;
}

function MediaEditor({ asset, onDeleted, onSaved, onStateChange }: { asset: MediaAsset; onDeleted: (id: string) => void; onSaved: (asset: MediaAsset) => void; onStateChange: (id: string, state: { dirty: boolean; pending: boolean } | null) => void }) {
  const { confirm } = useAdminConfirm();
  const { show: showToast } = useAdminToast();
  const [busy, setBusy] = useState(false);
  const mutating = useRef(false);
  const [metadata, setMetadata] = useState(() => ({ altText: asset.altText ?? "", caption: asset.caption ?? "" }));
  const { isDirty, markSaved } = useUnsavedChanges(metadata);
  const savedMetadata = useRef(metadata);
  useEffect(() => {
    onStateChange(asset.id, { dirty: isDirty, pending: busy });
    return () => onStateChange(asset.id, null);
  }, [asset.id, isDirty, busy, onStateChange]);
  useNavigationGuard(busy, () => showToast("Đang xử lý thông tin tệp. Vui lòng chờ trước khi rời trang.", "info"));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutating.current || !isDirty) return;
    mutating.current = true;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/media/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ altText: metadata.altText.trim() || null, caption: metadata.caption.trim() || null }),
      });
      const result = await response.json();
      if (!response.ok || result.asset?.id !== asset.id) throw adminApiError(result, "Không thể lưu thông tin tệp.");
      const parsed = mediaAssetSchema.safeParse(result.asset);
      if (!parsed.success) throw new Error("Phản hồi lưu thông tin tệp không hợp lệ. Hãy kiểm tra lại trước khi thử lưu lần nữa.");
      onSaved(parsed.data);
      savedMetadata.current = metadata;
      markSaved();
      showToast("Đã lưu thông tin tệp.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  }

  async function remove() {
    if (mutating.current) return;
    if (isDirty) { showToast("Hãy lưu thông tin tệp trước khi xóa để không mất bản nhập.", "warning"); return; }
    if (!await confirm({ title: "Xác nhận xóa tệp", message: `Xóa tệp ${asset.originalName} khỏi thư viện? Thao tác không thể hoàn tác.`, confirmLabel: "Xóa", tone: "danger" })) return;
    mutating.current = true;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/media/${asset.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw adminApiError(result, "Không thể xóa tệp.");
      if (result.queuedId !== asset.id) throw new Error("Phản hồi xóa tệp không hợp lệ. Hãy tải lại thư viện để kiểm tra.");
      onDeleted(asset.id);
      showToast("Đã đưa tệp vào hàng đợi dọn dẹp.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  }

  return <form className="admin-content-section" onSubmit={save}>
    <fieldset className="grid min-w-0 gap-3" disabled={busy}>
    <div className="grid grid-cols-[4rem_1fr] gap-3">
      <a className="relative grid h-16 w-16 place-items-center overflow-hidden rounded-[var(--cms-radius-component)] border border-[var(--cms-border)] bg-[var(--cms-hover)] text-[var(--cms-muted)]" href={asset.url} rel="noreferrer" target="_blank">{isImage(asset) ? <Image alt={asset.altText || asset.originalName} className="object-cover" fill sizes="80px" src={asset.url} unoptimized /> : <FileText aria-hidden="true" size={25} />}</a>
      <div className="min-w-0"><a className="block truncate font-medium hover:text-[var(--cms-primary)]" href={asset.url} rel="noreferrer" target="_blank">{asset.originalName}</a><p className="admin-field__hint">{asset.mimeType} · {formatFileSize(asset.fileSize)}</p><div className="mt-2"><AdminStatusBadge tone={isImage(asset) && !asset.altText ? "warning" : "success"}>{isImage(asset) && !asset.altText ? "Thiếu mô tả ảnh" : "Đã sẵn sàng"}</AdminStatusBadge></div></div>
    </div>
    <label className="admin-field">Mô tả thay thế ảnh<input value={metadata.altText} onChange={(event) => setMetadata((current) => ({ ...current, altText: event.target.value }))} maxLength={500} name="altText" placeholder="Mô tả nội dung hình ảnh cho SEO và trợ năng" /></label>
    <label className="admin-field">Chú thích<textarea value={metadata.caption} onChange={(event) => setMetadata((current) => ({ ...current, caption: event.target.value }))} maxLength={10000} name="caption" rows={3} /></label>
    {isDirty ? <p className="admin-help admin-text-warning" role="status">Có thay đổi chưa lưu.</p> : null}
    </fieldset>
    <div className="flex flex-wrap gap-2"><AdminButton disabled={busy || !isDirty} permission="media.update" size="sm" type="submit" variant="secondary">{busy ? "Đang lưu…" : "Lưu thông tin"}</AdminButton>{isDirty ? <AdminButton disabled={busy} onClick={() => { if (!mutating.current) setMetadata(savedMetadata.current); }} size="sm" variant="ghost">Bỏ thay đổi</AdminButton> : null}<AdminButton disabled={busy || isDirty} hideWithoutPermission onClick={remove} permission="media.delete" className="ml-auto" size="sm" title={isDirty ? "Lưu thông tin trước khi xóa tệp" : "Xóa tệp"} variant="danger">Xóa tệp</AdminButton></div>
  </form>;
}

function isImage(asset: MediaAsset) { return asset.mimeType.startsWith("image/"); }
function formatFileSize(bytes: number) { return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`; }
