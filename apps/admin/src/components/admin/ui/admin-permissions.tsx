"use client";

import React, { createContext, useContext, useMemo, type ReactNode } from "react";

import { hasAnyCmsPermission, hasCmsPermission, type CmsActor, type CmsPermissionCode } from "@iorder/shared/server/auth/permissions";

// Đường dẫn tương đối (không dùng "@/"): bài kiểm thử chạy từ thư mục gốc, nơi bí danh "@/" chưa được khai báo.
import { canOpenAdminPath } from "../admin-navigation";

// `canOpenPath`: mở được trang quản trị đó không (cùng quy tắc với thanh bên, gồm cả mục chỉ Super Admin). Dùng để ẩn lối tắt dẫn tới trang bị chặn.
type AdminPermissions = { can: (permission: CmsPermissionCode) => boolean; canAny: (permissions: readonly CmsPermissionCode[]) => boolean; canOpenPath: (href: string) => boolean };

const AdminPermissionsContext = createContext<AdminPermissions | undefined>(undefined);

// UI-only gate for hiding actions. The backend proxy and route handlers stay
// the authority; never rely on this to protect data.
export function AdminPermissionsProvider({ actor, children }: { actor: CmsActor; children: ReactNode }) {
  const value = useMemo<AdminPermissions>(() => ({
    can: (permission) => hasCmsPermission(actor, permission),
    canAny: (permissions) => hasAnyCmsPermission(actor, permissions),
    canOpenPath: (href) => canOpenAdminPath(actor, href),
  }), [actor]);
  return <AdminPermissionsContext.Provider value={value}>{children}</AdminPermissionsContext.Provider>;
}

// For shared components also rendered outside the CMS shell (e.g. login):
// without a provider every action is allowed and the backend still decides.
export function useOptionalAdminPermissions(): AdminPermissions {
  return useContext(AdminPermissionsContext) ?? allowAll;
}

const allowAll: AdminPermissions = { can: () => true, canAny: () => true, canOpenPath: () => true };

export function useAdminPermissions() {
  const context = useContext(AdminPermissionsContext);
  if (!context) throw new Error("useAdminPermissions phải được dùng bên trong AdminPermissionsProvider.");
  return context;
}
