"use client";

import { Plus } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";

import type { CmsPermissionCode } from "@iorder/core/server/auth/permissions";
import { toSlug } from "@/lib/slug";

import { AdminButton } from "./admin-button";
import { useAdminToast } from "./admin-feedback";
import { useOptionalAdminPermissions } from "./admin-permissions";

type AdminInlineCreateProps = {
  /** Tên loại dữ liệu viết thường, ví dụ "chuyên mục". */
  label: string;
  permission: CmsPermissionCode;
  disabled?: boolean;
  hint?: string;
  /** Gọi API tạo bản ghi; ném lỗi (thông báo tiếng Việt) nếu thất bại. */
  onCreate: (name: string, slug: string) => Promise<void>;
};

// Tạo nhanh bản ghi liên kết ngay tại ô chọn (chuyên mục, thẻ, nhóm thiết bị) mà không rời màn đang sửa.
// Không dùng <form> vì thường nằm trong form của editor: Enter được xử lý tay để không gửi form ngoài.
export function AdminInlineCreate({ disabled = false, hint, label, onCreate, permission }: AdminInlineCreateProps) {
  const { can } = useOptionalAdminPermissions();
  const { show: showToast } = useAdminToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const slug = toSlug(name);

  if (!can(permission)) return null;
  if (!open) return <AdminButton className="justify-self-start" disabled={disabled} leadingIcon={<Plus aria-hidden="true" />} onClick={() => setOpen(true)} size="sm" variant="ghost">Thêm {label} mới</AdminButton>;

  async function create() {
    if (pending.current) return;
    if (!name.trim() || !slug) { showToast(`Nhập tên ${label} có chữ hoặc số.`, "warning"); return; }
    pending.current = true;
    setBusy(true);
    try {
      await onCreate(name.trim(), slug);
      showToast(`Đã tạo ${label} “${name.trim()}”.`, "success");
      setName("");
      setOpen(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : `Không thể tạo ${label}.`, "error");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") { event.preventDefault(); void create(); }
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
  }

  return <div className="admin-inline-create">
    <div className="admin-inline-create__row">
      <input aria-label={`Tên ${label} mới`} autoFocus disabled={busy} maxLength={160} onChange={(event) => setName(event.target.value)} onKeyDown={onKeyDown} placeholder={`Tên ${label} mới`} value={name} />
      <AdminButton disabled={busy || !slug} onClick={() => void create()} size="sm">{busy ? "Đang tạo…" : "Thêm"}</AdminButton>
      <AdminButton disabled={busy} onClick={() => { setOpen(false); setName(""); }} size="sm" variant="ghost">Hủy</AdminButton>
    </div>
    <small>{slug ? `Đường dẫn: /${slug}` : "Đường dẫn được tạo tự động từ tên."}{hint ? ` ${hint}` : ""}</small>
  </div>;
}
