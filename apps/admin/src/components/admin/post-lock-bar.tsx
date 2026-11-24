"use client";

import { Lock, LockOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { requestAdminJson } from "@/lib/admin-api";
import { AdminButton } from "./ui/admin-button";
import { AdminNotice, useAdminToast } from "./ui/admin-feedback";

const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });

type PostLockBarProps = {
  postId: string;
  lockedAt: Date | string | null;
  lockedByName: string | null;
  /** Người xem có quyền posts.lock (khóa và mở khóa). */
  canLock: boolean;
  /** Trình soạn còn thay đổi chưa lưu: chưa cho khóa (khóa xong thì không lưu được nữa). */
  dirty: boolean;
};

/**
 * Thanh khóa ở đầu trình soạn bài viết/hướng dẫn. Bài đã khóa: báo ai khóa, lúc nào và (với người có quyền Khóa) có nút Mở khóa; trình soạn tự chuyển sang chỉ đọc.
 * Bài chưa khóa: người có quyền Khóa thấy nút Khóa bài viết, người khác không thấy gì. Khóa/mở khóa không đổi nội dung nên không làm mới trang website.
 */
export function PostLockBar({ postId, lockedAt, lockedByName, canLock, dirty }: PostLockBarProps) {
  const router = useRouter();
  const { show } = useAdminToast();
  const [busy, setBusy] = useState(false);

  async function toggle(locked: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      await requestAdminJson(`/api/v1/admin/posts/${postId}/lock`, "POST", { locked }, locked ? "Không thể khóa bài viết." : "Không thể mở khóa bài viết.");
      show(locked ? "Đã khóa bài viết. Không ai sửa hay xóa được cho tới khi mở khóa." : "Đã mở khóa bài viết.", "success");
      router.refresh();
    } catch (error) {
      show(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (lockedAt) {
    return <div className="col-span-full grid gap-2">
      <AdminNotice tone="warning">
        <span className="inline-flex flex-wrap items-center gap-x-1.5"><Lock aria-hidden="true" size={15} /><strong>Bài viết đã khóa</strong>{lockedByName ? ` bởi ${lockedByName}` : ""} lúc {dateTime.format(new Date(lockedAt))}. Không ai sửa, đổi trạng thái hay xóa được cho tới khi mở khóa; bài vẫn hiển thị trên website.</span>
      </AdminNotice>
      {canLock
        ? <div><AdminButton disabled={busy} leadingIcon={<LockOpen aria-hidden="true" size={14} />} onClick={() => void toggle(false)} size="sm" type="button" variant="secondary">{busy ? "Đang mở khóa…" : "Mở khóa"}</AdminButton></div>
        : <small className="admin-text-muted">Chỉ người có quyền Khóa mới mở khóa được.</small>}
    </div>;
  }

  if (!canLock) return null;
  return <div className="col-span-full flex flex-wrap items-center gap-2">
    <AdminButton disabled={busy || dirty} leadingIcon={<Lock aria-hidden="true" size={14} />} onClick={() => void toggle(true)} size="sm" title={dirty ? "Lưu thay đổi trước khi khóa." : "Khóa để không ai sửa hay xóa được bài này"} type="button" variant="secondary">{busy ? "Đang khóa…" : "Khóa bài viết"}</AdminButton>
    <small className="admin-text-muted">Khóa để không ai sửa hay xóa được (kể cả bạn) cho tới khi mở khóa.</small>
  </div>;
}
