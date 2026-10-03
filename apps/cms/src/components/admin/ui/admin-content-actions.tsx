"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Download, Eye, LoaderCircle, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { useAdminToast } from "./admin-feedback";

type ContentMutation = { body?: unknown; method: "DELETE" | "PATCH" | "POST"; url: string };

type AdminContentActionsProps = {
  editHref: string;
  deleteMutation?: ContentMutation;
  isArchived?: boolean;
  label: string;
  mutation: ContentMutation;
  viewHref?: string;
  viewLabel?: string;
};

/** Hành động chuẩn ở bảng nội dung: xem, sửa và xoá mềm/khôi phục; không làm mất dữ liệu ngay. */
export function AdminContentActions({ deleteMutation, editHref, isArchived = false, label, mutation, viewHref, viewLabel = "Xem" }: AdminContentActionsProps) {
  const router = useRouter();
  const { show } = useAdminToast();
  const [busyAction, setBusyAction] = useState<"archive" | "delete" | "restore" | null>(null);
  const busy = busyAction !== null;

  async function mutate(nextMutation: ContentMutation, action: "archive" | "delete" | "restore") {
    setBusyAction(action);
    try {
      const response = await fetch(nextMutation.url, {
        method: nextMutation.method,
        ...(nextMutation.body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(nextMutation.body) }),
      });
      const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      if (!response.ok) {
        show(payload?.error?.message ?? `Không thể cập nhật ${label}.`, "error");
        return;
      }

      const feedback = action === "delete"
        ? { message: `Đã xóa ${label} khỏi danh sách CMS.`, tone: "warning" as const }
        : action === "restore"
          ? { message: `Đã khôi phục ${label}.`, tone: "success" as const }
          : { message: `Đã chuyển ${label} vào lưu trữ.`, tone: "warning" as const };
      show(feedback.message, feedback.tone);
      router.refresh();
    } catch {
      show("Không kết nối được máy chủ. Vui lòng thử lại.", "error");
    } finally {
      setBusyAction(null);
    }
  }

  return <span className="admin-content-actions">
    {viewHref ? <Link aria-label={`${viewLabel} ${label}`} className="admin-content-actions__button admin-content-actions__view" href={viewHref} rel="noreferrer" target="_blank" title={`${viewLabel} ${label}`}>{viewLabel === "Mở tệp" ? <Download aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}</Link> : null}
    <Link aria-label={`Chỉnh sửa ${label}`} className="admin-content-actions__button admin-content-actions__edit" href={editHref} title={`Chỉnh sửa ${label}`}><Pencil aria-hidden="true" size={16} /></Link>
    <button aria-busy={busyAction === "archive" || busyAction === "restore"} aria-label={isArchived ? `Khôi phục ${label}` : `Lưu trữ ${label}`} className={`admin-content-actions__button ${isArchived ? "admin-content-actions__restore" : "admin-content-actions__archive"}`} disabled={busy} onClick={() => mutate(mutation, isArchived ? "restore" : "archive")} title={isArchived ? `Khôi phục ${label}` : `Lưu trữ ${label}`} type="button">
      {busyAction === "archive" || busyAction === "restore" ? <LoaderCircle aria-hidden="true" className="admin-content-actions__spinner" size={16} /> : isArchived ? <ArchiveRestore aria-hidden="true" size={16} /> : <Archive aria-hidden="true" size={16} />}
    </button>
    {isArchived && deleteMutation ? <button aria-busy={busyAction === "delete"} aria-label={`Xóa ${label}`} className="admin-content-actions__button admin-content-actions__delete" disabled={busy} onClick={() => mutate(deleteMutation, "delete")} title={`Xóa ${label} khỏi danh sách CMS`} type="button">{busyAction === "delete" ? <LoaderCircle aria-hidden="true" className="admin-content-actions__spinner" size={16} /> : <Trash2 aria-hidden="true" size={16} />}</button> : null}
  </span>;
}
