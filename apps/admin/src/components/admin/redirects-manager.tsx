"use client";

import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { ArrowRight, Edit3, Link2, Plus, RotateCcw, Save, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { redirectInputSchema } from "@iorder/shared/server/redirects/redirects.contract";

import { DataTransferActions } from "./data-transfer-actions";
import { AdminBulkBar } from "./ui/admin-bulk-bar";
import { AdminBulkMenu, type AdminBulkMenuAction } from "./ui/admin-bulk-menu";
import { AdminButton } from "./ui/admin-button";
import { AdminCard } from "./ui/admin-card";
import { useAdminConfirm } from "./ui/admin-confirm-dialog";
import { AdminDataTable, type AdminDataTableColumn } from "./ui/admin-data-table";
import { AdminNotice, AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";
import { AdminFilterBar, type AdminFilterChip } from "./ui/admin-filter-bar";
import { AdminListHeader } from "./ui/admin-list-header";
import { AdminListPage } from "./ui/admin-list-page";
import { AdminSearchField } from "./ui/admin-search-field";
import { AdminFileIcon } from "./ui/admin-file-icon";
import { useAdminPermissions } from "./ui/admin-permissions";
import { AdminSidePanel } from "./ui/admin-side-panel";
import { useRowSelection } from "./ui/content-bulk-bar";
import { useBulkAction } from "./ui/use-bulk-action";
import { useAdminFormValidation } from "./ui/use-admin-form-validation";
import { useNavigationGuard } from "./ui/use-navigation-guard";

type RedirectInput = { sourcePath: string; destinationPath: string; statusCode: 301 | 308; isEnabled: boolean };
type Redirect = RedirectInput & { id: string; version: number };
type RedirectStatusFilter = "all" | "enabled" | "disabled";

const blank: RedirectInput = { sourcePath: "", destinationPath: "", statusCode: 301, isEnabled: true };

function valuesOf(item: Redirect): RedirectInput {
  return { sourcePath: item.sourcePath, destinationPath: item.destinationPath, statusCode: item.statusCode, isEnabled: item.isEnabled };
}

export function RedirectsManager({ initialRedirects }: { initialRedirects: Redirect[] }) {
  const router = useRouter();
  const { confirm } = useAdminConfirm();
  const { show: showToast } = useAdminToast();
  const [rows, setRows] = useState(initialRedirects);
  // Nhập file xong gọi router.refresh(): nhận danh sách mới từ máy chủ thay cho bản đang giữ.
  const [loadedRedirects, setLoadedRedirects] = useState(initialRedirects);
  if (loadedRedirects !== initialRedirects) {
    setLoadedRedirects(initialRedirects);
    setRows(initialRedirects);
  }
  const [activeId, setActiveId] = useState<string | null>(null);
  const [form, setForm] = useState<RedirectInput | null>(null);
  const [initialValues, setInitialValues] = useState<RedirectInput | null>(null);
  const [busy, setBusy] = useState(false);
  const mutationPending = useRef(false);
  const [saveError, setSaveError] = useState("");
  const validation = useAdminFormValidation("redirect", {
    sourcePath: { label: "Đường dẫn cũ", message: "Nhập đường dẫn nội bộ bắt đầu bằng /, tối đa 500 ký tự." },
    destinationPath: { label: "Đường dẫn mới", message: "Nhập đường dẫn nội bộ bắt đầu bằng /, tối đa 1.000 ký tự." },
    statusCode: { label: "Mã chuyển hướng", message: "Chọn mã chuyển hướng 301 hoặc 308." },
    isEnabled: { label: "Trạng thái", message: "Chọn trạng thái chuyển hướng." },
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RedirectStatusFilter>("all");
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  const active = rows.find((item) => item.id === activeId);
  const dirty = JSON.stringify(form) !== JSON.stringify(initialValues);
  useNavigationGuard(dirty || busy);

  const [codeFilter, setCodeFilter] = useState("all");
  const chips: AdminFilterChip[] = [
    ...(query.trim() ? [{ key: "query", label: `Từ khóa: “${query.trim()}”`, onRemove: () => setQuery("") }] : []),
    ...(statusFilter !== "all" ? [{ key: "status", label: `Trạng thái: ${statusFilter === "enabled" ? "Đang bật" : "Đang tắt"}`, onRemove: () => setStatusFilter("all") }] : []),
    ...(codeFilter !== "all" ? [{ key: "code", label: `Mã: ${codeFilter}`, onRemove: () => setCodeFilter("all") }] : []),
  ];
  const statusCodes = [...new Set(rows.map((item) => item.statusCode))].sort();
  const visibleRows = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi");
    return rows.filter((item) => {
      const matchesQuery = !keyword || `${item.sourcePath} ${item.destinationPath}`.toLocaleLowerCase("vi").includes(keyword);
      return matchesQuery && (codeFilter === "all" || String(item.statusCode) === codeFilter) && (statusFilter === "all" || (statusFilter === "enabled" && item.isEnabled) || (statusFilter === "disabled" && !item.isEnabled));
    });
  }, [codeFilter, query, rows, statusFilter]);
  // Chọn nhiều dòng: bỏ chọn khi đổi từ khóa/bộ lọc; thao tác chỉ áp dụng cho dòng còn hiện trong bảng.
  const { can } = useAdminPermissions();
  const selection = useRowSelection(`${query.trim()}|${statusFilter}|${codeFilter}`);
  const { busy: bulkBusy, run: runBulk } = useBulkAction();
  const chosen = visibleRows.filter((item) => selection.selectedIds.includes(item.id));
  const enabledChosen = chosen.filter((item) => item.isEnabled);
  const disabledChosen = chosen.filter((item) => !item.isEnabled);
  const updateDenied = can("redirects.update") ? undefined : "Cần quyền sửa chuyển hướng.";
  const setEnabled = (items: Redirect[], isEnabled: boolean) => () => void runBulk({
    items, verb: isEnabled ? "Bật" : "Tắt", noun: "chuyển hướng", onDone: selection.clear,
    confirmMessage: isEnabled ? undefined : "Đường dẫn cũ sẽ không còn tự chuyển sang trang mới (có thể trả 404).",
    request: (item) => ({ method: "POST", url: "/api/v1/admin/redirects", body: { id: item.id, values: { sourcePath: item.sourcePath, destinationPath: item.destinationPath, statusCode: item.statusCode, isEnabled }, expectedVersion: item.version } }),
  });
  const bulkActions: AdminBulkMenuAction[] = [
    { key: "enable", label: "Bật", icon: <ToggleRight aria-hidden="true" />, count: disabledChosen.length, disabledReason: updateDenied, onSelect: setEnabled(disabledChosen, true) },
    { key: "disable", label: "Tắt", icon: <ToggleLeft aria-hidden="true" />, count: enabledChosen.length, disabledReason: updateDenied, onSelect: setEnabled(enabledChosen, false) },
    { key: "export", label: "Xuất Excel", icon: <AdminFileIcon action="export" kind="excel" size="sm" />, count: chosen.length, href: `/api/v1/admin/data-transfer/redirects?format=xlsx&ids=${chosen.map((item) => item.id).join(",")}` },
    { key: "delete", label: "Xóa", icon: <Trash2 aria-hidden="true" />, count: chosen.length, tone: "danger", disabledReason: can("redirects.delete") ? undefined : "Cần quyền xóa chuyển hướng.", onSelect: () => void runBulk({ items: chosen, verb: "Xóa", noun: "chuyển hướng", confirmMessage: "Đường dẫn cũ của các mục này sẽ không còn tự chuyển hướng. Thao tác không thể hoàn tác.", tone: "danger", onDone: selection.clear, request: (item) => ({ method: "DELETE", url: `/api/v1/admin/redirects?id=${item.id}&expectedVersion=${item.version}` }) }) },
  ];

  function allowSelectionChange() {
    if (mutationPending.current) {
      showToast("Đang xử lý chuyển hướng. Vui lòng chờ trước khi đóng hoặc chuyển mục.", "info");
      return false;
    }
    if (!dirty) return true;
    showToast("Bạn có thay đổi chưa lưu. Hãy lưu hoặc bỏ thay đổi trước khi chuyển mục.", "warning");
    return false;
  }

  function select(item?: Redirect) {
    if (!allowSelectionChange()) return;
    const values = item ? valuesOf(item) : { ...blank };
    setActiveId(item?.id ?? null);
    validation.reset();
    setSaveError("");
    setForm(values);
    setInitialValues(values);
  }

  function closeEditor() {
    if (!allowSelectionChange()) return;
    setActiveId(null);
    setForm(null);
    setInitialValues(null);
  }

  function discardChanges() {
    if (mutationPending.current) return;
    validation.reset();
    setSaveError("");
    setForm(initialValues);
    showToast("Đã bỏ các thay đổi chưa lưu.", "info");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !dirty || mutationPending.current) return;
    const parsed = redirectInputSchema.safeParse(form);
    setSaveError("");
    if (!parsed.success) {
      validation.report(parsed.error.issues);
      return;
    }
    const values = parsed.data;
    validation.reset();
    mutationPending.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/v1/admin/redirects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: activeId, values, ...(active ? { expectedVersion: active.version } : {}) }),
      });
      const body = await readAdminJson(response);
      if (!response.ok) throw adminApiError(body, "Không thể lưu chuyển hướng.");
      if (typeof body.id !== "string" || !body.id || (activeId && body.id !== activeId)) throw new Error("Phản hồi lưu chuyển hướng không hợp lệ. Hãy kiểm tra danh sách trước khi thử lại.");
      const saved: Redirect = { id: body.id, version: active ? active.version + 1 : 0, ...values };
      setRows((current) => (current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]).sort((first, second) => first.sourcePath.localeCompare(second.sourcePath, "vi")));
      setActiveId(saved.id);
      setForm(values);
      setInitialValues(values);
      showToast(active ? "Đã lưu chuyển hướng." : "Đã tạo chuyển hướng.", "success");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không kết nối được máy chủ.";
      setSaveError(message);
      showToast(message, "error");
    } finally {
      mutationPending.current = false;
      setBusy(false);
    }
  }

  async function removeCurrent() {
    if (mutationPending.current) return;
    if (!active || dirty) {
      if (dirty) showToast("Hãy lưu hoặc bỏ thay đổi trước khi xóa.", "warning");
      return;
    }
    if (!await confirm({ title: "Xác nhận xóa chuyển hướng", message: `Xóa chuyển hướng ${active.sourcePath}? Thao tác không thể hoàn tác.`, confirmLabel: "Xóa", tone: "danger" })) return;

    mutationPending.current = true;
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/admin/redirects?id=${active.id}&expectedVersion=${active.version}`, { method: "DELETE" });
      const body = await readAdminJson(response);
      if (!response.ok) throw adminApiError(body, "Không thể xóa chuyển hướng.");
      if (body.deletedId !== active.id) throw new Error("Phản hồi xóa chuyển hướng không hợp lệ. Hãy tải lại danh sách để kiểm tra.");
      setRows((current) => current.filter((item) => item.id !== active.id));
      setActiveId(null);
      setForm(null);
      setInitialValues(null);
      showToast("Đã xóa chuyển hướng.", "success");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      mutationPending.current = false;
      setBusy(false);
    }
  }

  const columns: AdminDataTableColumn<Redirect>[] = [
    { id: "source", label: "Đường dẫn cũ", defaultWidth: 250, minWidth: 180, sortValue: (item) => item.sourcePath, cell: (item) => <button className="admin-list-manager__identity admin-list-manager__path" onClick={(event) => { event.stopPropagation(); select(item); }} type="button"><strong>{item.sourcePath}</strong></button> },
    { id: "destination", label: "Đích đến", defaultWidth: 270, minWidth: 190, sortValue: (item) => item.destinationPath, cell: (item) => <span className="admin-list-manager__destination"><ArrowRight aria-hidden="true" size={14} />{item.destinationPath}</span> },
    { id: "code", label: "Mã", defaultWidth: 105, minWidth: 92, sortValue: (item) => item.statusCode, cell: (item) => <span>{item.statusCode}</span> },
    { id: "status", label: "Trạng thái", defaultWidth: 140, minWidth: 120, sortValue: (item) => (item.isEnabled ? 0 : 1), cell: (item) => <AdminStatusBadge tone={item.isEnabled ? "success" : "neutral"}>{item.isEnabled ? "Đang bật" : "Đang tắt"}</AdminStatusBadge> },
    { id: "actions", label: "Thao tác", defaultWidth: 126, minWidth: 116, align: "right", cell: (item) => <button aria-label={`Chỉnh sửa ${item.sourcePath}`} className="admin-list-manager__row-action" onClick={(event) => { event.stopPropagation(); select(item); }} type="button"><Edit3 aria-hidden="true" size={15} />Sửa</button> },
  ];

  const enabledCount = rows.filter((item) => item.isEnabled).length;
  const footer = form ? <>
    <span className="admin-list-manager__footer-start">{active ? <AdminButton disabled={busy} hideWithoutPermission onClick={removeCurrent} permission="redirects.delete" variant="danger">Xóa</AdminButton> : null}</span>
    <span className="flex gap-2">{dirty ? <AdminButton disabled={busy} onClick={discardChanges} variant="secondary"><RotateCcw aria-hidden="true" size={16} />Bỏ thay đổi</AdminButton> : null}<AdminButton disabled={busy || !dirty} form="redirect-editor" permission={active ? "redirects.update" : "redirects.create"} type="submit"><Save aria-hidden="true" size={16} />{busy ? "Đang lưu…" : "Lưu"}</AdminButton></span>
  </> : null;

  return <AdminListPage className="admin-list-manager" variant="dense">
    <AdminCard className="admin-list-manager__card">
      <AdminListHeader actions={<><DataTransferActions dataset="redirects" label="Chuyển hướng URL" module="redirects" /><AdminButton hideWithoutPermission permission="redirects.create" leadingIcon={<Plus aria-hidden="true" size={16} />} onClick={() => select()}>Tạo chuyển hướng</AdminButton></>} description={`${rows.length} đường dẫn · ${enabledCount} đang bật`} headingLevel={1} title="Chuyển hướng URL" />
      <AdminFilterBar onSubmit={(event) => event.preventDefault()} chips={chips} onClearAll={() => { setQuery(""); setStatusFilter("all"); setCodeFilter("all"); }} search={<AdminSearchField id="redirect-search" label="Tìm chuyển hướng" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm đường dẫn cũ hoặc đích đến" value={query} />}><select aria-label="Lọc trạng thái" id="redirect-status" onChange={(event) => setStatusFilter(event.target.value as RedirectStatusFilter)} value={statusFilter}><option value="all">Tất cả trạng thái</option><option value="enabled">Đang bật</option><option value="disabled">Đang tắt</option></select>{statusCodes.length > 1 ? <select aria-label="Lọc mã chuyển hướng" onChange={(event) => setCodeFilter(event.target.value)} value={codeFilter}><option value="all">Mọi mã</option>{statusCodes.map((code) => <option key={code} value={String(code)}>{code}</option>)}</select> : null}</AdminFilterBar>
      <AdminBulkBar count={chosen.length} onClear={selection.clear}><AdminBulkMenu actions={bulkActions} busy={bulkBusy} /></AdminBulkBar>
      <AdminDataTable columns={columns} emptyAction={query.trim() || statusFilter !== "all" || codeFilter !== "all" ? <AdminButton onClick={() => { setQuery(""); setStatusFilter("all"); setCodeFilter("all"); }} variant="secondary">Xóa bộ lọc</AdminButton> : undefined} emptyMessage={rows.length ? "Không có chuyển hướng phù hợp với bộ lọc." : "Chưa có chuyển hướng URL."} getRowId={(item) => item.id} getRowLabel={(item) => item.sourcePath} onRowClick={select} onSelectionChange={selection.setSelectedIds} onSettingsOpenChange={setIsColumnSettingsOpen} selectedIds={selection.selectedIds} rows={visibleRows} settingsOpen={isColumnSettingsOpen} tableId="cms-redirects" />
    </AdminCard>
    <AdminSidePanel footer={footer} isOpen={form !== null} label={active ? "Chỉnh sửa chuyển hướng" : "Tạo chuyển hướng"} onClose={closeEditor}>
      <header className="admin-list-manager__panel-header"><span className="admin-list-manager__panel-icon"><Link2 aria-hidden="true" size={18} /></span><div><p>{active ? "Chỉnh sửa chuyển hướng" : "Tạo chuyển hướng"}</p><h2>{active?.sourcePath || "Chuyển hướng mới"}</h2><small className={dirty ? "admin-list-manager__dirty" : undefined}>{dirty ? "Có thay đổi chưa lưu." : active ? `${active.destinationPath} · ${active.statusCode}` : "Khai báo URL cũ và đích đến mới."}</small></div></header>
      {form ? <form className="admin-list-manager__form" id="redirect-editor" noValidate onSubmit={save}>
        {validation.summary}
        {saveError ? <AdminNotice tone="error">{saveError}</AdminNotice> : null}
        <p className="admin-help">Nhập đường dẫn cũ và đích đến mới trên website. Ví dụ: /trang-cu → /trang-moi.</p>
        <fieldset disabled={busy}><Field id="redirect-sourcePath" label="Đường dẫn cũ"><input {...validation.props("sourcePath")} className="admin-input" onChange={(event) => setForm({ ...form, sourcePath: event.target.value })} placeholder="/giai-phap-cu" required value={form.sourcePath} />{validation.message("sourcePath")}</Field><Field id="redirect-destinationPath" label="Đường dẫn mới"><input {...validation.props("destinationPath")} className="admin-input" onChange={(event) => setForm({ ...form, destinationPath: event.target.value })} placeholder="/giai-phap" required value={form.destinationPath} />{validation.message("destinationPath")}</Field><div className="admin-list-manager__form-grid"><Field id="redirect-statusCode" label="Mã chuyển hướng"><select {...validation.props("statusCode")} className="admin-input" onChange={(event) => setForm({ ...form, statusCode: Number(event.target.value) as 301 | 308 })} value={form.statusCode}><option value={301}>301 — Vĩnh viễn</option><option value={308}>308 — Vĩnh viễn, giữ phương thức</option></select>{validation.message("statusCode")}</Field><label className="admin-list-manager__toggle"><input checked={form.isEnabled} onChange={(event) => setForm({ ...form, isEnabled: event.target.checked })} type="checkbox" />Đang bật</label></div></fieldset>
        <details className="admin-form-help"><summary>Quy tắc đường dẫn và mã chuyển hướng</summary>
        <AdminNotice tone="info">Chỉ dùng đường dẫn nội bộ bắt đầu bằng <code>/</code>. Nguồn không chứa query (<code>?</code>), fragment (<code>#</code>) hoặc đoạn <code>..</code>. Website giữ query của URL khách truy cập thay cho query cấu hình ở đích. Mã 301 phù hợp hầu hết URL cũ; 308 giữ nguyên HTTP method.</AdminNotice>
        </details>
      </form> : null}
    </AdminSidePanel>
  </AdminListPage>;
}

function Field({ children, id, label }: { children: ReactNode; id: string; label: string }) {
  return <div className="admin-list-manager__field"><label htmlFor={id}>{label}</label>{children}</div>;
}
