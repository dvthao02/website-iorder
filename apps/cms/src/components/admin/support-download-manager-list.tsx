"use client";

import { Archive, ArchiveRestore, Download, FileDown, Plus, RotateCcw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type { AdminSupportDownload, AdminSupportDownloadInput } from "@iorder/core/server/support/support-downloads.contract";
import type { MediaAsset } from "@iorder/core/server/media/media.contract";

import { MediaPicker } from "./media-picker";
import { RevisionHistory } from "./revision-history";
import { AdminButton } from "./ui/admin-button";
import { AdminEmptyState } from "./ui/admin-empty-state";
import { AdminStatusBadge, useAdminToast, type AdminFeedbackTone } from "./ui/admin-feedback";
import { AdminCard } from "./ui/admin-card";
import { AdminSidePanel } from "./ui/admin-side-panel";

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
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null) as { download?: AdminSupportDownload; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(payload?.error?.message || "Không thể cập nhật tài nguyên.");
  if (!payload?.download) throw new Error("Máy chủ không trả về tài nguyên vừa cập nhật.");
  return payload.download;
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
  const router = useRouter();
  const { show: showToast } = useAdminToast();
  const initialActive = items.find((item) => item.id === initialSelectedId);
  const [rows, setRows] = useState(items);
  const [activeId, setActiveId] = useState<string | null>(initialActive?.id ?? null);
  const [form, setForm] = useState<AdminSupportDownloadInput | null>(() => startCreating ? { ...blank } : initialActive ? valuesOf(initialActive) : null);
  const [initialValues, setInitialValues] = useState<AdminSupportDownloadInput | null>(() => startCreating ? { ...blank } : initialActive ? valuesOf(initialActive) : null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const active = rows.find((item) => item.id === activeId);
  const dirty = !equalValues(form, initialValues);
  const archived = active?.status === "archived";

  const visibleRows = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi");
    return rows.filter((item) => (!keyword || `${item.title} ${item.originalName ?? ""}`.toLocaleLowerCase("vi").includes(keyword)) && (filter === "all" || item.status === filter));
  }, [filter, query, rows]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const blockInternalLink = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      event.preventDefault();
      showToast("Bạn có thay đổi chưa lưu. Hãy lưu hoặc bỏ thay đổi trước khi rời trang.", "warning");
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", blockInternalLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", blockInternalLink, true);
    };
  }, [dirty, showToast]);

  function allowSelectionChange() {
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
    setForm((current) => current ? { ...current, [key]: value } : current);
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
    if (!form || archived) return;
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
      setBusy(false);
    }
  }

  async function saveUploadedFile(asset: MediaAsset) {
    if (!form || archived) return;
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
    } finally {
      setBusy(false);
    }
  }

  async function changeArchiveState() {
    if (!active || dirty) {
      if (dirty) showToast("Hãy lưu hoặc bỏ thay đổi trước khi lưu trữ.", "warning");
      return;
    }
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
      setBusy(false);
    }
  }

  const sidebar = <>
    <header className="border-b border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700"><FileDown aria-hidden="true" size={18} /></span><div className="min-w-0"><h1 className="text-base font-extrabold text-slate-950">Tài nguyên</h1><p className="text-xs text-slate-500">{rows.length} tệp tải xuống</p></div></div><button aria-label="Tải tệp và tạo tài nguyên" className="grid size-9 place-items-center rounded-lg bg-blue-700 text-white hover:bg-blue-800" onClick={create} type="button"><Plus aria-hidden="true" size={17} /></button></div>
      <input className="admin-input mt-4" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên hoặc tệp…" value={query} />
      <div className="mt-3 flex flex-wrap gap-3" role="group" aria-label="Lọc trạng thái">{(["all", "published", "draft", "archived"] as const).map((value) => <button className={filter === value ? "text-xs font-extrabold text-blue-700" : "text-xs font-semibold text-slate-500 hover:text-slate-800"} key={value} onClick={() => setFilter(value)} type="button">{value === "all" ? "Tất cả" : statusLabel[value]}</button>)}</div>
    </header>
    <div className="min-h-[calc(100dvh-16rem)] overflow-y-auto p-2">
      {visibleRows.map((item) => <button aria-current={activeId === item.id ? "true" : undefined} className={activeId === item.id ? "mb-1 grid w-full gap-1 rounded-lg bg-blue-50 px-3 py-2 text-left text-blue-700" : "mb-1 grid w-full gap-1 rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-50"} key={item.id} onClick={() => select(item)} type="button"><span className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{item.title}</strong><AdminStatusBadge tone={statusTone[item.status]}>{statusLabel[item.status]}</AdminStatusBadge></span><small className="truncate opacity-75">{item.originalName ?? "Chưa chọn tệp"}</small></button>)}
      {visibleRows.length === 0 ? <AdminEmptyState action={<AdminButton onClick={create}>Tải PDF hoặc ZIP</AdminButton>} description={rows.length ? "Không có tài nguyên phù hợp với bộ lọc." : "Tải tệp trực tiếp; hệ thống sẽ tự tạo bản nháp để bạn hoàn thiện nội dung."} icon={<Download aria-hidden="true" size={19} />} title={rows.length ? "Không có kết quả" : "Chưa có tài nguyên"} /> : null}
    </div>
  </>;

  const editor = <>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 sm:px-5">
      <div><div className="flex items-center gap-2"><h2 className="text-lg font-extrabold text-slate-950">{active?.title || (form ? "Tài nguyên mới" : "Trình biên tập")}</h2>{active ? <AdminStatusBadge tone={statusTone[active.status]}>{statusLabel[active.status]}</AdminStatusBadge> : null}</div><p className={dirty ? "mt-1 text-sm font-semibold text-amber-700" : "mt-1 text-sm text-slate-500"}>{dirty ? "Có thay đổi chưa lưu." : active ? `Phiên bản ${active.draftVersion}` : "Chọn một mục hoặc tạo mới."}</p></div>
    </header>
    <div className="p-4 sm:p-5">
      {form ? <div className="grid gap-5">
        {archived ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Tài nguyên đang lưu trữ và không xuất hiện trên website. Khôi phục để chỉnh sửa.</p> : null}
        <fieldset className="grid gap-5" disabled={busy || archived}>
          <MediaPicker disabled={busy || archived} files onChange={(fileMediaId) => update("fileMediaId", fileMediaId)} onUploaded={saveUploadedFile} value={form.fileMediaId} />
          <div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-bold text-slate-700">Tên hiển thị<input className="admin-input" maxLength={220} onChange={(event) => update("title", event.target.value)} required value={form.title} /></label><label className="grid gap-2 text-sm font-bold text-slate-700">Biểu tượng<input className="admin-input" maxLength={60} onChange={(event) => update("icon", event.target.value)} required value={form.icon} /></label></div>
          <label className="grid gap-2 text-sm font-bold text-slate-700">Mô tả<textarea className="min-h-28 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" maxLength={10000} onChange={(event) => update("description", event.target.value.trim() ? event.target.value : null)} value={form.description ?? ""} /></label>
          <div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-bold text-slate-700">Thông tin phụ<input className="admin-input" maxLength={160} onChange={(event) => update("meta", event.target.value.trim() ? event.target.value : null)} value={form.meta ?? ""} /></label><label className="grid gap-2 text-sm font-bold text-slate-700">Thứ tự<input className="admin-input" max={10000} min={0} onChange={(event) => update("sortOrder", Number(event.target.value))} type="number" value={form.sortOrder} /></label></div>
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"><input checked={form.isEnabled} onChange={(event) => update("isEnabled", event.target.checked)} type="checkbox" />Hiển thị công khai trên website</label>
        </fieldset>
        {active?.downloadUrl && active.status === "published" ? <AdminButton href={active.downloadUrl} target="_blank" variant="secondary"><Download aria-hidden="true" size={16} />Mở tệp công khai</AdminButton> : null}
        {active ? <details className="border-t border-slate-200 pt-4"><summary className="cursor-pointer text-sm font-bold text-blue-700">Lịch sử và khôi phục</summary><RevisionHistory disabled={dirty} id={active.id} target="downloads" /></details> : null}
      </div> : <AdminEmptyState action={<AdminButton onClick={create}>Thêm tài nguyên</AdminButton>} description="Chọn một tài nguyên ở panel bên trái để chỉnh sửa." icon={<FileDown aria-hidden="true" size={20} />} title="Chưa chọn tài nguyên" />}
    </div>
  </>;

  const actions = form ? <>{dirty ? <AdminButton onClick={() => { setForm(initialValues); showToast("Đã bỏ các thay đổi chưa lưu.", "info"); }} variant="secondary"><RotateCcw aria-hidden="true" size={16} />Bỏ thay đổi</AdminButton> : null}{active ? <AdminButton disabled={busy || dirty} onClick={changeArchiveState} variant="secondary">{archived ? <ArchiveRestore aria-hidden="true" size={16} /> : <Archive aria-hidden="true" size={16} />}{archived ? "Khôi phục" : "Lưu trữ"}</AdminButton> : null}<AdminButton disabled={busy || !dirty || archived} onClick={save}><Save aria-hidden="true" size={16} />{busy ? "Đang lưu…" : "Lưu"}</AdminButton></> : null;

  return <><AdminCard className="min-h-[calc(100dvh-7rem)] overflow-hidden">{sidebar}</AdminCard><AdminSidePanel footer={actions} isOpen={form !== null} onClose={closeEditor}>{editor}</AdminSidePanel></>;
}
