"use client";

import { useCallback, useRef } from "react";

import { ChangePasswordForm } from "./change-password-form";
import { ProfileForm } from "./profile-form";
import { useAdminConfirm } from "./ui/admin-confirm-dialog";
import { useAdminToast } from "./ui/admin-feedback";
import { AdminFilterTabsContent } from "./ui/admin-filter-tabs";
import { AdminSidePanel } from "./ui/admin-side-panel";

export type AccountTab = "profile" | "password";
type AccountAdministrator = { avatarUrl?: string | null; email?: string | null; fullName: string; phone?: string | null; role: string; roleName?: string | null; username: string };

const tabs: Array<{ label: string; value: AccountTab }> = [{ label: "Hồ sơ", value: "profile" }, { label: "Mật khẩu", value: "password" }];

// Tài khoản của chính người đang đăng nhập, mở từ menu ở thanh trên và trượt từ bên phải: không rời trang đang làm dở.
// Ai cũng mở được, không cần quyền "Người dùng CMS". Hai tab cùng được dựng khi panel mở (tab kia chỉ ẩn) nên đổi tab không mất chữ đang nhập.
export function AccountPanel({ administrator, onClose, onTabChange, tab }: {
  administrator: AccountAdministrator;
  onClose: () => void;
  onTabChange: (tab: AccountTab) => void;
  tab: AccountTab | null;
}) {
  const { confirm } = useAdminConfirm();
  const { show: showToast } = useAdminToast();
  const profileStatus = useRef({ dirty: false, busy: false });
  const reportProfileStatus = useCallback((status: { dirty: boolean; busy: boolean }) => { profileStatus.current = status; }, []);

  const requestClose = useCallback(async () => {
    if (profileStatus.current.busy) { showToast("Đang lưu hồ sơ. Vui lòng chờ trước khi đóng.", "info"); return; }
    if (profileStatus.current.dirty) {
      const discard = await confirm({ title: "Đóng khi chưa lưu?", message: "Hồ sơ có thay đổi chưa lưu. Nếu đóng, các thay đổi đó sẽ mất.", confirmLabel: "Đóng và bỏ thay đổi", cancelLabel: "Ở lại", tone: "danger" });
      if (!discard) return;
    }
    profileStatus.current = { dirty: false, busy: false };
    onClose();
  }, [confirm, onClose, showToast]);

  return <AdminSidePanel className="admin-account-panel" closeLabel="Đóng tài khoản" isOpen={tab !== null} label="Tài khoản của tôi" onClose={() => void requestClose()}>
    <header className="admin-account-panel__header"><h2>Tài khoản của tôi</h2></header>
    <AdminFilterTabsContent ariaLabel="Mục tài khoản" items={tabs} onValueChange={onTabChange} value={tab ?? "profile"} />
    <section aria-label="Hồ sơ" className="admin-account-panel__body" hidden={tab !== "profile"} role="tabpanel">
      <ProfileForm
        avatarUrl={administrator.avatarUrl ?? null}
        initial={{ fullName: administrator.fullName, email: administrator.email ?? "", phone: administrator.phone ?? "" }}
        onStatusChange={reportProfileStatus}
        roleName={administrator.roleName ?? administrator.role}
        username={administrator.username}
      />
    </section>
    <section aria-label="Mật khẩu" className="admin-account-panel__body" hidden={tab !== "password"} role="tabpanel">
      <ChangePasswordForm username={administrator.username} />
    </section>
  </AdminSidePanel>;
}
