"use client";

import { Edit3, Lock, Plus, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import type { CmsAction, CmsPermissionCode } from "@iorder/core/server/auth/permissions";
import { cmsRoleInputSchema, cmsRoleSaveResponseSchema, type CmsRole } from "@iorder/core/server/roles/roles.contract";

import { apiErrorMessage, requestAdminJson } from "@/lib/admin-api";
import { AdminButton } from "./ui/admin-button";
import { AdminCard } from "./ui/admin-card";
import { useAdminConfirm } from "./ui/admin-confirm-dialog";
import { AdminDataTable, type AdminDataTableColumn } from "./ui/admin-data-table";
import { AdminNotice, AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";
import { AdminListHeader } from "./ui/admin-list-header";
import { AdminListPage } from "./ui/admin-list-page";
import { useAdminPermissions } from "./ui/admin-permissions";
import { AdminSidePanel } from "./ui/admin-side-panel";
import { allState, moduleState, permissionCode, setModules, setPermission, type CheckState, type MatrixModule } from "./ui/role-permission-matrix";
import { useNavigationGuard } from "./ui/use-navigation-guard";

type RoleForm = { name: string; description: string; permissions: string[] };
type RolesManagerProps = { roles: CmsRole[]; modules: MatrixModule[]; actionLabels: Record<CmsAction, string> };

const blank: RoleForm = { name: "", description: "", permissions: [] };

function valuesOf(role: CmsRole): RoleForm {
  return { name: role.name, description: role.description ?? "", permissions: [...role.permissions].sort() };
}

export function RolesManager({ roles, modules, actionLabels }: RolesManagerProps) {
  const router = useRouter();
  const { show: showToast } = useAdminToast();
  const { confirm } = useAdminConfirm();
  const { can } = useAdminPermissions();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [form, setForm] = useState<RoleForm | null>(null);
  const [initialValues, setInitialValues] = useState<RoleForm | null>(null);
  const [busy, setBusy] = useState(false);
  const mutationPending = useRef(false);
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  const active = roles.find((role) => role.id === activeId);
  const readOnly = Boolean(active?.isSystem) || !can(active ? "roles.update" : "roles.create");
  const dirty = JSON.stringify(form) !== JSON.stringify(initialValues);
  const canGrant = (code: string) => !readOnly && can(code as CmsPermissionCode);
  useNavigationGuard(dirty || busy);

  function allowSelectionChange() {
    if (mutationPending.current) {
      showToast("Đang xử lý vai trò. Vui lòng chờ trước khi đóng hoặc chuyển mục.", "info");
      return false;
    }
    if (!dirty) return true;
    showToast("Bạn có thay đổi chưa lưu. Hãy lưu hoặc bỏ thay đổi trước khi chuyển mục.", "warning");
    return false;
  }

  function select(role?: CmsRole) {
    if (!allowSelectionChange()) return;
    const values = role ? valuesOf(role) : { ...blank };
    setActiveId(role?.id ?? null);
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
    if (!form || !dirty || readOnly || mutationPending.current) return;
    const parsed = cmsRoleInputSchema.safeParse({ ...form, description: form.description });
    if (!parsed.success) {
      showToast("Tên vai trò cần từ 2 đến 120 ký tự.", "error");
      return;
    }
    mutationPending.current = true;
    setBusy(true);
    try {
      const payload = cmsRoleSaveResponseSchema.safeParse(await requestAdminJson("/api/admin/roles", "POST", { id: activeId, values: parsed.data }, "Không thể lưu vai trò."));
      if (!payload.success) throw new Error("Phản hồi lưu vai trò không hợp lệ. Vui lòng tải lại để kiểm tra.");
      const saved = { name: parsed.data.name, description: parsed.data.description ?? "", permissions: parsed.data.permissions };
      setActiveId(payload.data.id);
      setForm(saved);
      setInitialValues(saved);
      showToast(active ? "Đã lưu vai trò." : "Đã tạo vai trò.", "success");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      mutationPending.current = false;
      setBusy(false);
    }
  }

  async function removeCurrent() {
    if (!active || mutationPending.current) return;
    if (!await confirm({ title: "Xác nhận xóa vai trò", message: `Xóa vai trò “${active.name}”? Thao tác không thể hoàn tác.`, confirmLabel: "Xóa", tone: "danger" })) return;
    mutationPending.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/roles", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: active.id }) });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiErrorMessage(payload, "Không thể xóa vai trò."));
      setActiveId(null);
      setForm(null);
      setInitialValues(null);
      showToast("Đã xóa vai trò.", "success");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      mutationPending.current = false;
      setBusy(false);
    }
  }

  const columns: AdminDataTableColumn<CmsRole>[] = [
    { id: "name", label: "Vai trò", defaultWidth: 280, minWidth: 200, cell: (role) => <button className="admin-list-manager__identity" onClick={(event) => { event.stopPropagation(); select(role); }} type="button"><strong>{role.name}</strong><small>{role.description || "Chưa có mô tả"}</small></button> },
    { id: "permissions", label: "Quyền", defaultWidth: 120, minWidth: 100, cell: (role) => <span>{role.isSystem ? "Toàn quyền" : `${role.permissions.length} quyền`}</span> },
    { id: "users", label: "Tài khoản", defaultWidth: 120, minWidth: 100, cell: (role) => <span>{role.userCount}</span> },
    { id: "type", label: "Loại", defaultWidth: 130, minWidth: 110, cell: (role) => <AdminStatusBadge tone={role.isSystem ? "info" : "neutral"}>{role.isSystem ? "Hệ thống" : "Tùy chỉnh"}</AdminStatusBadge> },
    { id: "actions", label: "Thao tác", defaultWidth: 116, minWidth: 104, align: "right", cell: (role) => <button aria-label={`Mở ${role.name}`} className="admin-list-manager__row-action" onClick={(event) => { event.stopPropagation(); select(role); }} type="button">{role.isSystem ? <Lock aria-hidden="true" size={15} /> : <Edit3 aria-hidden="true" size={15} />}{role.isSystem ? "Xem" : "Sửa"}</button> },
  ];

  const canDelete = Boolean(active && !active.isSystem && can("roles.delete"));
  const footer = form ? <>
    <span className="admin-list-manager__footer-start">{canDelete ? <AdminButton disabled={busy || active!.userCount > 0} onClick={removeCurrent} title={active!.userCount > 0 ? "Chuyển các tài khoản sang vai trò khác trước khi xóa." : undefined} variant="danger">Xóa</AdminButton> : null}</span>
    {readOnly ? null : <span className="flex gap-2">{dirty ? <AdminButton disabled={busy} onClick={discardChanges} variant="secondary"><RotateCcw aria-hidden="true" size={16} />Bỏ thay đổi</AdminButton> : null}<AdminButton disabled={busy || !dirty} form="role-editor" type="submit"><Save aria-hidden="true" size={16} />{busy ? "Đang lưu…" : "Lưu vai trò"}</AdminButton></span>}
  </> : null;

  return <AdminListPage className="admin-list-manager" variant="dense">
    <AdminCard className="admin-list-manager__card">
      <AdminListHeader actions={can("roles.create") ? <AdminButton leadingIcon={<Plus aria-hidden="true" size={16} />} onClick={() => select()}>Tạo vai trò</AdminButton> : null} description={`${roles.length} vai trò`} title="Vai trò & quyền" />
      <AdminDataTable columns={columns} emptyMessage="Chưa có vai trò." getRowId={(role) => role.id} onRowClick={select} onSettingsOpenChange={setIsColumnSettingsOpen} rows={roles} settingsOpen={isColumnSettingsOpen} tableId="cms-roles" />
    </AdminCard>
    <AdminSidePanel footer={footer} isOpen={form !== null} label="Trình chỉnh sửa vai trò" onClose={closeEditor}>
      <header className="admin-list-manager__panel-header"><span className="admin-list-manager__panel-icon"><ShieldCheck aria-hidden="true" size={18} /></span><div><p>{active ? (readOnly ? "Xem vai trò" : "Chỉnh sửa vai trò") : "Tạo vai trò"}</p><h2>{form?.name || "Vai trò mới"}</h2></div></header>
      {form ? <form className="admin-list-manager__form" id="role-editor" onSubmit={save}>
        {active?.isSystem ? <AdminNotice tone="info">Super Admin luôn có toàn quyền và được bảo vệ: không thể sửa, xóa hoặc gỡ khỏi Super Admin cuối cùng.</AdminNotice> : null}
        {!active?.isSystem && !can("roles.delete") && !readOnly ? <AdminNotice tone="info">Bạn chỉ cấp được những quyền mà chính bạn đang có.</AdminNotice> : null}
        <fieldset disabled={busy}>
          <Field label="Tên vai trò"><input className="admin-input" maxLength={120} minLength={2} onChange={(event) => setForm({ ...form, name: event.target.value })} readOnly={readOnly} required value={form.name} /></Field>
          <Field label="Mô tả"><textarea className="admin-input" maxLength={500} onChange={(event) => setForm({ ...form, description: event.target.value })} readOnly={readOnly} rows={2} value={form.description} /></Field>
          <PermissionMatrix actionLabels={actionLabels} canGrant={canGrant} modules={modules} onChange={(next) => setForm({ ...form, permissions: [...next].sort() })} selected={new Set(active?.isSystem ? modules.flatMap((module) => module.actions.map((action) => permissionCode(module, action))) : form.permissions)} />
        </fieldset>
      </form> : null}
    </AdminSidePanel>
  </AdminListPage>;
}

function PermissionMatrix({ actionLabels, canGrant, modules, onChange, selected }: { actionLabels: Record<CmsAction, string>; canGrant: (code: string) => boolean; modules: MatrixModule[]; onChange: (next: Set<string>) => void; selected: ReadonlySet<string> }) {
  const actions = Object.keys(actionLabels) as CmsAction[];
  const everyGrantable = modules.some((module) => module.actions.some((action) => canGrant(permissionCode(module, action))));
  return <div className="admin-role-matrix">
    <table>
      <caption className="sr-only">Quyền theo module</caption>
      <thead><tr>
        <th scope="col"><label className="admin-role-matrix__group"><TriStateCheckbox disabled={!everyGrantable} label="Chọn tất cả quyền" onChange={(checked) => onChange(setModules(selected, modules, checked, canGrant))} state={allState(selected, modules, canGrant)} />Module</label></th>
        {actions.map((action) => <th key={action} scope="col">{actionLabels[action]}</th>)}
      </tr></thead>
      <tbody>{modules.map((module) => {
        const grantable = module.actions.some((action) => canGrant(permissionCode(module, action)));
        return <tr key={module.key}>
          <th scope="row"><label className="admin-role-matrix__group"><TriStateCheckbox disabled={!grantable} label={`Chọn tất cả quyền của ${module.name}`} onChange={(checked) => onChange(setModules(selected, [module], checked, canGrant))} state={grantable ? moduleState(selected, module, canGrant) : moduleState(selected, module)} />{module.name}</label></th>
          {actions.map((action) => <td key={action}>{module.actions.includes(action)
            ? <input aria-label={`${actionLabels[action]} — ${module.name}`} checked={selected.has(permissionCode(module, action))} disabled={!canGrant(permissionCode(module, action))} onChange={(event) => onChange(setPermission(selected, module, action, event.target.checked, canGrant))} type="checkbox" />
            : <span aria-hidden="true" className="admin-role-matrix__na">—</span>}</td>)}
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

// Native checkbox with the indeterminate state React cannot set declaratively.
function TriStateCheckbox({ disabled, label, onChange, state }: { disabled?: boolean; label: string; onChange: (checked: boolean) => void; state: CheckState }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = state === "some"; }, [state]);
  return <input aria-checked={state === "some" ? "mixed" : state === "all"} aria-label={label} checked={state === "all"} disabled={disabled} onChange={(event) => onChange(event.target.checked)} ref={ref} type="checkbox" />;
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return <label className="admin-list-manager__field"><span>{label}</span>{children}</label>;
}
