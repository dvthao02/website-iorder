"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const adminPageBarActionsId = "admin-page-bar-actions";
export const adminPageBarMetaId = "admin-page-bar-meta";

const noop = () => () => undefined;

// Thanh trên cùng của khung CMS là header duy nhất của màn: từng màn đưa số liệu tóm tắt và nút hành động
// vào đây thay vì lặp lại tiêu đề trong nội dung. Server snapshot là null nên lúc hydrate không lệch HTML.
function AdminPageBarSlot({ children, slotId }: { children: ReactNode; slotId: string }) {
  const target = useSyncExternalStore(noop, () => document.getElementById(slotId), () => null);
  return target ? createPortal(children, target) : null;
}

/** Nút hành động và liên kết theo ngữ cảnh, hiển thị bên phải thanh. */
export function AdminPageBarActions({ children }: { children: ReactNode }) {
  return <AdminPageBarSlot slotId={adminPageBarActionsId}>{children}</AdminPageBarSlot>;
}

/** Số liệu tóm tắt ngắn (ví dụ "6 bài viết"), hiển thị ngay sau tên màn. */
export function AdminPageBarMeta({ children }: { children: ReactNode }) {
  return <AdminPageBarSlot slotId={adminPageBarMetaId}>{children}</AdminPageBarSlot>;
}
