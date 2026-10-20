"use client";

import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { publishedPublicUrl } from "@/lib/published-public-url";
import { ChevronLeft, ChevronRight, Copy, ExternalLink, FileArchive, FileText, ImageIcon, LayoutGrid, List, Paperclip, Trash2, UploadCloud } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type DragEvent, type FormEvent } from "react";

import type { MediaAsset, MediaListQuery, MediaUsage } from "@iorder/core/server/media/media.contract";
import { mediaAssetSchema, mediaListResponseSchema, mediaUsageSchema } from "@iorder/core/server/media/media.contract";

import { AdminBulkBar } from "./ui/admin-bulk-bar";
import { AdminButton } from "./ui/admin-button";
import { useRowSelection } from "./ui/content-bulk-bar";
import { AdminCard } from "./ui/admin-card";
import { AdminDataTable, type AdminDataTableColumn } from "./ui/admin-data-table";
import { AdminEmptyState } from "./ui/admin-empty-state";
import { useAdminConfirm } from "./ui/admin-confirm-dialog";
import { AdminNotice, AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";
import { AdminFilterBar, type AdminFilterChip } from "./ui/admin-filter-bar";
import { AdminListHeader } from "./ui/admin-list-header";
import { AdminListPage } from "./ui/admin-list-page";
import { AdminSearchField } from "./ui/admin-search-field";
import { AdminSidePanel } from "./ui/admin-side-panel";
import { useUnsavedChanges } from "./ui/use-unsaved-changes";
import { useNavigationGuard } from "./ui/use-navigation-guard";

type MediaFilter = "all" | "images" | "documents" | "missing_alt";
const filterLabels: Record<Exclude<MediaFilter, "all">, string> = { images: "Hình ảnh", documents: "Tài liệu", missing_alt: "Ảnh thiếu mô tả" };
function matchesFilter(asset: MediaAsset, filter: MediaFilter) {
  if (filter === "images") return isImage(asset);
  if (filter === "documents") return !isImage(asset);
  if (filter === "missing_alt") return isImage(asset) && !asset.altText;
  return true;
}
type MediaView = "grid" | "list";

// Kiểu xem (lưới/danh sách) nhớ theo trình duyệt; bộ nhớ trình duyệt bị chặn thì nhớ trong phiên.
const viewKey = "iorder.cms.media-view";
const viewListeners = new Set<() => void>();
let memoryView: MediaView = "grid";
function readView(): MediaView {
  try { return localStorage.getItem(viewKey) === "list" ? "list" : localStorage.getItem(viewKey) === "grid" ? "grid" : memoryView; } catch { return memoryView; }
}
function writeView(next: MediaView) {
  memoryView = next;
  try { localStorage.setItem(viewKey, next); } catch { /* chỉ nhớ trong phiên */ }
  viewListeners.forEach((listener) => listener());
}
function useMediaView() {
  return useSyncExternalStore((listener) => { viewListeners.add(listener); return () => { viewListeners.delete(listener); }; }, readView, () => "grid" as MediaView);
}

export function MediaManager({ initialPage, initialQuery }: { initialPage: { assets: MediaAsset[]; page: number; pageSize: number; total: number; totalPages: number }; initialQuery: MediaListQuery }) {
  const { show: showToast } = useAdminToast();
  const { confirm } = useAdminConfirm();
  const view = useMediaView();
  const [assets, setAssets] = useState(initialPage.assets);
  const [page, setPage] = useState(initialPage.page);
  const [total, setTotal] = useState(initialPage.total);
  const totalPages = Math.max(1, Math.ceil(total / 25));
  const [loading, setLoading] = useState(false);
  const [pickedName, setPickedName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const listing = useRef(false);
  const [listError, setListError] = useState("");
  const [query, setQuery] = useState(initialQuery.query);
  const [searchDraft, setSearchDraft] = useState(initialQuery.query);
  const [filter, setFilter] = useState<MediaFilter>(initialQuery.type);
  // Thứ tự dạng "khóa:chiều"; mặc định mới tải lên trước.
  const [order, setOrder] = useState(`${initialQuery.sort ?? "createdAt"}:${initialQuery.dir ?? "desc"}`);
  const chips: AdminFilterChip[] = [
    ...(query ? [{ key: "query", label: `Từ khóa: “${query}”`, onRemove: () => { setSearchDraft(""); void loadPage(1, filter, ""); } }] : []),
    ...(filter !== "all" ? [{ key: "type", label: `Loại: ${filterLabels[filter]}`, onRemove: () => void loadPage(1, "all") }] : []),
  ];
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const uploading = useRef(false);
  // Chọn nhiều để xóa hàng loạt; tự bỏ chọn khi đổi trang/bộ lọc.
  const { selectedIds, setSelectedIds, clear: clearSelection } = useRowSelection(`${page}|${filter}|${query}|${order}`);
  const editorStates = useRef(new Map<string, { dirty: boolean; pending: boolean }>());
  const reportEditorState = useCallback((id: string, state: { dirty: boolean; pending: boolean } | null) => {
    if (state) editorStates.current.set(id, state);
    else editorStates.current.delete(id);
  }, []);
  useNavigationGuard(busy, () => showToast("Đang tải tệp lên. Vui lòng chờ trước khi rời thư viện.", "info"));
  const editing = () => [...editorStates.current.values()].some(state => state.pending || state.dirty);

  async function loadPage(nextPage: number, nextFilter: MediaFilter = filter, nextQuery: string = query, nextOrder: string = order) {
    if (listing.current || uploading.current || editing()) {
      showToast("Hãy hoàn tất xử lý và lưu hoặc bỏ thay đổi thông tin tệp trước khi chuyển bộ lọc.", "warning");
      return;
    }
    listing.current = true;
    setLoading(true);
    setListError("");
    try {
      const [sort, dir] = nextOrder.split(":");
      const params = new URLSearchParams({ page: String(nextPage), pageSize: "25", type: nextFilter, query: nextQuery, sort, dir });
      const response = await fetch(`/api/admin/media?${params}`);
      const body = await readAdminJson(response);
      if (!response.ok) throw adminApiError(body, "Không tải được danh sách tệp.");
      const result = mediaListResponseSchema.safeParse(body);
      if (!result.success || result.data.page !== nextPage || result.data.pageSize !== 25) throw new Error("Phản hồi danh sách tệp không hợp lệ.");
      setAssets(result.data.assets);
      setPage(result.data.page);
      setTotal(result.data.total);
      setFilter(nextFilter);
      setQuery(nextQuery);
      setOrder(nextOrder);
      const url = new URL(window.location.href);
      url.searchParams.set("page", String(result.data.page));
      url.searchParams.set("type", nextFilter);
      if (nextQuery) url.searchParams.set("query", nextQuery); else url.searchParams.delete("query");
      if (nextOrder === "createdAt:desc") { url.searchParams.delete("sort"); url.searchParams.delete("dir"); } else { url.searchParams.set("sort", sort); url.searchParams.set("dir", dir); }
      window.history.replaceState(null, "", url);
    } catch (error) { setListError(error instanceof Error ? error.message : "Không tải được danh sách tệp."); }
    finally { listing.current = false; setLoading(false); }
  }

  function changeFilter(next: MediaFilter) { void loadPage(1, next); }

  function handleDeleted(id: string) {
    setAssets(current => current.filter(item => item.id !== id));
    setTotal(current => Math.max(0, current - 1));
    setActiveId(null);
  }
  const visibleAssets = useMemo(() => assets.filter((asset) => matchesFilter(asset, filter)), [assets, filter]);
  const activeAsset = assets.find((asset) => asset.id === activeId) ?? null;
  const activeIndex = activeAsset ? visibleAssets.findIndex((asset) => asset.id === activeAsset.id) : -1;
  const toggleSelected = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter((item) => item !== id));
  const allSelected = visibleAssets.length > 0 && visibleAssets.every((asset) => selectedIds.includes(asset.id));

  // Xem tệp trước/sau trong khung chi tiết (nút hoặc phím ← →); hỏi trước nếu đang có thay đổi chưa lưu.
  async function step(delta: number) {
    const next = visibleAssets[activeIndex + delta];
    if (!next || !activeId) return;
    if (editorStates.current.get(activeId)?.pending) return;
    if (editorStates.current.get(activeId)?.dirty && !await confirm({ title: "Bỏ thay đổi chưa lưu?", message: "Mô tả hoặc chú thích vừa nhập chưa được lưu.", confirmLabel: "Bỏ thay đổi", cancelLabel: "Tiếp tục sửa", tone: "danger" })) return;
    setActiveId(next.id);
  }
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; });
  useEffect(() => {
    if (!activeId) return;
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]") || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); void stepRef.current(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); void stepRef.current(1); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId]);

  // Xóa hàng loạt từng tệp; tệp đang được dùng (409) bị bỏ qua và báo lại.
  async function removeSelected() {
    const targets = visibleAssets.filter((asset) => selectedIds.includes(asset.id));
    if (!targets.length || busy || loading) return;
    if (!await confirm({ title: `Xóa ${targets.length} tệp đã chọn?`, message: "Tệp đang được dùng trong nội dung sẽ được giữ lại. Thao tác không thể hoàn tác.", confirmLabel: "Xóa", tone: "danger" })) return;
    setBusy(true);
    const deleted: string[] = [];
    const inUse: string[] = [];
    const failed: string[] = [];
    for (const asset of targets) {
      try {
        const response = await fetch(`/api/admin/media/${asset.id}`, { method: "DELETE" });
        const result = await readAdminJson(response);
        if (response.ok && result.queuedId === asset.id) deleted.push(asset.id);
        else if (response.status === 409) inUse.push(asset.originalName);
        else failed.push(asset.originalName);
      } catch { failed.push(asset.originalName); }
    }
    setAssets((current) => current.filter((item) => !deleted.includes(item.id)));
    setTotal((current) => Math.max(0, current - deleted.length));
    clearSelection();
    setBusy(false);
    const parts = [deleted.length ? `Đã xóa ${deleted.length} tệp.` : "", inUse.length ? `Giữ lại ${inUse.length} tệp đang được dùng: ${inUse.slice(0, 3).join(", ")}${inUse.length > 3 ? "…" : ""}.` : "", failed.length ? `Không xóa được ${failed.length} tệp.` : ""].filter(Boolean);
    showToast(parts.join(" "), failed.length || inUse.length ? "warning" : "success");
  }

  async function closePanel() {
    if (activeId && editorStates.current.get(activeId)?.pending) return;
    if (activeId && editorStates.current.get(activeId)?.dirty && !await confirm({ title: "Bỏ thay đổi chưa lưu?", message: "Mô tả hoặc chú thích vừa nhập chưa được lưu.", confirmLabel: "Bỏ thay đổi", cancelLabel: "Tiếp tục sửa", tone: "danger" })) return;
    setActiveId(null);
  }

  // Tải lên từ nút chọn tệp hoặc kéo thả (một hay nhiều tệp, lần lượt từng tệp).
  // Một tệp: xong thì mở chi tiết để thêm mô tả ngay. Nhiều tệp: báo tổng kết.
  async function uploadFiles(files: File[], form?: HTMLFormElement) {
    if (!files.length || uploading.current || listing.current) return;
    if (editing()) {
      showToast("Hãy lưu hoặc bỏ thay đổi thông tin tệp trước khi tải tệp mới lên.", "warning");
      return;
    }
    uploading.current = true;
    setBusy(true);
    const failures: string[] = [];
    let uploaded = 0;
    let lastShown: string | null = null;
    try {
      for (const [index, file] of files.entries()) {
        setProgress({ done: index, total: files.length });
        try {
          const body = new FormData();
          body.set("file", file);
          const response = await fetch("/api/admin/media", { method: "POST", body });
          const result = await readAdminJson(response);
          if (!response.ok || !result.asset?.id) throw adminApiError(result, "Không thể tải tệp lên.");
          const parsed = mediaAssetSchema.safeParse(result.asset);
          if (!parsed.success) throw new Error("Máy chủ đã nhận tệp nhưng phản hồi không hợp lệ. Hãy kiểm tra thư viện trước khi tải lại.");
          uploaded += 1;
          const fits = matchesFilter(parsed.data, filter);
          if (!query && page === 1 && fits) {
            setAssets((current) => [parsed.data, ...current.filter(asset => asset.id !== parsed.data.id)].slice(0, 25));
            lastShown = parsed.data.id;
          }
          if (!query && fits) setTotal((current) => current + 1);
        } catch (error) {
          failures.push(`${file.name}: ${error instanceof Error ? error.message : "không kết nối được máy chủ"}`);
        }
      }
      form?.reset();
      setPickedName("");
      if (files.length === 1 && lastShown) setActiveId(lastShown);
      if (failures.length) showToast([uploaded ? `Đã tải lên ${uploaded}/${files.length} tệp.` : "Không tải được tệp nào.", ...failures.slice(0, 3)].join(" "), uploaded ? "warning" : "error");
      else showToast(query ? "Đã tải tệp lên. Tìm kiếm lại hoặc xóa từ khóa để thấy tệp mới." : files.length > 1 ? `Đã tải lên ${uploaded} tệp.` : "Đã tải tệp lên thư viện.", "success");
    } finally {
      uploading.current = false;
      setProgress(null);
      setBusy(false);
    }
  }

  function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const files = Array.from((form.elements.namedItem("file") as HTMLInputElement | null)?.files ?? []);
    void uploadFiles(files, form);
  }

  function drop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    setDragging(false);
    if (!busy && !loading) void uploadFiles(Array.from(event.dataTransfer.files ?? []));
  }

  const [sortKey, sortDir] = order.split(":") as [string, "asc" | "desc"];
  const columns: AdminDataTableColumn<MediaAsset>[] = [
    { id: "file", label: "Tệp", defaultWidth: 380, minWidth: 240, sortKey: "name", sortFirst: "asc", cell: (asset) => <span className="admin-media-row"><Thumb asset={asset} size={40} /><span><strong>{asset.originalName}</strong><small>{asset.mimeType}</small></span></span> },
    { id: "size", label: "Dung lượng", defaultWidth: 130, align: "right", sortKey: "size", sortFirst: "desc", cell: (asset) => formatFileSize(asset.fileSize) },
    { id: "alt", label: "Mô tả ảnh", defaultWidth: 260, cell: (asset) => !isImage(asset) ? <span className="admin-field__hint">—</span> : asset.altText ? <span className="admin-media-row__alt" title={asset.altText}>{asset.altText}</span> : <AdminStatusBadge tone="warning">Thiếu mô tả ảnh</AdminStatusBadge> },
    { id: "caption", label: "Chú thích", defaultWidth: 220, cell: (asset) => asset.caption ? <span className="admin-media-row__alt" title={asset.caption}>{asset.caption}</span> : <span className="admin-field__hint">—</span> },
  ];
  const emptyTitle = filter === "all" && !query && total === 0 ? "Thư viện chưa có tệp" : "Không có kết quả";
  const emptyDescription = filter === "all" && !query && total === 0 ? "Kéo thả hoặc chọn tệp ở trên để tải ảnh và tài liệu lên." : "Thử từ khóa hoặc bộ lọc khác; nếu trang hiện tại đã hết dữ liệu, hãy quay về trang trước.";

  return <AdminListPage>
    <AdminCard>
      <AdminListHeader description={`${total} tệp`} title="Thư viện media" />
      <form className={dragging ? "admin-list-toolbar admin-media-upload admin-media-upload--drop" : "admin-list-toolbar admin-media-upload"} onDragLeave={() => setDragging(false)} onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setDragging(true); } }} onDrop={drop} onSubmit={upload}>
        {/* Ô chọn tệp gốc của trình duyệt hiện chữ tiếng Anh; dùng nút riêng và hiện tên tệp đã chọn. */}
        <input accept="image/png,image/jpeg,image/webp,application/pdf,application/zip" aria-label="Chọn ảnh hoặc tài liệu" className="sr-only" id="media-upload-file" multiple name="file" onChange={(event) => { const picked = Array.from(event.target.files ?? []); setPickedName(picked.length > 1 ? `Đã chọn ${picked.length} tệp` : picked[0]?.name ?? ""); }} required type="file" />
        <label className="admin-button admin-button--secondary admin-button--sm" htmlFor="media-upload-file"><Paperclip aria-hidden="true" size={14} />Chọn tệp</label>
        <span className={pickedName ? "min-w-0 truncate text-[var(--cms-text-sm)]" : "admin-field__hint"} title={pickedName || undefined}>{progress ? `Đang tải lên ${progress.done + 1}/${progress.total}…` : dragging ? "Thả tệp để tải lên" : pickedName || "hoặc kéo thả một hay nhiều tệp vào đây · PNG, JPEG, WebP, PDF, ZIP; tối đa 20 MB mỗi tệp"}</span>
        <AdminButton className="ml-auto" disabled={busy || loading} permission="media.create" type="submit"><UploadCloud aria-hidden="true" />{busy ? "Đang tải…" : "Tải lên"}</AdminButton>
      </form>
      <AdminFilterBar onSubmit={(event) => { event.preventDefault(); void loadPage(1, filter, searchDraft); }} chips={chips} onClearAll={() => { setSearchDraft(""); void loadPage(1, "all", ""); }} search={<AdminSearchField disabled={loading || busy} label="Tìm tệp" maxLength={160} onChange={event => setSearchDraft(event.target.value)} placeholder="Tên tệp, mô tả hoặc chú thích" value={searchDraft} />}>
        <select aria-label="Lọc loại tệp" disabled={loading || busy} onChange={(event) => changeFilter(event.target.value as MediaFilter)} value={filter}><option value="all">Tất cả loại tệp</option><option value="images">Hình ảnh</option><option value="documents">Tài liệu</option><option value="missing_alt">Ảnh thiếu mô tả</option></select>
        <select aria-label="Sắp xếp tệp" disabled={loading || busy} onChange={(event) => void loadPage(1, filter, query, event.target.value)} value={order}><option value="createdAt:desc">Mới tải lên trước</option><option value="createdAt:asc">Cũ nhất trước</option><option value="name:asc">Tên A → Z</option><option value="name:desc">Tên Z → A</option><option value="size:desc">Dung lượng lớn nhất</option><option value="size:asc">Dung lượng nhỏ nhất</option></select>
        <div aria-label="Kiểu hiển thị" className="admin-view-toggle" role="group">
          <button aria-pressed={view === "grid"} className={view === "grid" ? "admin-view-toggle__btn admin-view-toggle__btn--active" : "admin-view-toggle__btn"} onClick={() => writeView("grid")} title="Dạng lưới" type="button"><LayoutGrid aria-hidden="true" size={16} /><span>Lưới</span></button>
          <button aria-pressed={view === "list"} className={view === "list" ? "admin-view-toggle__btn admin-view-toggle__btn--active" : "admin-view-toggle__btn"} onClick={() => writeView("list")} title="Dạng danh sách" type="button"><List aria-hidden="true" size={16} /><span>Danh sách</span></button>
        </div>
      </AdminFilterBar>
      <AdminBulkBar count={selectedIds.length} onClear={clearSelection}>
        <AdminButton disabled={busy || loading} hideWithoutPermission onClick={() => void removeSelected()} permission="media.delete" size="sm" variant="danger"><Trash2 aria-hidden="true" size={14} />Xóa tệp đã chọn</AdminButton>
      </AdminBulkBar>
      {listError ? <div className="admin-list-toolbar"><AdminNotice tone="error">{listError}</AdminNotice><AdminButton disabled={loading} onClick={() => void loadPage(page)} size="sm" variant="secondary">Thử lại</AdminButton></div> : null}
      <fieldset className="min-w-0" disabled={loading || busy}>
        {visibleAssets.length === 0 ? <div className="p-[var(--cms-card-padding)]"><AdminEmptyState description={emptyDescription} icon={<ImageIcon aria-hidden="true" size={21} />} title={emptyTitle} /></div>
          : view === "grid" ? <>
          <label className="admin-media-select-all"><input checked={allSelected} onChange={(event) => setSelectedIds(event.target.checked ? visibleAssets.map((asset) => asset.id) : [])} type="checkbox" />Chọn tất cả trên trang</label>
          <ul aria-label="Tệp trong thư viện" className="admin-media-grid">{visibleAssets.map((asset) => <li className={selectedIds.includes(asset.id) ? "admin-media-grid__item admin-media-grid__item--selected" : "admin-media-grid__item"} key={asset.id}>
            <input aria-label={`Chọn ${asset.originalName}`} checked={selectedIds.includes(asset.id)} className="admin-media-grid__check" onChange={(event) => toggleSelected(asset.id, event.target.checked)} type="checkbox" />
            <button aria-label={`Xem chi tiết ${asset.originalName}`} className={asset.id === activeId ? "admin-media-tile admin-media-tile--active" : "admin-media-tile"} onClick={() => setActiveId(asset.id)} type="button">
              <Thumb asset={asset} size={220} />
              <span className="admin-media-tile__name" title={asset.originalName}>{asset.originalName}</span>
              <span className="admin-media-tile__meta">{formatFileSize(asset.fileSize)}{isImage(asset) && !asset.altText ? <AdminStatusBadge tone="warning">Thiếu mô tả</AdminStatusBadge> : null}</span>
            </button>
          </li>)}</ul></>
          : <AdminDataTable columns={columns} emptyMessage="Không có tệp." getRowId={(asset) => asset.id} onRowClick={(asset) => setActiveId(asset.id)} onSortChange={(next) => void loadPage(1, filter, query, next ? `${next.key}:${next.dir}` : "createdAt:desc")} onSelectionChange={setSelectedIds} rows={visibleAssets} selectedIds={selectedIds} sort={sortKey === "createdAt" ? null : { key: sortKey, dir: sortDir }} tableId="media" />}
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
    <AdminSidePanel isOpen={Boolean(activeAsset)} label="Chi tiết tệp" onClose={() => void closePanel()}>
      {activeAsset ? <MediaDetail asset={activeAsset} key={activeAsset.id} navigation={{ index: activeIndex, total: visibleAssets.length, onStep: (delta) => void step(delta) }} onDeleted={handleDeleted} onSaved={(saved) => setAssets((current) => current.map((item) => item.id === saved.id ? saved : item))} onStateChange={reportEditorState} /> : null}
    </AdminSidePanel>
  </AdminListPage>;
}

function Thumb({ asset, size }: { asset: MediaAsset; size: number }) {
  return <span className="admin-media-thumb" style={size <= 48 ? { width: size, height: size } : undefined}>
    {isImage(asset) ? <Image alt="" className="object-cover" fill sizes={`${size}px`} src={asset.url} unoptimized /> : asset.mimeType === "application/zip" ? <FileArchive aria-hidden="true" size={size <= 48 ? 18 : 30} /> : <FileText aria-hidden="true" size={size <= 48 ? 18 : 30} />}
  </span>;
}

// Chi tiết một tệp trong khung bên: xem lớn, nơi đang dùng, sửa mô tả/chú thích, xóa (chặn khi đang dùng).
function MediaDetail({ asset, navigation, onDeleted, onSaved, onStateChange }: { asset: MediaAsset; navigation: { index: number; total: number; onStep: (delta: number) => void }; onDeleted: (id: string) => void; onSaved: (asset: MediaAsset) => void; onStateChange: (id: string, state: { dirty: boolean; pending: boolean } | null) => void }) {
  const { confirm } = useAdminConfirm();
  const { show: showToast } = useAdminToast();
  const [busy, setBusy] = useState(false);
  const mutating = useRef(false);
  const [metadata, setMetadata] = useState(() => ({ altText: asset.altText ?? "", caption: asset.caption ?? "" }));
  const { isDirty, markSaved } = useUnsavedChanges(metadata);
  const savedMetadata = useRef(metadata);
  const [usage, setUsage] = useState<{ items: MediaUsage[]; error?: string } | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    onStateChange(asset.id, { dirty: isDirty, pending: busy });
    return () => onStateChange(asset.id, null);
  }, [asset.id, isDirty, busy, onStateChange]);
  useNavigationGuard(busy, () => showToast("Đang xử lý thông tin tệp. Vui lòng chờ trước khi rời trang.", "info"));
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/media/${asset.id}/usage`, { signal: controller.signal }).then(async (response) => {
      const payload = await readAdminJson(response);
      if (!response.ok) throw adminApiError(payload, "Không kiểm tra được nơi sử dụng tệp.");
      const parsed = mediaUsageSchema.safeParse(payload);
      if (!parsed.success) throw new Error("Dữ liệu nơi sử dụng tệp không hợp lệ.");
      if (!controller.signal.aborted) setUsage({ items: parsed.data.items });
    }).catch((error) => {
      if (!controller.signal.aborted) setUsage({ items: [], error: error instanceof Error ? error.message : "Không kiểm tra được nơi sử dụng tệp." });
    });
    return () => controller.abort();
  }, [asset.id]);
  const inUse = Boolean(usage?.items.length);
  const publicUrl = publishedPublicUrl(asset.url);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutating.current || !isDirty) return;
    mutating.current = true;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/media/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ altText: metadata.altText.trim() || null, caption: metadata.caption.trim() || null, expectedVersion: asset.version }),
      });
      const result = await readAdminJson(response);
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
      const result = await readAdminJson(response);
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

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      showToast("Đã sao chép đường dẫn tệp.", "success");
    } catch {
      showToast("Trình duyệt không cho sao chép. Hãy mở tệp và sao chép địa chỉ.", "warning");
    }
  }

  return <form className="admin-media-detail" onSubmit={save}>
    {navigation.total > 1 && navigation.index >= 0 ? <nav aria-label="Chuyển tệp" className="admin-media-detail__nav">
      <AdminButton disabled={navigation.index <= 0} onClick={() => navigation.onStep(-1)} size="sm" title="Tệp trước (phím ←)" variant="ghost"><ChevronLeft aria-hidden="true" size={16} />Trước</AdminButton>
      <span className="admin-field__hint">{navigation.index + 1}/{navigation.total}</span>
      <AdminButton disabled={navigation.index >= navigation.total - 1} onClick={() => navigation.onStep(1)} size="sm" title="Tệp sau (phím →)" variant="ghost">Sau<ChevronRight aria-hidden="true" size={16} /></AdminButton>
    </nav> : null}
    <div className="admin-media-detail__preview">
      {isImage(asset) ? <Image alt={asset.altText || asset.originalName} className="object-contain" fill onLoad={(event) => setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} sizes="440px" src={asset.url} unoptimized /> : <span className="admin-media-detail__file">{asset.mimeType === "application/zip" ? <FileArchive aria-hidden="true" size={40} /> : <FileText aria-hidden="true" size={40} />}</span>}
    </div>
    <header className="admin-media-detail__head">
      <h2 title={asset.originalName}>{asset.originalName}</h2>
      <p className="admin-field__hint">{[asset.mimeType, formatFileSize(asset.fileSize), dimensions ? `${dimensions.width} × ${dimensions.height} px` : null].filter(Boolean).join(" · ")}</p>
      {dimensions && dimensions.width < 800 ? <p className="admin-help admin-text-warning">Ảnh nhỏ (rộng dưới 800px) có thể bị mờ khi làm ảnh bìa hoặc ảnh chia sẻ.</p> : null}
      <p className="admin-media-detail__links"><a href={asset.url} rel="noreferrer" target="_blank"><ExternalLink aria-hidden="true" size={14} />Mở tệp</a><button onClick={() => void copyLink()} type="button"><Copy aria-hidden="true" size={14} />Sao chép đường dẫn</button></p>
    </header>
    <section className="admin-media-detail__usage" aria-label="Nơi đang dùng tệp">
      {!usage ? <p className="admin-help" role="status">Đang kiểm tra nơi sử dụng…</p> : usage.error ? <p className="admin-help admin-text-warning" role="status">{usage.error}</p> : inUse ? <>
        <strong>Đang dùng tại {usage.items.length} nơi</strong>
        <ul>{usage.items.slice(0, 6).map((item) => <li key={`${item.entityType}-${item.entityId}`}>{item.location}: {item.label}</li>)}</ul>
        {usage.items.length > 6 ? <p className="admin-help">và {usage.items.length - 6} nơi khác.</p> : null}
      </> : <p className="admin-help">Chưa được dùng ở đâu.</p>}
    </section>
    <fieldset className="grid min-w-0 gap-3" disabled={busy}>
      {isImage(asset) ? <label className="admin-field">Mô tả thay thế ảnh<input value={metadata.altText} onChange={(event) => setMetadata((current) => ({ ...current, altText: event.target.value }))} maxLength={500} name="altText" placeholder="Mô tả nội dung ảnh cho Google và người khiếm thị" /></label> : null}
      <label className="admin-field">Chú thích<textarea value={metadata.caption} onChange={(event) => setMetadata((current) => ({ ...current, caption: event.target.value }))} maxLength={10000} name="caption" rows={3} /></label>
      {isDirty ? <p className="admin-help admin-text-warning" role="status">Có thay đổi chưa lưu.</p> : null}
    </fieldset>
    <div className="admin-media-detail__actions">
      <AdminButton disabled={busy || !isDirty} permission="media.update" size="sm" type="submit">{busy ? "Đang lưu…" : "Lưu thông tin"}</AdminButton>
      {isDirty ? <AdminButton disabled={busy} onClick={() => { if (!mutating.current) setMetadata(savedMetadata.current); }} size="sm" variant="ghost">Bỏ thay đổi</AdminButton> : null}
      <AdminButton className="ml-auto" disabled={busy || isDirty || inUse || !usage} hideWithoutPermission onClick={remove} permission="media.delete" size="sm" title={inUse ? "Tệp đang được dùng — gỡ khỏi các nơi trên trước khi xóa" : isDirty ? "Lưu thông tin trước khi xóa tệp" : "Xóa tệp"} variant="danger">Xóa tệp</AdminButton>
    </div>
    {inUse ? <p className="admin-help">Không xóa được tệp đang dùng. Gỡ tệp khỏi các nơi trên trước.</p> : null}
  </form>;
}

function isImage(asset: MediaAsset) { return asset.mimeType.startsWith("image/"); }
function formatFileSize(bytes: number) { return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`; }
