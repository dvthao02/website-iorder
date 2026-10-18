"use client";

import { adminApiError } from "@/lib/admin-api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Download, Eye, LoaderCircle, Pencil, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { withSinglePendingAction } from "./single-pending-action";

import { useAdminToast } from "./admin-feedback";
import { useAdminConfirm } from "./admin-confirm-dialog";
import { useAdminPermissions } from "./admin-permissions";
import type { CmsModuleKey, CmsPermissionCode } from "@iorder/core/server/auth/permissions";
import { publishedPublicUrl } from "@/lib/published-public-url";
import { parseDeletedEntityId, validateContentStateResponse } from "@/lib/admin-detail-payload";

type ContentMutation = { body?: unknown; method: "DELETE" | "PATCH" | "POST"; url: string };

type AdminContentActionsProps = {
  editHref: string;
  deleteMutation?: ContentMutation;
  isArchived?: boolean;
  label: string;
  /** Permission module: archive/restore needs `<module>.publish`, delete needs `<module>.delete`. */
  module: CmsModuleKey;
  mutation: ContentMutation;
  viewHref?: string;
  viewLabel?: string;
};

/** Hành động chuẩn ở bảng nội dung: xem, sửa và xoá mềm/khôi phục; không làm mất dữ liệu ngay. */
export function AdminContentActions({ deleteMutation, editHref, isArchived = false, label, module, mutation, viewHref, viewLabel = "Xem" }: AdminContentActionsProps) {
  const { can } = useAdminPermissions();
  // Matches the API: the proxy needs update for PATCH, the handler needs publish.
  const canChangeState = can(`${module}.update` as CmsPermissionCode) && can(`${module}.publish` as CmsPermissionCode);
  const canDelete = can(`${module}.delete` as CmsPermissionCode);
  const router = useRouter();
  const { confirm } = useAdminConfirm();
  const { show } = useAdminToast();
  const [busyAction, setBusyAction] = useState<"archive" | "delete" | "restore" | null>(null);
  const pending = useRef(false);
  const busy = busyAction !== null;
  const resolvedViewHref = viewHref?.startsWith("/") ? publishedPublicUrl(viewHref) : viewHref;

  async function mutate(nextMutation: ContentMutation, action: "archive" | "delete" | "restore") {
    return withSinglePendingAction(pending, async () => {
      setBusyAction(action);
      try {
        const response = await fetch(nextMutation.url, {
          method: nextMutation.method,
          ...(nextMutation.body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(nextMutation.body) }),
      });
      const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      if (!response.ok) {
        show(adminApiError(payload, `Không thể cập nhật ${label}.`).message, "error");
        return;
      }

      try {
        if (action === "delete") {
          parseDeletedEntityId(payload, nextMutation.url);
        } else {
          validateContentStateResponse(payload, nextMutation.url, nextMutation.body, action);
        }
      } catch (error) {
        show(error instanceof Error ? error.message : "Chưa xác nhận được kết quả. Hãy tải lại danh sách để kiểm tra.", "error");
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
    });
  }

  async function removePermanently() {
    if (!await confirm({ title: "Xác nhận xóa vĩnh viễn", message: `Xóa vĩnh viễn ${label} này khỏi CMS? Thao tác không thể hoàn tác.`, confirmLabel: "Xóa vĩnh viễn", tone: "danger" })) return;
    await mutate(deleteMutation!, "delete");
  }

  return <span className="admin-content-actions">
    {resolvedViewHref ? <Link aria-label={`${viewLabel} ${label}`} className="admin-content-actions__button admin-content-actions__view" href={resolvedViewHref} rel="noreferrer" target="_blank" title={`${viewLabel} ${label}`}>{viewLabel === "Mở tệp" ? <Download aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}</Link> : null}
    <Link aria-label={`Chỉnh sửa ${label}`} className="admin-content-actions__button admin-content-actions__edit" href={editHref} title={`Chỉnh sửa ${label}`}><Pencil aria-hidden="true" size={16} /></Link>
    {canChangeState ? <button aria-busy={busyAction === "archive" || busyAction === "restore"} aria-label={isArchived ? `Khôi phục ${label}` : `Lưu trữ ${label}`} className={`admin-content-actions__button ${isArchived ? "admin-content-actions__restore" : "admin-content-actions__archive"}`} disabled={busy} onClick={() => mutate(mutation, isArchived ? "restore" : "archive")} title={isArchived ? `Khôi phục ${label}` : `Lưu trữ ${label}`} type="button">
      {busyAction === "archive" || busyAction === "restore" ? <LoaderCircle aria-hidden="true" className="admin-content-actions__spinner" size={16} /> : isArchived ? <ArchiveRestore aria-hidden="true" size={16} /> : <Archive aria-hidden="true" size={16} />}
    </button> : null}
    {isArchived && deleteMutation && canDelete ? <button aria-busy={busyAction === "delete"} aria-label={`Xóa ${label}`} className="admin-content-actions__button admin-content-actions__delete" disabled={busy} onClick={() => void removePermanently()} title={`Xóa ${label} khỏi danh sách CMS`} type="button">{busyAction === "delete" ? <LoaderCircle aria-hidden="true" className="admin-content-actions__spinner" size={16} /> : <Trash2 aria-hidden="true" size={16} />}</button> : null}
  </span>;
}
