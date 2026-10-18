"use client";
import { requestAdminJson } from "@/lib/admin-api";

import { Archive, ArchiveRestore, Download, FileDown, Plus, RotateCcw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";

import type { AdminSupportDownload, AdminSupportDownloadInput } from "@iorder/core/server/support/support-downloads.contract";
import { parseSavedSupportDownload, supportDownloadCreateRequestSchema, supportDownloadMutationSchema } from "@iorder/core/server/support/support-downloads.contract";
import type { MediaAsset } from "@iorder/core/server/media/media.contract";

import { MediaPicker } from "./media-picker";
import { RevisionHistory } from "./revision-history";
import { AdminButton } from "./ui/admin-button";
import { AdminEmptyState } from "./ui/admin-empty-state";
import { AdminNotice, AdminStatusBadge, useAdminToast, type AdminFeedbackTone } from "./ui/admin-feedback";
import { AdminCard } from "./ui/admin-card";
import { AdminFilterBar } from "./ui/admin-filter-bar";
import { AdminListHeader } from "./ui/admin-list-header";
import { AdminListPage } from "./ui/admin-list-page";
import { AdminSearchField } from "./ui/admin-search-field";
import { AdminSidePanel } from "./ui/admin-side-panel";
import { useNavigationGuard } from "./ui/use-navigation-guard";
import { useRevisionRestore } from "./ui/use-revision-restore";
import { useAdminPermissions } from "./ui/admin-permissions";

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
  return name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim() || "Tài nguyên mới";
}

async function requestJson(url: string, method: "PATCH" | "POST", body: unknown) {
  const mutationResult = method === "PATCH" ? supportDownloadMutationSchema.safeParse(body) : undefined;
  const createResult = method === "POST" ? supportDownloadCreateRequestSchema.safeParse(body) : undefined;
  if (mutationResult?.success === false || createResult?.success === false) throw new Error("Vui lòng kiểm tra tên, thông tin và tệp liên kết trước khi lưu.");
  const mutation = mutationResult?.data;
  const create = createResult?.data;
  const payload = await requestAdminJson(url, method, body, "Không thể cập nhật tài nguyên.");
  const isEnabled = mutation?.action === "save" ? mutation.values.isEnabled : create?.values.isEnabled;
  const download = parseSavedSupportDownload(payload, {
    id: mutation ? url.split("/").at(-1) : undefined,
    version: mutation ? mutation.expectedVersion + 1 : 1,
    status: mutation?.action === "archive" ? "archived" : mutation?.action === "restore" ? "draft" : isEnabled ? "published" : "draft",
  });
  if (!download) throw new Error("Phản hồi lưu tài nguyên không hợp lệ hoặc không khớp. Vui lòng tải lại để kiểm tra trước khi thử lại.");
  return download;
}

export function SupportDownloadManagerList({
  items,
  initialSelectedId,
  startCreating = false,
  tabs,
}: {
  items: AdminSupportDownload[];
  initialSelectedId?: string;
  startCreating?: boolean;
  tabs?: ReactNode;
}) {
  const { can } = useAdminPermissions();
  const router = useRouter();
  const { show: showToast } = useAdminToast();
  const initialActive = items.find((item) => item.id === initialSelectedId);
  const [rows, setRows] = useState(items);
  const [activeId, setActiveId] = useState<string | null>(initialActive?.id ?? null);
  const [form, setForm] = useState<AdminSupportDownloadInput | null>(() => startCreating ? { ...blank } : initialActive ? valuesOf(initialActive) : null);
  const [initialValues, setInitialValues] = useState<AdminSupportDownloadInput | null>(() => startCreating ? { ...blank } : initialActive ? valuesOf(initialActive) : null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [isSaving, setBusy] = useState(false);
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
  const active = rows.find((item) => item.id === activeId);
  const dirty = !equalValues(form, initialValues);
  const archived = active?.status === "archived";
  const filterItems: Array<{ label: string; value: Filter }> = [
    { label: "Tất cả", value: "all" },
    { label: statusLabel.published, value: "published" },
    { label: statusLabel.draft, value: "draft" },
    { label: statusLabel.archived, value: "archived" },
  ];

  const visibleRows = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi");
    return rows.filter((item) => (!keyword || `${item.title} ${item.originalName ?? ""}`.toLocaleLowerCase("vi").includes(keyword)) && (filter === "all" || item.status === filter));
  }, [filter, query, rows]);

  useNavigationGuard(!revisionRestore.completing && (dirty || busy), () => {
    showToast(busy ? "Đang xử lý tài nguyên. Vui lòng chờ trước khi rời trang." : "Bạn có thay đổi chưa lưu. Hãy lưu hoặc bỏ thay đổi trước khi rời trang.", "warning");
  });

  function allowSelectionChange() {
    if (saving.current || uploading.current || revisionRestore.pending.current) {
      showToast("Đang xử lý tài nguyên. Vui lòng chờ trước khi đổi hoặc đóng.", "info");
      return false;
    }
    if (!dirty) return true;
    showToast("Hãy lưu hoặc bỏ thay đổi hiện tại trước khi chọn tài nguyên khác.", "warning");
    return false;
  }

  function select(item: AdminSupportDownload) {
    if (!allowSelectionChange()) return;
    const values = valuesOf(item);
    setActiveId(item.id);
    setForm(values);
    setInitialValues(values);
  }

  function create() {
    if (!allowSelectionChange()) return;
    setActiveId(null);
    setForm({ ...blank });
    setInitialValues({ ...blank });
  }

  function closeEditor() {
    if (!allowSelectionChange()) return;
    setActiveId(null);
    setForm(null);
    setInitialValues(null);
  }

  function update<K extends keyof AdminSupportDownloadInput>(key: K, value: AdminSupportDownloadInput[K]) {
    if (saving.current || revisionRestore.pending.current) return;
    setForm((current) => current ? { ...current, [key]: value } : current);
  }

  function discardChanges() {
    if (saving.current || uploading.current || revisionRestore.pending.current) return;
    setForm(initialValues);
    titleInput.current?.focus();
    showToast("Đã bỏ các thay đổi chưa lưu.", "info");
  }

  function applySaved(download: AdminSupportDownload) {
    setRows((current) => current.some((item) => item.id === download.id)
      ? current.map((item) => item.id === download.id ? download : item)
      : [...current, download]);
    const values = valuesOf(download);
    setActiveId(download.id);
    setForm(values);
    setInitialValues(values);
  }

  async function save() {
    if (!form || archived || saving.current || uploading.current || revisionRestore.pending.current) return;
    saving.current = true;
    setBusy(true);
    try {
      const download = active
        ? await requestJson(`/api/admin/support-downloads/${active.id}`, "PATCH", {
            action: "save",
            values: form,
            expectedVersion: active.draftVersion,
            changeNote: "Cập nhật từ trình biên tập tài nguyên",
          })
        : await requestJson("/api/admin/support-downloads", "POST", {
            values: form,
            changeNote: "Tạo từ trình biên tập tài nguyên",
          });
      applySaved(download);
      showToast(active ? "Đã lưu tài nguyên và tạo phiên bản mới." : "Đã tạo tài nguyên tải xuống.", "success");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  async function saveUploadedFile(asset: MediaAsset) {
    if (!form || archived || saving.current || revisionRestore.pending.current) throw new Error("Không thể lưu tệp lúc này. Vui lòng chọn lại tệp trong thư viện.");
    saving.current = true;
    const values = {
      ...form,
      fileMediaId: asset.id,
      title: form.title.trim() || titleFromFileName(asset.originalName),
    };
    setBusy(true);
    try {
      const download = active
        ? await requestJson(`/api/admin/support-downloads/${active.id}`, "PATCH", {
            action: "save",
            values,
            expectedVersion: active.draftVersion,
            changeNote: "Tải tệp mới từ trình biên tập tài nguyên",
          })
        : await requestJson("/api/admin/support-downloads", "POST", {
            values,
            changeNote: "Tải tệp lên và tạo bản nháp tự động",
          });
      applySaved(download);
      showToast(active ? "Đã tải tệp lên và lưu thay đổi." : "Đã tải tệp lên và tạo bản nháp tự động.", "success");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể lưu tài nguyên vừa tải lên.", "error");
      throw error;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  async function changeArchiveState() {
    if (saving.current || uploading.current || revisionRestore.pending.current) return;
    if (!active || dirty) {
      if (dirty) showToast("Hãy lưu hoặc bỏ thay đổi trước khi lưu trữ.", "warning");
      return;
    }
    saving.current = true;
    setBusy(true);
    try {
      const download = await requestJson(`/api/admin/support-downloads/${active.id}`, "PATCH", {
        action: archived ? "restore" : "archive",
        expectedVersion: active.draftVersion,
      });
      applySaved(download);
      showToast(archived ? "Đã khôi phục tài nguyên về bản nháp." : "Đã chuyển tài nguyên vào lưu trữ.", archived ? "success" : "warning");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const sidebar = <>
      <AdminListHeader actions={<AdminButton hideWithoutPermission permission="support_downloads.create" leadingIcon={<Plus aria-hidden="true" size={16} />} onClick={create}>Thêm</AdminButton>} description={`${rows.length} tệp tải xuống`} headingLevel={1} title="Hỗ trợ cài đặt" />
      {tabs}
      <AdminFilterBar onSubmit={(event) => event.preventDefault()}><AdminSearchField id="support-download-search" label="Tìm tài nguyên" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên hoặc tệp" value={query} /><select aria-label="Lọc trạng thái" onChange={(event) => setFilter(event.target.value as Filter)} value={filter}>{filterItems.map((item) => <option key={item.value} value={item.value}>{item.value === "all" ? "Tất cả trạng thái" : item.label}</option>)}</select></AdminFilterBar>
    <div className="admin-select-list">
      {visibleRows.map((item) => <button aria-current={activeId === item.id ? "true" : undefined} className={activeId === item.id ? "admin-select-list__item admin-select-list__item--active" : "admin-select-list__item"} key={item.id} onClick={() => select(item)} type="button"><span className="flex items-center justify-between gap-2"><strong className="truncate">{item.title}</strong><AdminStatusBadge tone={statusTone[item.status]}>{statusLabel[item.status]}</AdminStatusBadge></span><small className="truncate">{item.originalName ?? "Chưa chọn tệp"}</small></button>)}
      {visibleRows.length === 0 ? <AdminEmptyState action={<AdminButton hideWithoutPermission onClick={create} permission="support_downloads.create">Tải PDF hoặc ZIP</AdminButton>} description={rows.length ? "Không có tài nguyên phù hợp với bộ lọc." : "Tải tệp trực tiếp; hệ thống sẽ tự tạo bản nháp để bạn hoàn thiện nội dung."} icon={<Download aria-hidden="true" size={19} />} title={rows.length ? "Không có kết quả" : "Chưa có tài nguyên"} /> : null}
    </div>
  </>;

  const editor = <>
    <header className="admin-list-manager__panel-header">
      <div><div className="flex items-center gap-2"><h2>{active?.title || (form ? "Tài nguyên mới" : "Trình biên tập")}</h2>{active ? <AdminStatusBadge tone={statusTone[active.status]}>{statusLabel[active.status]}</AdminStatusBadge> : null}</div><small className={dirty ? "admin-list-manager__dirty" : undefined}>{dirty ? "Có thay đổi chưa lưu." : active ? `Phiên bản ${active.draftVersion}` : "Chọn một mục hoặc tạo mới."}</small></div>
    </header>
    <div className="admin-list-manager__form">
      {form ? <div className="grid gap-4">
        {archived ? <AdminNotice tone="warning">Tài nguyên đang lưu trữ và không xuất hiện trên website. Khôi phục để chỉnh sửa.</AdminNotice> : null}
        <fieldset className="grid gap-4" disabled={busy || archived}>
          <MediaPicker disabled={busy || archived} files onUploadingChange={onUploadingChange} onChange={(fileMediaId) => update("fileMediaId", fileMediaId)} onUploaded={saveUploadedFile} value={form.fileMediaId} />
          <div className="admin-form-grid"><label className="admin-field">Tên hiển thị<input className="admin-input" ref={titleInput} maxLength={220} onChange={(event) => update("title", event.target.value)} required value={form.title} /></label><label className="admin-field">Biểu tượng<input className="admin-input" maxLength={60} onChange={(event) => update("icon", event.target.value)} required value={form.icon} /></label></div>
          <label className="admin-field">Mô tả<textarea className="min-h-28" maxLength={10000} onChange={(event) => update("description", event.target.value || null)} value={form.description ?? ""} /></label>
          <div className="admin-form-grid"><label className="admin-field">Thông tin phụ<input className="admin-input" maxLength={160} onChange={(event) => update("meta", event.target.value || null)} value={form.meta ?? ""} /></label><label className="admin-field">Thứ tự<input className="admin-input" max={10000} min={0} onChange={(event) => update("sortOrder", Number(event.target.value))} type="number" value={form.sortOrder} /></label></div>
          <label className="admin-check"><input checked={form.isEnabled} onChange={(event) => update("isEnabled", event.target.checked)} type="checkbox" />Hiển thị công khai trên website</label>
        </fieldset>
        {active?.downloadUrl && active.status === "published" ? <AdminButton href={active.downloadUrl} target="_blank" variant="secondary"><Download aria-hidden="true" size={16} />Mở tệp công khai</AdminButton> : null}
        {active ? <details className="border-t border-[var(--cms-border)] pt-4"><summary className="admin-link cursor-pointer">Lịch sử và khôi phục</summary><RevisionHistory disabled={dirty || busy} expectedVersion={active.draftVersion} id={active.id} target="downloads" onRestorePendingChange={revisionRestore.onPendingChange} onRestored={revisionRestore.onRestored} /></details> : null}
      </div> : <AdminEmptyState action={<AdminButton onClick={create}>Thêm tài nguyên</AdminButton>} description="Chọn một tài nguyên ở panel bên trái để chỉnh sửa." icon={<FileDown aria-hidden="true" size={20} />} title="Chưa chọn tài nguyên" />}
    </div>
  </>;

  const actions = form ? <>{dirty ? <AdminButton disabled={busy} onClick={discardChanges} variant="secondary"><RotateCcw aria-hidden="true" size={16} />Bỏ thay đổi</AdminButton> : null}{active ? <AdminButton disabled={busy || dirty || !can("support_downloads.update")} hideWithoutPermission onClick={changeArchiveState} permission="support_downloads.publish" variant="secondary">{archived ? <ArchiveRestore aria-hidden="true" size={16} /> : <Archive aria-hidden="true" size={16} />}{archived ? "Khôi phục" : "Lưu trữ"}</AdminButton> : null}<AdminButton disabled={busy || !dirty || archived} onClick={save} permission={active ? "support_downloads.update" : "support_downloads.create"}><Save aria-hidden="true" size={16} />{busy ? "Đang lưu…" : "Lưu"}</AdminButton></> : null;

  return <AdminListPage><AdminCard>{sidebar}</AdminCard><AdminSidePanel footer={actions} isOpen={form !== null} onClose={closeEditor}>{editor}</AdminSidePanel></AdminListPage>;
}
