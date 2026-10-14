"use client";

import { Edit3, Plus, RotateCcw, Save, Settings2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";

import type { CmsUserInput, CmsUserListQuery } from "@iorder/core/server/users/users.contract";
import type { AdminListPage as ListPageResult } from "@iorder/core/server/shared/admin-list.contract";
import { cmsUserRequestSchema, cmsUserSaveResponseSchema } from "@iorder/core/server/users/users.contract";
import { cmsRoles } from "@iorder/core/server/auth/permissions";

import { AdminButton } from "./ui/admin-button";
import { AdminCard } from "./ui/admin-card";
import { AdminDataTable, type AdminDataTableColumn } from "./ui/admin-data-table";
import { AdminEmptyState } from "./ui/admin-empty-state";
import { AdminNotice, AdminStatusBadge, useAdminToast, type AdminFeedbackTone } from "./ui/admin-feedback";
import { AdminFilterBar } from "./ui/admin-filter-bar";
import { AdminListHeader } from "./ui/admin-list-header";
import { AdminListPage } from "./ui/admin-list-page";
import { AdminMetricGrid } from "./ui/admin-metric-grid";
import { AdminSidePanel } from "./ui/admin-side-panel";
import { pageSizeOptions } from "./ui/page-size-options";
import { useNavigationGuard } from "./ui/use-navigation-guard";

type CmsUser = Omit<CmsUserInput, "password"> & { id: string; lastLoginAt: Date | null };
type UserStatusFilter = "all" | CmsUser["status"];

const blank: CmsUserInput = { username: "", email: null, fullName: "", status: "active", role: "editor", password: null };
const statusLabel: Record<CmsUser["status"], string> = { active: "Hoạt động", disabled: "Đã khóa" };
const statusTone: Record<CmsUser["status"], AdminFeedbackTone> = { active: "success", disabled: "neutral" };
function roleLabel(role: CmsUser["role"]) {
  return cmsRoles.find((item) => item.code === role)?.name ?? role;
}

function valuesOf(user: CmsUser): CmsUserInput {
  return { username: user.username, email: user.email, fullName: user.fullName, status: user.status, role: user.role, password: null };
}

function dateLabel(value: Date | null) {
  if (!value) return "Chưa đăng nhập";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function UsersManager({ initialPage, initialQuery }: { initialPage: ListPageResult<CmsUser> & { counts: { all: number; active: number; admins: number } }; initialQuery: CmsUserListQuery }) {
  const router = useRouter();
  const { show: showToast } = useAdminToast();
  const rows = initialPage.items;
  const [active, setActive] = useState<CmsUser | null>(null);
  const [loading, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [form, setForm] = useState<CmsUserInput | null>(null);
  const [initialValues, setInitialValues] = useState<CmsUserInput | null>(null);
  const [busy, setBusy] = useState(false);
  const mutationPending = useRef(false);
  const [query, setQuery] = useState(initialQuery.query);
  const statusFilter = initialQuery.status;
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initialValues);
  useNavigationGuard(dirty || busy, busy ? () => showToast("Đang lưu tài khoản. Vui lòng chờ trước khi rời trang.", "info") : undefined);

  const visibleRows = rows;
  function navigate(patch: Partial<CmsUserListQuery>) {
    if (!allowSelectionChange()) return;
    const next = { ...initialQuery, ...patch };
    const params = new URLSearchParams(Object.entries(next).map(([key, value]) => [key, String(value)]));
    startTransition(() => router.push(`/admin/tai-khoan?${params}`, { scroll: false }));
  }

  function allowSelectionChange() {
    if (mutationPending.current || loading) {
      showToast("Đang lưu tài khoản. Vui lòng chờ trước khi đóng hoặc chuyển tài khoản.", "info");
      return false;
    }
    if (!dirty) return true;
    showToast("Bạn có thay đổi chưa lưu. Hãy lưu hoặc bỏ thay đổi trước khi chuyển tài khoản.", "warning");
    return false;
  }

  function select(user?: CmsUser) {
    if (!allowSelectionChange()) return;
    const values = user ? valuesOf(user) : { ...blank };
    setActiveId(user?.id ?? null);
    setActive(user ?? null);
    setForm(values);
    setInitialValues(values);
  }

  function closeEditor() {
    if (!allowSelectionChange()) return;
    setActiveId(null);
    setActive(null);
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
    const parsed = cmsUserRequestSchema.safeParse({ id: activeId, values: form });
    if (!parsed.success) {
      showToast("Kiểm tra tên đăng nhập, họ tên, email, vai trò và mật khẩu trước khi lưu.", "error");
      return;
    }
    mutationPending.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể lưu tài khoản.");
      const responseData = cmsUserSaveResponseSchema.safeParse(body);
      if (!responseData.success || (activeId && responseData.data.id !== activeId)) throw new Error("Phản hồi lưu tài khoản không hợp lệ. Hãy kiểm tra danh sách trước khi thử lại.");
      const values = { ...parsed.data.values, password: null };
      const saved: CmsUser = { id: responseData.data.id, username: values.username, email: values.email, fullName: values.fullName, status: values.status, role: values.role, lastLoginAt: active?.lastLoginAt ?? null };
      setActive(saved);
      setActiveId(saved.id);
      setForm(values);
      setInitialValues(values);
      showToast(active ? "Đã lưu tài khoản CMS." : "Đã tạo tài khoản CMS.", "success");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      mutationPending.current = false;
      setBusy(false);
    }
  }

  const columns: AdminDataTableColumn<CmsUser>[] = [
    { id: "user", label: "Người dùng", defaultWidth: 270, minWidth: 200, cell: (user) => <button className="admin-list-manager__identity" onClick={(event) => { event.stopPropagation(); select(user); }} type="button"><strong>{user.fullName}</strong><small>@{user.username}{user.email ? ` · ${user.email}` : ""}</small></button> },
    { id: "role", label: "Vai trò", defaultWidth: 190, minWidth: 160, cell: (user) => <span>{roleLabel(user.role)}</span> },
    { id: "status", label: "Trạng thái", defaultWidth: 145, minWidth: 128, cell: (user) => <AdminStatusBadge tone={statusTone[user.status]}>{statusLabel[user.status]}</AdminStatusBadge> },
    { id: "lastLogin", label: "Đăng nhập gần nhất", defaultWidth: 200, minWidth: 165, cell: (user) => <span className="admin-list-manager__muted">{dateLabel(user.lastLoginAt)}</span> },
    { id: "actions", label: "Thao tác", defaultWidth: 126, minWidth: 116, align: "right", cell: (user) => <button aria-label={`Chỉnh sửa ${user.fullName}`} className="admin-list-manager__row-action" onClick={(event) => { event.stopPropagation(); select(user); }} type="button"><Edit3 aria-hidden="true" size={15} />Sửa</button> },
  ];

  const activeCount = initialPage.counts.active;
  const adminCount = initialPage.counts.admins;
  const footer = form ? <>{dirty ? <span className="admin-list-manager__footer-start"><AdminButton disabled={busy} onClick={discardChanges} variant="secondary"><RotateCcw aria-hidden="true" size={16} />Bỏ thay đổi</AdminButton></span> : null}<AdminButton disabled={busy || !dirty} form="cms-user-editor" type="submit"><Save aria-hidden="true" size={16} />{busy ? "Đang lưu…" : "Lưu"}</AdminButton></> : null;

  return <AdminListPage className="admin-list-manager" variant="dense">
    <AdminMetricGrid items={[{ label: "Tổng tài khoản", value: initialPage.counts.all }, { label: "Đang hoạt động", tone: "green", value: activeCount }, { label: "Quản trị viên", tone: "blue", value: adminCount }]} />
    <AdminCard className="admin-list-manager__card">
      <AdminListHeader actions={<><AdminButton onClick={() => setIsColumnSettingsOpen(true)} variant="secondary"><Settings2 aria-hidden="true" size={16} />Cài đặt cột</AdminButton><AdminButton leadingIcon={<Plus aria-hidden="true" size={16} />} onClick={() => select()}>Tạo tài khoản</AdminButton></>} description="Quản lý quyền và trạng thái truy cập từ danh sách này." headingLevel={1} title="Người dùng CMS" />
      <AdminFilterBar onSubmit={(event) => { event.preventDefault(); navigate({ page: 1, query: query.trim() }); }}><div><label className="sr-only" htmlFor="cms-user-search">Tìm người dùng</label><input disabled={busy || loading} className="admin-input" id="cms-user-search" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm họ tên, tên đăng nhập hoặc email…" value={query} /></div><div><label className="sr-only" htmlFor="cms-user-status">Lọc trạng thái</label><select disabled={busy || loading} className="admin-input" id="cms-user-status" onChange={(event) => navigate({ page: 1, status: event.target.value as UserStatusFilter })} value={statusFilter}><option value="all">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="disabled">Đã khóa</option></select></div><label className="sr-only" htmlFor="cms-user-role">Lọc vai trò</label><select disabled={busy || loading} className="admin-input" id="cms-user-role" value={initialQuery.role} onChange={event => navigate({ page: 1, role: event.target.value as CmsUserListQuery["role"] })}><option value="all">Tất cả vai trò</option>{cmsRoles.map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}</select><AdminButton disabled={busy || loading} type="submit">Tìm kiếm</AdminButton></AdminFilterBar>
      <p aria-live="polite" className="p-4 text-sm text-[var(--cms-muted)]">{loading ? "Đang tải danh sách…" : `${initialPage.total} kết quả · Trang ${initialPage.page}/${initialPage.totalPages}`}</p>
      <AdminDataTable columns={columns} emptyMessage={initialPage.counts.all ? "Không có người dùng phù hợp với bộ lọc." : "Chưa có tài khoản CMS."} getRowId={(user) => user.id} onRowClick={select} onSettingsOpenChange={setIsColumnSettingsOpen} rows={visibleRows} settingsOpen={isColumnSettingsOpen} showSettingsButton={false} tableId="cms-users" />
      <div className="flex flex-wrap items-center justify-between gap-3 p-4"><label className="flex items-center gap-2 text-sm">Số mục mỗi trang<select disabled={busy || loading} value={initialPage.pageSize} onChange={event => navigate({ page: 1, pageSize: Number(event.target.value) })}>{pageSizeOptions(initialPage.pageSize).map(size => <option key={size} value={size}>{size}</option>)}</select></label><div className="flex gap-2"><AdminButton variant="secondary" disabled={busy || loading || initialPage.page <= 1} onClick={() => navigate({ page: initialPage.page - 1 })}>Trang trước</AdminButton><AdminButton variant="secondary" disabled={busy || loading || initialPage.page >= initialPage.totalPages} onClick={() => navigate({ page: initialPage.page + 1 })}>Trang sau</AdminButton></div></div>
    </AdminCard>
    <AdminSidePanel footer={footer} isOpen={form !== null} onClose={closeEditor}>
      <header className="admin-list-manager__panel-header"><span className="admin-list-manager__panel-icon"><UserRound aria-hidden="true" size={18} /></span><div><p>{active ? "Chỉnh sửa tài khoản" : "Tạo tài khoản"}</p><h2>{active?.fullName || "Tài khoản CMS mới"}</h2><small className={dirty ? "admin-list-manager__dirty" : undefined}>{dirty ? "Có thay đổi chưa lưu." : active ? `@${active.username}` : "Điền thông tin để tạo tài khoản mới."}</small></div></header>
      {form ? <form className="admin-list-manager__form" id="cms-user-editor" onSubmit={save}>
        <fieldset disabled={busy}><div className="admin-list-manager__form-grid"><Field label="Tên đăng nhập"><input className="admin-input" minLength={3} onChange={(event) => setForm({ ...form, username: event.target.value })} pattern="[A-Za-z0-9._-]+" required value={form.username} /></Field><Field label="Họ và tên"><input className="admin-input" onChange={(event) => setForm({ ...form, fullName: event.target.value })} required value={form.fullName} /></Field></div><Field label="Email"><input className="admin-input" onChange={(event) => setForm({ ...form, email: event.target.value || null })} type="email" value={form.email ?? ""} /></Field><div className="admin-list-manager__form-grid"><Field label="Vai trò"><select className="admin-input" onChange={(event) => setForm({ ...form, role: event.target.value as CmsUserInput["role"] })} value={form.role}>{cmsRoles.map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}</select></Field><Field label="Trạng thái"><select className="admin-input" onChange={(event) => setForm({ ...form, status: event.target.value as CmsUserInput["status"] })} value={form.status}><option value="active">Đang hoạt động</option><option value="disabled">Đã khóa</option></select></Field></div><Field label={active ? "Mật khẩu mới — để trống nếu không đổi" : "Mật khẩu ban đầu"}><input autoComplete="new-password" className="admin-input" minLength={10} onChange={(event) => setForm({ ...form, password: event.target.value || null })} required={!active} type="password" value={form.password ?? ""} /></Field></fieldset>
        <AdminNotice tone="warning">Khóa tài khoản sẽ thu hồi phiên đăng nhập. Hệ thống luôn bảo vệ tài khoản đang đăng nhập và quản trị viên cuối cùng.</AdminNotice>
      </form> : <AdminEmptyState action={<AdminButton onClick={() => select()}>Tạo tài khoản</AdminButton>} description="Chọn một tài khoản trong danh sách để chỉnh sửa." icon={<UserRound aria-hidden="true" size={20} />} title="Chưa chọn tài khoản" />}
    </AdminSidePanel>
  </AdminListPage>;
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return <label className="admin-list-manager__field"><span>{label}</span>{children}</label>;
}
