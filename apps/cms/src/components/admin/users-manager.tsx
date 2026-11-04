"use client";

import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { Plus, RotateCcw, Save, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";

import type { CmsUserInput, CmsUserListQuery } from "@iorder/core/server/users/users.contract";
import type { AdminListPage as ListPageResult } from "@iorder/core/server/shared/admin-list.contract";
import { cmsUserRequestSchema, cmsUserSaveResponseSchema } from "@iorder/core/server/users/users.contract";
import type { CmsUserRoleOption } from "@iorder/core/server/users/users.contract";

import { accessSource, formatAccessTime, UserAccessSummary, type UserAccess } from "./user-access-summary";
import { UserRowActions } from "./user-row-actions";
import { auditActionLabel } from "./ui/audit-labels";
import { AdminButton } from "./ui/admin-button";
import { AdminPasswordInput } from "./ui/admin-password-input";
import { AdminCard } from "./ui/admin-card";
import { AdminDataTable, type AdminDataTableColumn } from "./ui/admin-data-table";
import { AdminEmptyState } from "./ui/admin-empty-state";
import { AdminNotice, AdminStatusBadge, useAdminToast, type AdminFeedbackTone } from "./ui/admin-feedback";
import { AdminFilterBar, type AdminFilterChip } from "./ui/admin-filter-bar";
import { AdminListHeader } from "./ui/admin-list-header";
import { AdminListPage } from "./ui/admin-list-page";
import { AdminSearchField } from "./ui/admin-search-field";
import { AdminSidePanel } from "./ui/admin-side-panel";
import { AdminPagination } from "./ui/admin-pagination";
import { useNavigationGuard } from "./ui/use-navigation-guard";

type CmsUser = Omit<CmsUserInput, "password"> & UserAccess;
const noAccess: Omit<UserAccess, "id"> = { lastLoginAt: null, lastLoginIp: null, lastLoginUserAgent: null, lastAction: null, lastActionAt: null, activeSessions: 0 };
type UserStatusFilter = "all" | CmsUser["status"];

const blank: CmsUserInput = { username: "", email: null, fullName: "", status: "active", role: "editor", password: null };
const statusLabel: Record<CmsUser["status"], string> = { active: "Hoạt động", disabled: "Đã khóa" };
const statusTone: Record<CmsUser["status"], AdminFeedbackTone> = { active: "success", disabled: "neutral" };
function roleLabel(roles: CmsUserRoleOption[], role: CmsUser["role"]) {
  return roles.find((item) => item.code === role)?.name ?? role;
}

function valuesOf(user: CmsUser): CmsUserInput {
  return { username: user.username, email: user.email, fullName: user.fullName, status: user.status, role: user.role, password: null };
}

function dateLabel(value: Date | null) {
  if (!value) return "Chưa đăng nhập";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function UsersManager({ canAssignSuperAdmin, currentUserId, initialPage, initialQuery, roles, tabs }: { tabs?: ReactNode; currentUserId: string; canAssignSuperAdmin: boolean; initialPage: ListPageResult<CmsUser> & { counts: { all: number; active: number; admins: number } }; initialQuery: CmsUserListQuery; roles: CmsUserRoleOption[] }) {
  const assignableRoles = roles.filter((role) => canAssignSuperAdmin || !role.isSystem);
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
  const chips: AdminFilterChip[] = [
    ...(initialQuery.query ? [{ key: "query", label: `Từ khóa: “${initialQuery.query}”`, onRemove: () => { setQuery(""); navigate({ page: 1, query: "" }); } }] : []),
    ...(statusFilter !== "all" ? [{ key: "status", label: `Trạng thái: ${statusFilter === "active" ? "Đang hoạt động" : "Đã khóa"}`, onRemove: () => navigate({ page: 1, status: "all" }) }] : []),
    ...(initialQuery.role !== "all" ? [{ key: "role", label: `Vai trò: ${roleLabel(roles, initialQuery.role)}`, onRemove: () => navigate({ page: 1, role: "all" }) }] : []),
  ];
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initialValues);
  useNavigationGuard(dirty || busy, busy ? () => showToast("Đang lưu tài khoản. Vui lòng chờ trước khi rời trang.", "info") : undefined);

  const visibleRows = rows;
  function navigate(patch: Partial<CmsUserListQuery>) {
    if (!allowSelectionChange()) return;
    const next = { ...initialQuery, ...patch };
    const params = new URLSearchParams(Object.entries(next).filter(([, value]) => value !== undefined && value !== "").map(([key, value]) => [key, String(value)]));
    startTransition(() => router.push(`/admin/users?${params}`, { scroll: false }));
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
    const values = user ? valuesOf(user) : { ...blank, role: assignableRoles.find((role) => !role.isSystem)?.code ?? blank.role };
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
      const body = await readAdminJson(response);
      if (!response.ok) throw adminApiError(body, "Không thể lưu tài khoản.");
      const responseData = cmsUserSaveResponseSchema.safeParse(body);
      if (!responseData.success || (activeId && responseData.data.id !== activeId)) throw new Error("Phản hồi lưu tài khoản không hợp lệ. Hãy kiểm tra danh sách trước khi thử lại.");
      const values = { ...parsed.data.values, password: null };
      const saved: CmsUser = { id: responseData.data.id, username: values.username, email: values.email, fullName: values.fullName, status: values.status, role: values.role, ...noAccess, ...(active ? { lastLoginAt: active.lastLoginAt, lastLoginIp: active.lastLoginIp, lastLoginUserAgent: active.lastLoginUserAgent, lastAction: active.lastAction, lastActionAt: active.lastActionAt, activeSessions: active.activeSessions } : {}) };
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
    { id: "user", label: "Người dùng", defaultWidth: 220, minWidth: 180, sortKey: "fullName", cell: (user) => <button className="admin-list-manager__identity" onClick={(event) => { event.stopPropagation(); select(user); }} type="button"><strong>{user.fullName}</strong><small>@{user.username}{user.email ? ` · ${user.email}` : ""}</small></button> },
    { id: "role", label: "Vai trò", defaultWidth: 160, minWidth: 130, sortKey: "role", cell: (user) => <span>{roleLabel(roles, user.role)}</span> },
    { id: "status", label: "Trạng thái", defaultWidth: 125, minWidth: 115, sortKey: "status", cell: (user) => <AdminStatusBadge tone={statusTone[user.status]}>{statusLabel[user.status]}</AdminStatusBadge> },
    { id: "lastLogin", label: "Đăng nhập gần nhất", defaultWidth: 220, minWidth: 170, sortKey: "lastLoginAt", sortFirst: "desc", cell: (user) => <span className="admin-cell-stack"><span>{dateLabel(user.lastLoginAt)}</span>{user.lastLoginAt && accessSource(user.lastLoginIp, user.lastLoginUserAgent) ? <small title={user.lastLoginUserAgent ?? undefined}>{accessSource(user.lastLoginIp, user.lastLoginUserAgent)}</small> : null}</span> },
    { id: "lastAction", label: "Thao tác gần nhất", defaultWidth: 180, minWidth: 150, cell: (user) => user.lastAction ? <span className="admin-cell-stack"><span>{auditActionLabel(user.lastAction)}</span><small>{formatAccessTime(user.lastActionAt)}</small></span> : <span className="admin-list-manager__muted">Chưa có</span> },
    { id: "sessions", label: "Phiên", defaultWidth: 100, minWidth: 90, align: "right", cell: (user) => <span className={user.activeSessions ? undefined : "admin-list-manager__muted"} title="Số phiên đăng nhập còn hiệu lực (thiết bị đang đăng nhập)">{user.activeSessions ? `${user.activeSessions} thiết bị` : "—"}</span> },
    { id: "actions", label: "Thao tác", defaultWidth: 116, minWidth: 116, align: "right", cell: (user) => <UserRowActions isSelf={user.id === currentUserId} user={user} /> },
  ];

  const activeCount = initialPage.counts.active;
  const adminCount = initialPage.counts.admins;
  const footer = form ? <>{dirty ? <span className="admin-list-manager__footer-start"><AdminButton disabled={busy} onClick={discardChanges} variant="secondary"><RotateCcw aria-hidden="true" size={16} />Bỏ thay đổi</AdminButton></span> : null}<AdminButton disabled={busy || !dirty} form="cms-user-editor" permission={active ? "users.update" : "users.create"} type="submit"><Save aria-hidden="true" size={16} />{busy ? "Đang lưu…" : "Lưu"}</AdminButton></> : null;

  return <AdminListPage className="admin-list-manager" variant="dense">
    <AdminCard className="admin-list-manager__card">
      <AdminListHeader actions={<><AdminButton hideWithoutPermission permission="users.create" leadingIcon={<Plus aria-hidden="true" size={16} />} onClick={() => select()}>Tạo tài khoản</AdminButton></>} description={loading ? "Đang tải danh sách…" : `${initialPage.counts.all} tài khoản · ${activeCount} đang hoạt động · ${adminCount} quản trị viên`} headingLevel={1} title="Người dùng CMS" />
      {tabs}
      <AdminFilterBar onSubmit={(event) => { event.preventDefault(); navigate({ page: 1, query: query.trim() }); }} chips={chips} onClearAll={() => { setQuery(""); navigate({ page: 1, query: "", status: "all", role: "all" }); }} search={<AdminSearchField disabled={busy || loading} id="cms-user-search" label="Tìm người dùng" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm họ tên, tên đăng nhập hoặc email" value={query} />}><select aria-label="Lọc trạng thái" disabled={busy || loading} id="cms-user-status" onChange={(event) => navigate({ page: 1, status: event.target.value as UserStatusFilter })} value={statusFilter}><option value="all">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="disabled">Đã khóa</option></select><select aria-label="Lọc vai trò" disabled={busy || loading} className="admin-input" id="cms-user-role" value={initialQuery.role} onChange={event => navigate({ page: 1, role: event.target.value as CmsUserListQuery["role"] })}><option value="all">Tất cả vai trò</option>{roles.map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}</select></AdminFilterBar>
      <AdminDataTable columns={columns} emptyMessage={initialPage.counts.all ? "Không có người dùng phù hợp với bộ lọc." : "Chưa có tài khoản CMS."} getRowId={(user) => user.id} onRowClick={select} onSettingsOpenChange={setIsColumnSettingsOpen} onSortChange={(next) => navigate({ page: 1, sort: next?.key, dir: next?.dir })} rows={visibleRows} settingsOpen={isColumnSettingsOpen} sort={initialQuery.sort ? { key: initialQuery.sort, dir: initialQuery.dir ?? "desc" } : null} tableId="cms-users" />
      <AdminPagination unit="tài khoản" disabled={busy || loading} label="Phân trang người dùng" onChange={(page) => navigate({ page })} onPageSizeChange={(pageSize) => navigate({ page: 1, pageSize })} page={initialPage.page} pageSize={initialPage.pageSize} total={initialPage.total} totalPages={initialPage.totalPages} />
    </AdminCard>
    <AdminSidePanel footer={footer} isOpen={form !== null} onClose={closeEditor}>
      <header className="admin-list-manager__panel-header"><span className="admin-list-manager__panel-icon"><UserRound aria-hidden="true" size={18} /></span><div><p>{active ? "Chỉnh sửa tài khoản" : "Tạo tài khoản"}</p><h2>{active?.fullName || "Tài khoản CMS mới"}</h2><small className={dirty ? "admin-list-manager__dirty" : undefined}>{dirty ? "Có thay đổi chưa lưu." : active ? `@${active.username}` : "Điền thông tin để tạo tài khoản mới."}</small></div></header>
      {form ? <form className="admin-list-manager__form" id="cms-user-editor" onSubmit={save}>
        <fieldset disabled={busy}><div className="admin-list-manager__form-grid"><Field label="Tên đăng nhập"><input className="admin-input" minLength={3} onChange={(event) => setForm({ ...form, username: event.target.value })} pattern="[A-Za-z0-9._-]+" required value={form.username} /></Field><Field label="Họ và tên"><input className="admin-input" onChange={(event) => setForm({ ...form, fullName: event.target.value })} required value={form.fullName} /></Field></div><Field label="Email"><input className="admin-input" onChange={(event) => setForm({ ...form, email: event.target.value || null })} type="email" value={form.email ?? ""} /></Field><div className="admin-list-manager__form-grid"><Field label="Vai trò"><select className="admin-input" onChange={(event) => setForm({ ...form, role: event.target.value as CmsUserInput["role"] })} value={form.role}>{assignableRoles.filter((role) => role.code !== form.role).concat(roles.filter((role) => role.code === form.role)).map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}</select></Field><Field label="Trạng thái"><select className="admin-input" onChange={(event) => setForm({ ...form, status: event.target.value as CmsUserInput["status"] })} value={form.status}><option value="active">Đang hoạt động</option><option value="disabled">Đã khóa</option></select></Field></div><div className="admin-list-manager__field"><label htmlFor="cms-user-password">{active ? "Mật khẩu mới — để trống nếu không đổi" : "Mật khẩu ban đầu"}</label><AdminPasswordInput autoComplete="new-password" id="cms-user-password" minLength={10} onChange={(event) => setForm({ ...form, password: event.target.value || null })} required={!active} value={form.password ?? ""} /></div></fieldset>
        <AdminNotice tone="warning">Khóa tài khoản sẽ thu hồi phiên đăng nhập. Hệ thống luôn bảo vệ tài khoản đang đăng nhập và quản trị viên cuối cùng.</AdminNotice>
      </form> : <AdminEmptyState action={<AdminButton hideWithoutPermission permission="users.create" onClick={() => select()}>Tạo tài khoản</AdminButton>} description="Chọn một tài khoản trong danh sách để chỉnh sửa." icon={<UserRound aria-hidden="true" size={20} />} title="Chưa chọn tài khoản" />}
      {active ? <UserAccessSummary user={active} /> : null}
    </AdminSidePanel>
  </AdminListPage>;
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return <label className="admin-list-manager__field"><span>{label}</span>{children}</label>;
}
