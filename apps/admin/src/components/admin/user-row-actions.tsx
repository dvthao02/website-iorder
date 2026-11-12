"use client";

import { Lock, LockOpen, LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";

import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { useAdminConfirm } from "./ui/admin-confirm-dialog";
import { useAdminToast } from "./ui/admin-feedback";
import { useAdminPermissions } from "./ui/admin-permissions";
import { AdminRowEditIcon } from "./ui/admin-row-title";

type RowUser = { id: string; username: string; email: string | null; fullName: string; role: string; status: "active" | "disabled" };

/**
 * Cột Thao tác của bảng Người dùng: Sửa (bấm dòng), Khóa/Mở khóa (users.update) và Xóa (users.delete, chỉ tài khoản đã khóa).
 * Nút nào thiếu quyền thì ẩn; không có nút Khóa/Xóa cho chính tài khoản đang đăng nhập. Backend vẫn kiểm lại mọi quy tắc.
 */
export function UserRowActions({ isSelf, user }: { isSelf: boolean; user: RowUser }) {
  const router = useRouter();
  const { can } = useAdminPermissions();
  const { confirm } = useAdminConfirm();
  const { show } = useAdminToast();
  const [busy, setBusy] = useState<"status" | "delete" | null>(null);
  const locked = user.status === "disabled";

  async function run(event: MouseEvent, kind: "status" | "delete") {
    event.stopPropagation();
    if (busy) return;
    const confirmed = kind === "delete"
      ? await confirm({ title: `Xóa tài khoản ${user.fullName}?`, message: "Tài khoản sẽ bị xóa khỏi CMS; nhật ký vẫn giữ tên người thực hiện. Tên đăng nhập và email được nhả ra để tạo lại nếu cần.", confirmLabel: "Xóa tài khoản", tone: "danger" })
      : locked || await confirm({ title: `Khóa tài khoản ${user.fullName}?`, message: "Người này sẽ bị đăng xuất khỏi mọi thiết bị và không đăng nhập được cho tới khi mở khóa.", confirmLabel: "Khóa tài khoản", tone: "danger" });
    if (!confirmed) return;
    setBusy(kind);
    try {
      const response = kind === "delete"
        ? await fetch(`/api/v1/admin/users?id=${encodeURIComponent(user.id)}`, { method: "DELETE" })
        : await fetch("/api/v1/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: user.id, values: { username: user.username, email: user.email, fullName: user.fullName, role: user.role, status: locked ? "active" : "disabled", password: null } }) });
      const payload = await readAdminJson(response);
      if (!response.ok) throw adminApiError(payload, kind === "delete" ? "Không thể xóa tài khoản." : "Không thể đổi trạng thái tài khoản.");
      show(kind === "delete" ? `Đã xóa tài khoản ${user.fullName}.` : locked ? `Đã mở khóa ${user.fullName}.` : `Đã khóa ${user.fullName} và đăng xuất mọi thiết bị.`, "success");
      router.refresh();
    } catch (error) {
      show(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      setBusy(null);
    }
  }

  const spinner = <LoaderCircle aria-hidden="true" className="admin-content-actions__spinner" size={16} />;
  return <span className="admin-content-actions">
    <AdminRowEditIcon />
    {!isSelf && can("users.update") ? <button aria-label={`${locked ? "Mở khóa" : "Khóa"} ${user.fullName}`} className={`admin-content-actions__button ${locked ? "admin-content-actions__restore" : "admin-content-actions__archive"}`} disabled={Boolean(busy)} onClick={(event) => void run(event, "status")} title={locked ? "Mở khóa tài khoản" : "Khóa tài khoản"} type="button">
      {busy === "status" ? spinner : locked ? <LockOpen aria-hidden="true" size={16} /> : <Lock aria-hidden="true" size={16} />}
    </button> : null}
    {!isSelf && locked && can("users.delete") ? <button aria-label={`Xóa ${user.fullName}`} className="admin-content-actions__button admin-content-actions__delete" disabled={Boolean(busy)} onClick={(event) => void run(event, "delete")} title="Xóa tài khoản" type="button">
      {busy === "delete" ? spinner : <Trash2 aria-hidden="true" size={16} />}
    </button> : null}
  </span>;
}
