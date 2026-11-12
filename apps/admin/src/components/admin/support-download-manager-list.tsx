"use client";
import { requestAdminJson } from "@/lib/admin-api";

import { Archive, ArchiveRestore, Download, FileDown, Pencil, Plus, RotateCcw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AdminSupportDownload, AdminSupportDownloadInput } from "@iorder/shared/server/support/support-downloads.contract";
import { adminSupportDownloadInputSchema, parseSavedSupportDownload, supportDownloadCreateRequestSchema, supportDownloadMutationSchema } from "@iorder/shared/server/support/support-downloads.contract";
import type { MediaAsset } from "@iorder/shared/server/media/media.contract";

import { MediaPicker } from "./media-picker";
import { RevisionHistory } from "./revision-history";
import { AdminButton } from "./ui/admin-button";
import { AdminFileIcon, fileKindOf } from "./ui/admin-file-icon";
import { ContentBulkBar, useRowSelection } from "./ui/content-bulk-bar";
import { AdminEmptyState } from "./ui/admin-empty-state";
import { AdminNotice, AdminStatusBadge, useAdminToast, type AdminFeedbackTone } from "./ui/admin-feedback";
import { AdminCard } from "./ui/admin-card";
import { AdminDataTable, type AdminDataTableColumn } from "./ui/admin-data-table";
import { AdminFilterBar, type AdminFilterChip } from "./ui/admin-filter-bar";
import { AdminListHeader } from "./ui/admin-list-header";
import { AdminListPage } from "./ui/admin-list-page";
import { AdminSearchField } from "./ui/admin-search-field";
import { AdminSidePanel } from "./ui/admin-side-panel";
import { useNavigationGuard } from "./ui/use-navigation-guard";
import { useRevisionRestore } from "./ui/use-revision-restore";
import { useAdminPermissions } from "./ui/admin-permissions";
import { AdminFormField } from "./ui/admin-form-field";
import { useAdminFormValidation } from "./ui/use-admin-form-validation";
import { useAdminClientReady } from "./ui/use-admin-client-ready";

type Filter = "all" | "draft" | "published" | "archived";

const blank: AdminSupportDownloadInput = {
  fileMediaId: null,
  icon: "download",
  title: "",
  description: null,
  meta: null,
  sortOrder: 0,
  isEnabled: false,
};

const downloadFormSchema = adminSupportDownloadInputSchema.superRefine((values, context) => {
  if (values.isEnabled && !values.fileMediaId) context.addIssue({ code: "custom", path: ["fileMediaId"], message: "Chọn tệp PDF hoặc ZIP trước khi hiển thị trên website." });
});

const statusLabel: Record<AdminSupportDownload["status"], string> = {
  draft: "Bản nháp",
  published: "Đang hiển thị",
  archived: "Lưu trữ",
};
const statusTone: Record<AdminSupportDownload["status"], AdminFeedbackTone> = {
  draft: "neutral",
  published: "success",
  archived: "warning",
};

function valuesOf(item: AdminSupportDownload): AdminSupportDownloadInput {
  return {
    fileMediaId: item.fileMediaId,
    icon: item.icon,
    title: item.title,
    description: item.description,
    meta: item.meta,
    sortOrder: item.sortOrder,
    isEnabled: item.isEnabled,
  };
}

function equalValues(first: AdminSupportDownloadInput | null, second: AdminSupportDownloadInput | null) {
  return JSON.stringify(first) === JSON.stringify(second);
}

function titleFromFileName(name: string) {
  return name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim() || "Tệp cài đặt mới";
}

async function requestJson(url: string, method: "PATCH" | "POST", body: unknown) {
  const mutationResult = method === "PATCH" ? supportDownloadMutationSchema.safeParse(body) : undefined;
  const createResult = method === "POST" ? supportDownloadCreateRequestSchema.safeParse(body) : undefined;
  if (mutationResult?.success === false || createResult?.success === false) throw new Error("Vui lòng kiểm tra tên, thông tin và tệp liên kết trước khi lưu.");
  const mutation = mutationResult?.data;
  const create = createResult?.data;
  const payload = await requestAdminJson(url, method, body, "Không thể cập nhật tệp cài đặt.");
  const isEnabled = mutation?.action === "save" ? mutation.values.isEnabled : create?.values.isEnabled;
  const download = parseSavedSupportDownload(payload, {
    id: mutation ? url.split("/").at(-1) : undefined,
    version: mutation ? mutation.expectedVersion + 1 : 1,
    status: mutation?.action === "archive" ? "archived" : mutation?.action === "restore" ? "draft" : isEnabled ? "published" : "draft",
  });
  if (!download) throw new Error("Phản hồi lưu tệp cài đặt không hợp lệ hoặc không khớp. Vui lòng tải lại để kiểm tra trước khi thử lại.");
  return download;
}

export function SupportDownloadManagerList({
  items,
  initialSelectedId,
  startCreating = false,
}: {
  items: AdminSupportDownload[];
  initialSelectedId?: string;
  startCreating?: boolean;
}) {
  const { can } = useAdminPermissions();
  const clientReady = useAdminClientReady();
  const router = useRouter();
  const { show: showToast } = useAdminToast();
  const initialActive = items.find((item) => item.id === initialSelectedId);
  const [rows, setRows] = useState(items);
  // Thao tác hàng loạt xong gọi router.refresh(): nhận danh sách mới từ máy chủ thay cho bản đang giữ.
  const [loadedItems, setLoadedItems] = useState(items);
  if (loadedItems !== items) {
    setLoadedItems(items);
    setRows(items);
  }
  const [activeId, setActiveId] = useState<string | null>(initialActive?.id ?? null);
  // Phiên bản gắn với bản nhập đang sửa; refresh danh sách không được thay version của bản nhập cũ.
  const [activeSnapshot, setActiveSnapshot] = useState(initialActive);
  const [form, setForm] = useState<AdminSupportDownloadInput | null>(() => startCreating ? { ...blank } : initialActive ? valuesOf(initialActive) : null);
  const [initialValues, setInitialValues] = useState<AdminSupportDownloadInput | null>(() => startCreating ? { ...blank } : initialActive ? valuesOf(initialActive) : null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [isSaving, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const validation = useAdminFormValidation("support-download", {
    title: { label: "Tên hiển thị", message: "Nhập tên hiển thị từ 1 đến 220 ký tự." },
    description: { label: "Mô tả", message: "Nhập mô tả từ 1 đến 10.000 ký tự hoặc để trống." },
    meta: { label: "Thông tin phụ", message: "Nhập thông tin phụ tối đa 160 ký tự hoặc để trống." },
    sortOrder: { label: "Thứ tự", message: "Nhập số nguyên từ 0 đến 10.000." },
    fileMediaId: { label: "Tệp tải xuống", message: "Chọn lại tệp PDF hoặc ZIP từ thư viện." },
    icon: { label: "Biểu tượng", message: "Biểu tượng không hợp lệ. Vui lòng tải lại để kiểm tra." },
    isEnabled: { label: "Hiển thị công khai", message: "Chọn trạng thái hiển thị hợp lệ." },
  });
  const formElement = useRef<HTMLFormElement>(null);
  useEffect(() => {
    function onSave(event: KeyboardEvent) {
      if (formElement.current && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); formElement.current.requestSubmit(); }
    }
    window.addEventListener("keydown", onSave);
    return () => window.removeEventListener("keydown", onSave);
  }, []);
  const saving = useRef(false);
  const titleInput = useRef<HTMLInputElement>(null);
  const uploading = useRef(false);
  const [isUploading, setUploading] = useState(false);
  const revisionRestore = useRevisionRestore();
  const busy = isSaving || isUploading || revisionRestore.restoring;
  const onUploadingChange = useCallback((pending: boolean) => {
    uploading.current = pending;
    setUploading(pending);
  }, []);
  const active = activeSnapshot?.id === activeId ? activeSnapshot : rows.find((item) => item.id === activeId);
  const dirty = !equalValues(form, initialValues);
  const archived = active?.status === "archived";
  const canPublish = can("support_downloads.publish");
  const canEdit = can(active ? "support_downloads.update" : "support_downloads.create") && (canPublish || active?.status !== "published");
  const filterItems: Array<{ label: string; value: Filter }> = [
    { label: "Tất cả", value: "all" },
    { label: statusLabel.published, value: "published" },
    { label: statusLabel.draft, value: "draft" },
    { label: statusLabel.archived, value: "archived" },
  ];
  const chips: AdminFilterChip[] = [
    ...(query.trim() ? [{ key: "query", label: `Từ khóa: “${query.trim()}”`, onRemove: () => setQuery("") }] : []),
    ...(filter !== "all" ? [{ key: "status", label: `Trạng thái: ${(filterItems.find((item) => item.value === filter)?.label ?? filter).replace(/ \(\d+\)$/, "")}`, onRemove: () => setFilter("all") }] : []),
  ];

  const visibleRows = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi");
    return rows.filter((item) => (!keyword || `${item.title} ${item.originalName ?? ""}`.toLocaleLowerCase("vi").includes(keyword)) && (filter === "all" || item.status === filter));
  }, [filter, query, rows]);
  const selection = useRowSelection(`${query.trim()}|${filter}`);

  useNavigationGuard(!revisionRestore.completing && (dirty || busy), () => {
    showToast(busy ? "Đang xử lý tệp cài đặt. Vui lòng chờ trước khi rời trang." : "Bạn có thay đổi chưa lưu. Hãy lưu hoặc bỏ thay đổi trước khi rời trang.", "warning");
  });

  function allowSelectionChange() {
    if (saving.current || uploading.current || revisionRestore.pending.current) {
      showToast("Đang xử lý tệp cài đặt. Vui lòng chờ trước khi đổi hoặc đóng.", "info");
      return false;
    }
    if (!dirty) return true;
    showToast("Hãy lưu hoặc bỏ thay đổi hiện tại trước khi chọn tệp cài đặt khác.", "warning");
    return false;
  }

  function select(item: AdminSupportDownload) {
    if (!allowSelectionChange()) return;
    const values = valuesOf(item);
    setActiveId(item.id);
    setActiveSnapshot(item);
    setForm(values);
    setInitialValues(values);
    setSaveError(""); validation.reset();
  }

  function create() {
    if (!can("support_downloads.create") || !allowSelectionChange()) return;
    setActiveId(null);
    setActiveSnapshot(undefined);
    setForm({ ...blank });
    setInitialValues({ ...blank });
    setSaveError(""); validation.reset();
  }

  function closeEditor() {
    if (!allowSelectionChange()) return;
    setActiveId(null);
    setActiveSnapshot(undefined);
    setForm(null);
    setInitialValues(null);
    setSaveError(""); validation.reset();
  }

  function update<K extends keyof AdminSupportDownloadInput>(key: K, value: AdminSupportDownloadInput[K]) {
    if (saving.current || revisionRestore.pending.current || !canEdit) return;
    setForm((current) => current ? { ...current, [key]: value } : current);
  }

  function discardChanges() {
    if (saving.current || uploading.current || revisionRestore.pending.current) return;
    setForm(initialValues);
    setSaveError(""); validation.reset();
    titleInput.current?.focus();
    showToast("Đã bỏ các thay đổi chưa lưu.", "info");
  }

  function applySaved(download: AdminSupportDownload) {
    setRows((current) => current.some((item) => item.id === download.id)
      ? current.map((item) => item.id === download.id ? download : item)
      : [...current, download]);
    const values = valuesOf(download);
    setActiveId(download.id);
    setActiveSnapshot(download);
    setForm(values);
    setInitialValues(values);
    setSaveError(""); validation.reset();
  }

  async function save() {
    if (!form || archived || saving.current || uploading.current || revisionRestore.pending.current || !canEdit || !dirty) return;
    setSaveError("");
    const parsed = downloadFormSchema.safeParse(form);
    if (!parsed.success) { validation.report(parsed.error.issues); return; }
    validation.reset();
    saving.current = true;
    setBusy(true);
    try {
      const download = active
        ? await requestJson(`/api/v1/admin/support-downloads/${active.id}`, "PATCH", {
            action: "save",
            values: parsed.data,
            expectedVersion: active.draftVersion,
            changeNote: "Cập nhật từ trình biên tập tệp cài đặt",
          })
        : await requestJson("/api/v1/admin/support-downloads", "POST", {
            values: parsed.data,
            changeNote: "Tạo từ trình biên tập tệp cài đặt",
          });
      applySaved(download);
      showToast(active ? "Đã lưu tệp cài đặt và tạo phiên bản mới." : "Đã thêm tệp cài đặt.", "success");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không kết nối được máy chủ.";
      setSaveError(message); showToast(message, "error");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  async function saveUploadedFile(asset: MediaAsset) {
    if (!form || archived || saving.current || revisionRestore.pending.current || !canEdit) throw new Error("Không thể lưu tệp lúc này. Vui lòng chọn lại tệp trong thư viện.");
    const values = {
      ...form,
      fileMediaId: asset.id,
      title: form.title.trim() || titleFromFileName(asset.originalName),
    };
    setForm(values);
    setSaveError("");
    const parsed = downloadFormSchema.safeParse(values);
    if (!parsed.success) {
      validation.report(parsed.error.issues);
      const message = "Tệp đã tải lên thư viện. Sửa thông tin được đánh dấu rồi bấm Lưu để hoàn tất.";
      setSaveError(message);
      showToast(message, "error");
      return;
    }
    validation.reset();
    saving.current = true;
    setBusy(true);
    try {
      const download = active
        ? await requestJson(`/api/v1/admin/support-downloads/${active.id}`, "PATCH", {
            action: "save",
            values: parsed.data,
            expectedVersion: active.draftVersion,
            changeNote: "Tải tệp mới từ trình biên tập tệp cài đặt",
          })
        : await requestJson("/api/v1/admin/support-downloads", "POST", {
            values: parsed.data,
            changeNote: "Tải tệp lên và tạo bản nháp tự động",
          });
      applySaved(download);
      showToast(active ? "Đã tải tệp lên và lưu thay đổi." : "Đã tải tệp lên và tạo bản nháp tự động.", "success");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể lưu tệp cài đặt vừa tải lên.";
      setSaveError(message); showToast(message, "error");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  async function changeArchiveState() {
    if (saving.current || uploading.current || revisionRestore.pending.current || !can("support_downloads.update") || !canPublish) return;
    if (!active || dirty) {
      if (dirty) showToast("Hãy lưu hoặc bỏ thay đổi trước khi lưu trữ.", "warning");
      return;
    }
    setSaveError("");
    saving.current = true;
    setBusy(true);
    try {
      const download = await requestJson(`/api/v1/admin/support-downloads/${active.id}`, "PATCH", {
        action: archived ? "restore" : "archive",
        expectedVersion: active.draftVersion,
      });
      applySaved(download);
      showToast(archived ? "Đã khôi phục tệp cài đặt về bản nháp." : "Đã chuyển tệp cài đặt vào lưu trữ.", archived ? "success" : "warning");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không kết nối được máy chủ.";
      setSaveError(message); showToast(message, "error");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  // Bảng giống các danh sách khác: bấm dòng hoặc nút bút để mở panel sửa; tệp đang hiển thị tải được ngay.
  const columns: AdminDataTableColumn<AdminSupportDownload>[] = [
    { id: "title", label: "Tên", defaultWidth: 300, minWidth: 200, sortValue: (item) => item.title, cell: (item) => <span className="grid min-w-0"><strong className="truncate">{item.title}</strong><small className="admin-text-muted truncate">{item.meta ?? item.description ?? ""}</small></span> },
    { id: "file", label: "Tệp", defaultWidth: 200, minWidth: 140, sortValue: (item) => item.originalName ?? "", cell: (item) => item.originalName ? <span className="admin-file-name"><AdminFileIcon kind={fileKindOf(item.originalName)} size="sm" /><span className="truncate">{item.originalName}</span></span> : <span className="admin-text-muted">Chưa chọn tệp</span> },
    { id: "status", label: "Trạng thái", defaultWidth: 140, minWidth: 120, sortValue: (item) => item.status, cell: (item) => <AdminStatusBadge tone={statusTone[item.status]}>{statusLabel[item.status]}</AdminStatusBadge> },
    { id: "sortOrder", label: "Thứ tự", defaultWidth: 100, minWidth: 90, align: "right", sortValue: (item) => item.sortOrder, cell: (item) => <span className="admin-text-muted">{item.sortOrder}</span> },
    { id: "actions", label: "Thao tác", defaultWidth: 96, minWidth: 96, align: "right", cell: (item) => <span className="admin-content-actions">
      {item.downloadUrl && item.status === "published" ? <a aria-label={`Tải ${item.title}`} className="admin-content-actions__button" href={item.downloadUrl} rel="noreferrer" target="_blank" title="Tải tệp công khai"><Download aria-hidden="true" size={16} /></a> : null}
      <button aria-label={`Sửa ${item.title}`} className="admin-content-actions__button admin-content-actions__edit" onClick={() => select(item)} title="Sửa" type="button"><Pencil aria-hidden="true" size={16} /></button>
    </span> },
  ];

  const sidebar = <>
      <AdminListHeader actions={<AdminButton disabled={!clientReady} hideWithoutPermission permission="support_downloads.create" leadingIcon={<Plus aria-hidden="true" size={16} />} onClick={create}>Thêm</AdminButton>} description={`${rows.length} tệp tải xuống`} headingLevel={1} title="Tệp cài đặt" />
      <AdminFilterBar onSubmit={(event) => event.preventDefault()} chips={chips} onClearAll={() => { setQuery(""); setFilter("all"); }} search={<AdminSearchField id="support-download-search" label="Tìm tệp cài đặt" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên hoặc tệp" value={query} />}><select aria-label="Lọc trạng thái" onChange={(event) => setFilter(event.target.value as Filter)} value={filter}>{filterItems.map((item) => <option key={item.value} value={item.value}>{item.value === "all" ? "Tất cả trạng thái" : item.label}</option>)}</select></AdminFilterBar>
    <ContentBulkBar
      deleteRequest={(item) => ({ method: "DELETE", url: `/api/v1/admin/support-downloads/${item.id}?version=${item.draftVersion}` })}
      items={visibleRows}
      module="support_downloads"
      noun="tệp cài đặt"
      onClear={selection.clear}
      request={(item, action) => ({ method: "PATCH", url: `/api/v1/admin/support-downloads/${item.id}`, body: action === "publish" || action === "unpublish"
        ? { action: "save", values: { ...valuesOf(item), isEnabled: action === "publish" }, expectedVersion: item.draftVersion }
        : { action, expectedVersion: item.draftVersion } })}
      selectedIds={selection.selectedIds}
    />
    <AdminDataTable columns={columns} emptyAction={rows.length ? <AdminButton onClick={() => { setQuery(""); setFilter("all"); }} variant="secondary">Xóa bộ lọc</AdminButton> : <AdminButton hideWithoutPermission permission="support_downloads.create" onClick={create}>Thêm tệp cài đặt</AdminButton>} emptyMessage={rows.length ? "Không có tệp cài đặt phù hợp với bộ lọc." : "Chưa có tệp cài đặt. Bấm “Thêm” để tải PDF hoặc ZIP; hệ thống tự tạo bản nháp để bạn hoàn thiện."} getRowId={(item) => item.id} getRowLabel={(item) => item.title} onRowClick={select} onSelectionChange={selection.setSelectedIds} rows={visibleRows} selectedIds={selection.selectedIds} tableId="support-downloads" />
  </>;

  const editor = <>
    <header className="admin-list-manager__panel-header">
      <div><div className="flex items-center gap-2"><h2>{active?.title || (form ? "Thêm tệp cài đặt" : "Tệp cài đặt")}</h2>{active ? <AdminStatusBadge tone={statusTone[active.status]}>{statusLabel[active.status]}</AdminStatusBadge> : null}</div><small className={dirty ? "admin-list-manager__dirty" : undefined}>{dirty ? "Có thay đổi chưa lưu." : active ? `Phiên bản ${active.draftVersion}` : "Tải PDF hoặc ZIP để tự tạo bản nháp, hoặc nhập tên rồi bấm Lưu."}</small></div>
    </header>
    <div className="admin-list-manager__form">
      {form ? <form className="grid gap-4" id="support-download-editor" noValidate onSubmit={event => { event.preventDefault(); void save(); }} ref={formElement}>
        {saveError ? <AdminNotice tone="error">{saveError}</AdminNotice> : null}
        {validation.summary}
        {!canEdit ? <AdminNotice tone="info">{active?.status === "published" && !canPublish ? "Tệp đang hiển thị trên website. Bạn cần quyền xuất bản tệp cài đặt để sửa mục này." : "Bạn chỉ có quyền xem tệp cài đặt này."}</AdminNotice> : null}
        {archived ? <AdminNotice tone="warning">Tệp cài đặt đang lưu trữ và không xuất hiện trên website. Khôi phục để chỉnh sửa.</AdminNotice> : null}
        <fieldset className="grid gap-4" disabled={busy || archived || !canEdit}>
          <div {...validation.props("fileMediaId")} tabIndex={-1}><MediaPicker disabled={busy || archived || !canEdit} files onUploadingChange={onUploadingChange} onChange={(fileMediaId) => update("fileMediaId", fileMediaId)} onUploaded={saveUploadedFile} value={form.fileMediaId} /></div>
          {validation.message("fileMediaId")}
          <p className="admin-help">Tải tệp mới sẽ tự lưu thông tin hiện tại. Chọn tệp có sẵn từ thư viện thì bấm Lưu để hoàn tất.</p>
          <AdminFormField id={validation.props("title").id} label="Tên hiển thị" error={validation.message("title")}><input {...validation.props("title")} className="admin-input" ref={titleInput} maxLength={220} onChange={(event) => update("title", event.target.value)} required value={form.title} /></AdminFormField>
          <AdminFormField id={validation.props("description").id} label="Mô tả" error={validation.message("description")}><textarea {...validation.props("description")} className="min-h-28" maxLength={10000} onChange={(event) => update("description", event.target.value || null)} value={form.description ?? ""} /></AdminFormField>
          <div className="admin-form-grid"><AdminFormField id={validation.props("meta").id} label="Thông tin phụ" error={validation.message("meta")}><input {...validation.props("meta")} className="admin-input" maxLength={160} onChange={(event) => update("meta", event.target.value || null)} value={form.meta ?? ""} /></AdminFormField><AdminFormField id={validation.props("sortOrder").id} label="Thứ tự" error={validation.message("sortOrder")}><input {...validation.props("sortOrder")} className="admin-input" max={10000} min={0} onChange={(event) => update("sortOrder", Number(event.target.value))} type="number" value={form.sortOrder} /></AdminFormField></div>
          <label className="admin-check"><input checked={form.isEnabled} disabled={!canPublish} onChange={(event) => update("isEnabled", event.target.checked)} type="checkbox" />Hiển thị công khai trên website</label>
          {!canPublish ? <p className="admin-help">Cần quyền xuất bản tệp cài đặt để thay đổi hiển thị trên website.</p> : null}
        </fieldset>
        {active?.downloadUrl && active.status === "published" ? <AdminButton href={active.downloadUrl} target="_blank" variant="secondary"><Download aria-hidden="true" size={16} />Mở tệp công khai</AdminButton> : null}
        {active ? <details className="border-t border-[var(--cms-border)] pt-4"><summary className="admin-link cursor-pointer">Lịch sử và khôi phục</summary><RevisionHistory disabled={dirty || busy || !canEdit} expectedVersion={active.draftVersion} id={active.id} target="downloads" onRestorePendingChange={revisionRestore.onPendingChange} onRestored={revisionRestore.onRestored} /></details> : null}
      </form> : <AdminEmptyState action={<AdminButton hideWithoutPermission permission="support_downloads.create" onClick={create}>Thêm tệp cài đặt</AdminButton>} description="Chọn một tệp trong bảng để chỉnh sửa." icon={<FileDown aria-hidden="true" size={20} />} title="Chưa chọn tệp cài đặt" />}
    </div>
  </>;

  const actions = form ? <>{dirty ? <AdminButton disabled={busy} onClick={discardChanges} variant="secondary"><RotateCcw aria-hidden="true" size={16} />Bỏ thay đổi</AdminButton> : null}{active ? <AdminButton disabled={busy || dirty || !can("support_downloads.update")} hideWithoutPermission onClick={changeArchiveState} permission="support_downloads.publish" variant="secondary">{archived ? <ArchiveRestore aria-hidden="true" size={16} /> : <Archive aria-hidden="true" size={16} />}{archived ? "Khôi phục" : "Lưu trữ"}</AdminButton> : null}<AdminButton disabled={busy || !dirty || archived || !canEdit} form="support-download-editor" type="submit" permission={active ? "support_downloads.update" : "support_downloads.create"}><Save aria-hidden="true" size={16} />{busy ? "Đang lưu…" : "Lưu"}</AdminButton></> : null;

  return <AdminListPage><AdminCard>{sidebar}</AdminCard><AdminSidePanel label={active ? `Tệp cài đặt: ${active.title}` : "Thêm tệp cài đặt"} footer={actions} isOpen={form !== null} onClose={closeEditor}>{editor}</AdminSidePanel></AdminListPage>;
}
