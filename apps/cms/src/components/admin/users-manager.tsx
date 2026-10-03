"use client";

import { Edit3, Plus, RotateCcw, Save, Settings2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";

import type { CmsUserInput } from "@iorder/core/server/users/users.contract";

import { AdminButton } from "./ui/admin-button";
import { AdminCard } from "./ui/admin-card";
import { AdminDataTable, type AdminDataTableColumn } from "./ui/admin-data-table";
import { AdminEmptyState } from "./ui/admin-empty-state";
import { AdminNotice, AdminStatusBadge, useAdminToast, type AdminFeedbackTone } from "./ui/admin-feedback";
import { AdminSidePanel } from "./ui/admin-side-panel";

type CmsUser = Omit<CmsUserInput, "password"> & { id: string; lastLoginAt: Date | null };
type UserStatusFilter = "all" | CmsUser["status"];

const blank: CmsUserInput = { username: "", email: null, fullName: "", status: "active", role: "editor", password: null };
const statusLabel: Record<CmsUser["status"], string> = { active: "Hoạt động", disabled: "Đã khóa" };
const statusTone: Record<CmsUser["status"], AdminFeedbackTone> = { active: "success", disabled: "neutral" };
const roleLabel: Record<CmsUser["role"], string> = { admin: "Quản trị viên", editor: "Biên tập viên" };

function valuesOf(user: CmsUser): CmsUserInput {
  return { username: user.username, email: user.email, fullName: user.fullName, status: user.status, role: user.role, password: null };
}

function dateLabel(value: Date | null) {
  if (!value) return "Chưa đăng nhập";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function UsersManager({ initialUsers }: { initialUsers: CmsUser[] }) {
  const router = useRouter();
  const { show: showToast } = useAdminToast();
  const [rows, setRows] = useState(initialUsers);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [form, setForm] = useState<CmsUserInput | null>(null);
  const [initialValues, setInitialValues] = useState<CmsUserInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("all");
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  const active = rows.find((user) => user.id === activeId);
  const dirty = JSON.stringify(form) !== JSON.stringify(initialValues);

  const visibleRows = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi");
    return rows.filter((user) => {
      const matchesQuery = !keyword || `${user.fullName} ${user.username} ${user.email ?? ""}`.toLocaleLowerCase("vi").includes(keyword);
      return matchesQuery && (statusFilter === "all" || user.status === statusFilter);
    });
  }, [query, rows, statusFilter]);

  function allowSelectionChange() {
    if (!dirty) return true;
    showToast("Bạn có thay đổi chưa lưu. Hãy lưu hoặc bỏ thay đổi trước khi chuyển tài khoản.", "warning");
    return false;
  }

  function select(user?: CmsUser) {
    if (!allowSelectionChange()) return;
    const values = user ? valuesOf(user) : { ...blank };
    setActiveId(user?.id ?? null);
    setForm(values);
    setInitialValues(values);
  }

  function closeEditor() {
    if (!allowSelectionChange()) return;
    setActiveId(null);
    setForm(null);
    setInitialValues(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: active?.id ?? null, values: form }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể lưu tài khoản.");
      const values = { ...form, password: null };
      const saved: CmsUser = { id: body.id, username: values.username, email: values.email, fullName: values.fullName, status: values.status, role: values.role, lastLoginAt: active?.lastLoginAt ?? null };
      setRows((current) => current.some((user) => user.id === saved.id) ? current.map((user) => user.id === saved.id ? saved : user) : [...current, saved].sort((first, second) => first.username.localeCompare(second.username, "vi")));
      setActiveId(saved.id);
      setForm(values);
      setInitialValues(values);
      showToast(active ? "Đã lưu tài khoản CMS." : "Đã tạo tài khoản CMS.", "success");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      setBusy(false);
    }
  }

  const columns: AdminDataTableColumn<CmsUser>[] = [
    { id: "user", label: "Người dùng", defaultWidth: 270, minWidth: 200, cell: (user) => <button className="admin-list-manager__identity" onClick={(event) => { event.stopPropagation(); select(user); }} type="button"><strong>{user.fullName}</strong><small>@{user.username}{user.email ? ` · ${user.email}` : ""}</small></button> },
    { id: "role", label: "Vai trò", defaultWidth: 160, minWidth: 135, cell: (user) => <span>{roleLabel[user.role]}</span> },
    { id: "status", label: "Trạng thái", defaultWidth: 145, minWidth: 128, cell: (user) => <AdminStatusBadge tone={statusTone[user.status]}>{statusLabel[user.status]}</AdminStatusBadge> },
    { id: "lastLogin", label: "Đăng nhập gần nhất", defaultWidth: 200, minWidth: 165, cell: (user) => <span className="admin-list-manager__muted">{dateLabel(user.lastLoginAt)}</span> },
    { id: "actions", label: "Thao tác", defaultWidth: 126, minWidth: 116, align: "right", cell: (user) => <button aria-label={`Chỉnh sửa ${user.fullName}`} className="admin-list-manager__row-action" onClick={(event) => { event.stopPropagation(); select(user); }} type="button"><Edit3 aria-hidden="true" size={15} />Sửa</button> },
  ];

  const activeCount = rows.filter((user) => user.status === "active").length;
  const adminCount = rows.filter((user) => user.role === "admin" && user.status === "active").length;
  const footer = form ? <>{dirty ? <span className="admin-list-manager__footer-start"><AdminButton onClick={() => { setForm(initialValues); showToast("Đã bỏ các thay đổi chưa lưu.", "info"); }} variant="secondary"><RotateCcw aria-hidden="true" size={16} />Bỏ thay đổi</AdminButton></span> : null}<AdminButton disabled={busy || !dirty} form="cms-user-editor" type="submit"><Save aria-hidden="true" size={16} />{busy ? "Đang lưu…" : "Lưu"}</AdminButton></> : null;

  return <div className="admin-list-manager grid gap-5">
    <section className="admin-list-manager__summary" aria-label="Tóm tắt người dùng CMS"><UserSummary label="Tổng tài khoản" value={rows.length} /><UserSummary label="Đang hoạt động" value={activeCount} /><UserSummary label="Quản trị viên" value={adminCount} /></section>
    <AdminCard className="admin-list-manager__card">
      <header className="admin-list-manager__header"><div><h1>Người dùng CMS</h1><p>Quản lý quyền và trạng thái truy cập từ danh sách này.</p></div><div className="admin-list-manager__header-actions"><AdminButton onClick={() => setIsColumnSettingsOpen(true)} variant="secondary"><Settings2 aria-hidden="true" size={16} />Cài đặt cột</AdminButton><AdminButton onClick={() => select()}><Plus aria-hidden="true" size={16} />Tạo tài khoản</AdminButton></div></header>
      <div className="admin-list-manager__filters"><label className="sr-only" htmlFor="cms-user-search">Tìm người dùng</label><input className="admin-input" id="cms-user-search" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm họ tên, tên đăng nhập hoặc email…" value={query} /><label className="sr-only" htmlFor="cms-user-status">Lọc trạng thái</label><select className="admin-input" id="cms-user-status" onChange={(event) => setStatusFilter(event.target.value as UserStatusFilter)} value={statusFilter}><option value="all">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="disabled">Đã khóa</option></select></div>
      <AdminDataTable columns={columns} emptyMessage={rows.length ? "Không có người dùng phù hợp với bộ lọc." : "Chưa có tài khoản CMS."} getRowId={(user) => user.id} onRowClick={select} onSettingsOpenChange={setIsColumnSettingsOpen} rows={visibleRows} settingsOpen={isColumnSettingsOpen} showSettingsButton={false} tableId="cms-users" />
    </AdminCard>
    <AdminSidePanel footer={footer} isOpen={form !== null} onClose={closeEditor}>
      <header className="admin-list-manager__panel-header"><span className="admin-list-manager__panel-icon"><UserRound aria-hidden="true" size={18} /></span><div><p>{active ? "Chỉnh sửa tài khoản" : "Tạo tài khoản"}</p><h2>{active?.fullName || "Tài khoản CMS mới"}</h2><small className={dirty ? "admin-list-manager__dirty" : undefined}>{dirty ? "Có thay đổi chưa lưu." : active ? `@${active.username}` : "Điền thông tin để tạo tài khoản mới."}</small></div></header>
      {form ? <form className="admin-list-manager__form" id="cms-user-editor" onSubmit={save}>
        <fieldset disabled={busy}><div className="admin-list-manager__form-grid"><Field label="Tên đăng nhập"><input className="admin-input" minLength={3} onChange={(event) => setForm({ ...form, username: event.target.value })} pattern="[A-Za-z0-9._-]+" required value={form.username} /></Field><Field label="Họ và tên"><input className="admin-input" onChange={(event) => setForm({ ...form, fullName: event.target.value })} required value={form.fullName} /></Field></div><Field label="Email"><input className="admin-input" onChange={(event) => setForm({ ...form, email: event.target.value.trim() || null })} type="email" value={form.email ?? ""} /></Field><div className="admin-list-manager__form-grid"><Field label="Vai trò"><select className="admin-input" onChange={(event) => setForm({ ...form, role: event.target.value as CmsUserInput["role"] })} value={form.role}><option value="editor">Biên tập viên</option><option value="admin">Quản trị viên</option></select></Field><Field label="Trạng thái"><select className="admin-input" onChange={(event) => setForm({ ...form, status: event.target.value as CmsUserInput["status"] })} value={form.status}><option value="active">Đang hoạt động</option><option value="disabled">Đã khóa</option></select></Field></div><Field label={active ? "Mật khẩu mới — để trống nếu không đổi" : "Mật khẩu ban đầu"}><input autoComplete="new-password" className="admin-input" minLength={10} onChange={(event) => setForm({ ...form, password: event.target.value || null })} required={!active} type="password" value={form.password ?? ""} /></Field></fieldset>
        <AdminNotice tone="warning">Khóa tài khoản sẽ thu hồi phiên đăng nhập. Hệ thống luôn bảo vệ tài khoản đang đăng nhập và quản trị viên cuối cùng.</AdminNotice>
      </form> : <AdminEmptyState action={<AdminButton onClick={() => select()}>Tạo tài khoản</AdminButton>} description="Chọn một tài khoản trong danh sách để chỉnh sửa." icon={<UserRound aria-hidden="true" size={20} />} title="Chưa chọn tài khoản" />}
    </AdminSidePanel>
  </div>;
}

function UserSummary({ label, value }: { label: string; value: number }) {
  return <AdminCard className="admin-list-manager__summary-card"><p>{label}</p><strong>{value}</strong></AdminCard>;
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return <label className="admin-list-manager__field"><span>{label}</span>{children}</label>;
}
