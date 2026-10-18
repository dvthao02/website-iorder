"use client";

import { adminApiError } from "@/lib/admin-api";
import { ArrowRight, Edit3, Link2, Plus, RotateCcw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { redirectInputSchema } from "@iorder/core/server/redirects/redirects.contract";

import { AdminButton } from "./ui/admin-button";
import { AdminCard } from "./ui/admin-card";
import { useAdminConfirm } from "./ui/admin-confirm-dialog";
import { AdminDataTable, type AdminDataTableColumn } from "./ui/admin-data-table";
import { AdminNotice, AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";
import { AdminFilterBar } from "./ui/admin-filter-bar";
import { AdminListHeader } from "./ui/admin-list-header";
import { AdminListPage } from "./ui/admin-list-page";
import { AdminSearchField } from "./ui/admin-search-field";
import { AdminSidePanel } from "./ui/admin-side-panel";
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [form, setForm] = useState<RedirectInput | null>(null);
  const [initialValues, setInitialValues] = useState<RedirectInput | null>(null);
  const [busy, setBusy] = useState(false);
  const mutationPending = useRef(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RedirectStatusFilter>("all");
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  const active = rows.find((item) => item.id === activeId);
  const dirty = JSON.stringify(form) !== JSON.stringify(initialValues);
  useNavigationGuard(dirty || busy);

  const visibleRows = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi");
    return rows.filter((item) => {
      const matchesQuery = !keyword || `${item.sourcePath} ${item.destinationPath}`.toLocaleLowerCase("vi").includes(keyword);
      return matchesQuery && (statusFilter === "all" || (statusFilter === "enabled" && item.isEnabled) || (statusFilter === "disabled" && !item.isEnabled));
    });
  }, [query, rows, statusFilter]);

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
    setForm(initialValues);
    showToast("Đã bỏ các thay đổi chưa lưu.", "info");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !dirty || mutationPending.current) return;
    const parsed = redirectInputSchema.safeParse(form);
    if (!parsed.success) {
      showToast(parsed.error.issues[0]?.message ?? "Kiểm tra đường dẫn chuyển hướng.", "error");
      return;
    }
    const values = parsed.data;
    mutationPending.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/redirects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: activeId, values, ...(active ? { expectedVersion: active.version } : {}) }),
      });
      const body = await response.json();
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
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
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
      const response = await fetch(`/api/admin/redirects?id=${active.id}&expectedVersion=${active.version}`, { method: "DELETE" });
      const body = await response.json();
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
    { id: "source", label: "Đường dẫn cũ", defaultWidth: 250, minWidth: 180, cell: (item) => <button className="admin-list-manager__identity admin-list-manager__path" onClick={(event) => { event.stopPropagation(); select(item); }} type="button"><strong>{item.sourcePath}</strong></button> },
    { id: "destination", label: "Đích đến", defaultWidth: 270, minWidth: 190, cell: (item) => <span className="admin-list-manager__destination"><ArrowRight aria-hidden="true" size={14} />{item.destinationPath}</span> },
    { id: "code", label: "Mã", defaultWidth: 105, minWidth: 92, cell: (item) => <span>{item.statusCode}</span> },
    { id: "status", label: "Trạng thái", defaultWidth: 140, minWidth: 120, cell: (item) => <AdminStatusBadge tone={item.isEnabled ? "success" : "neutral"}>{item.isEnabled ? "Đang bật" : "Đang tắt"}</AdminStatusBadge> },
    { id: "actions", label: "Thao tác", defaultWidth: 126, minWidth: 116, align: "right", cell: (item) => <button aria-label={`Chỉnh sửa ${item.sourcePath}`} className="admin-list-manager__row-action" onClick={(event) => { event.stopPropagation(); select(item); }} type="button"><Edit3 aria-hidden="true" size={15} />Sửa</button> },
  ];

  const enabledCount = rows.filter((item) => item.isEnabled).length;
  const footer = form ? <>
    <span className="admin-list-manager__footer-start">{active ? <AdminButton disabled={busy} hideWithoutPermission onClick={removeCurrent} permission="redirects.delete" variant="danger">Xóa</AdminButton> : null}</span>
    <span className="flex gap-2">{dirty ? <AdminButton disabled={busy} onClick={discardChanges} variant="secondary"><RotateCcw aria-hidden="true" size={16} />Bỏ thay đổi</AdminButton> : null}<AdminButton disabled={busy || !dirty} form="redirect-editor" permission={active ? "redirects.update" : "redirects.create"} type="submit"><Save aria-hidden="true" size={16} />{busy ? "Đang lưu…" : "Lưu"}</AdminButton></span>
  </> : null;

  return <AdminListPage className="admin-list-manager" variant="dense">
    <AdminCard className="admin-list-manager__card">
      <AdminListHeader actions={<><AdminButton hideWithoutPermission permission="redirects.create" leadingIcon={<Plus aria-hidden="true" size={16} />} onClick={() => select()}>Tạo chuyển hướng</AdminButton></>} description={`${rows.length} đường dẫn · ${enabledCount} đang bật`} headingLevel={1} title="Chuyển hướng URL" />
      <AdminFilterBar onSubmit={(event) => event.preventDefault()}><AdminSearchField id="redirect-search" label="Tìm chuyển hướng" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm đường dẫn cũ hoặc đích đến" value={query} /><select aria-label="Lọc trạng thái" id="redirect-status" onChange={(event) => setStatusFilter(event.target.value as RedirectStatusFilter)} value={statusFilter}><option value="all">Tất cả trạng thái</option><option value="enabled">Đang bật</option><option value="disabled">Đang tắt</option></select></AdminFilterBar>
      <AdminDataTable columns={columns} emptyMessage={rows.length ? "Không có chuyển hướng phù hợp với bộ lọc." : "Chưa có chuyển hướng URL."} getRowId={(item) => item.id} onRowClick={select} onSettingsOpenChange={setIsColumnSettingsOpen} rows={visibleRows} settingsOpen={isColumnSettingsOpen} tableId="cms-redirects" />
    </AdminCard>
    <AdminSidePanel footer={footer} isOpen={form !== null} onClose={closeEditor}>
      <header className="admin-list-manager__panel-header"><span className="admin-list-manager__panel-icon"><Link2 aria-hidden="true" size={18} /></span><div><p>{active ? "Chỉnh sửa chuyển hướng" : "Tạo chuyển hướng"}</p><h2>{active?.sourcePath || "Chuyển hướng mới"}</h2><small className={dirty ? "admin-list-manager__dirty" : undefined}>{dirty ? "Có thay đổi chưa lưu." : active ? `${active.destinationPath} · ${active.statusCode}` : "Khai báo URL cũ và đích đến mới."}</small></div></header>
      {form ? <form className="admin-list-manager__form" id="redirect-editor" onSubmit={save}>
        <AdminNotice tone="info">Chỉ dùng đường dẫn nội bộ bắt đầu bằng <code>/</code>. Nguồn không chứa query (<code>?</code>), fragment (<code>#</code>) hoặc đoạn <code>..</code>. Website giữ query của URL khách truy cập thay cho query cấu hình ở đích. Mã 301 phù hợp hầu hết URL cũ; 308 giữ nguyên HTTP method.</AdminNotice>
        <fieldset disabled={busy}><Field label="Đường dẫn cũ"><input className="admin-input" onChange={(event) => setForm({ ...form, sourcePath: event.target.value })} placeholder="/giai-phap-cu" required value={form.sourcePath} /></Field><Field label="Đường dẫn mới"><input className="admin-input" onChange={(event) => setForm({ ...form, destinationPath: event.target.value })} placeholder="/giai-phap" required value={form.destinationPath} /></Field><div className="admin-list-manager__form-grid"><Field label="Mã chuyển hướng"><select className="admin-input" onChange={(event) => setForm({ ...form, statusCode: Number(event.target.value) as 301 | 308 })} value={form.statusCode}><option value={301}>301 — Vĩnh viễn</option><option value={308}>308 — Vĩnh viễn, giữ method</option></select></Field><label className="admin-list-manager__toggle"><input checked={form.isEnabled} onChange={(event) => setForm({ ...form, isEnabled: event.target.checked })} type="checkbox" />Đang bật</label></div></fieldset>
      </form> : null}
    </AdminSidePanel>
  </AdminListPage>;
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return <label className="admin-list-manager__field"><span>{label}</span>{children}</label>;
}
