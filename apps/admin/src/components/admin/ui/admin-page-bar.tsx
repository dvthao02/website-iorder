"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { AdminHelpTip } from "./admin-help-tip";

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

/** Lời giới thiệu màn: chỉ hiện biểu tượng ⓘ sau tên màn, nội dung mở khi rê chuột/focus (thay cho dòng chữ dưới tiêu đề). */
export function AdminPageBarHelp({ children }: { children: ReactNode }) {
  return <AdminPageBarSlot slotId={adminPageBarMetaId}><AdminHelpTip label="Giới thiệu màn này">{children}</AdminHelpTip></AdminPageBarSlot>;
}
