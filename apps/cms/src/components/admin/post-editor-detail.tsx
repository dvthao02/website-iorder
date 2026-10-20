"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PostEditor, type PostTaxonomy } from "@/components/admin/posts-content-manager";
import type { AdminPost } from "@iorder/core/server/posts/posts.contract";
import { AdminNotice, useAdminToast } from "@/components/admin/ui/admin-feedback";
import { AdminDetailPanel } from "@/components/admin/ui/admin-detail-panel";

function savedMessage(saved: AdminPost, previous: AdminPost["status"] | undefined, label: string) {
  if (saved.status === "published") return previous === "published" ? `Đã cập nhật ${label} trên website.` : `Đã xuất bản ${label}.`;
  if (saved.status === "scheduled") return `Đã lên lịch đăng ${label}.`;
  if (saved.status === "review") return `Đã gửi duyệt ${label}.`;
  if (saved.status === "archived") return `Đã lưu trữ ${label}.`;
  return previous ? "Đã lưu bản nháp." : `Đã tạo bản nháp ${label}.`;
}

export function PostEditorDetail({ post, taxonomy, backHref = "/admin/tin-tuc", contentType, contentLabel = "bài viết" }: { post?: AdminPost; taxonomy: PostTaxonomy; backHref?: string; contentType?: AdminPost["type"]; contentLabel?: string }) {
  const router = useRouter();
  const [notice, setNotice] = useState<string>();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { show: showToast } = useAdminToast();
  const editorTitle = post?.title ?? `Viết ${contentLabel} mới`;
  const editorDescription = post ? `Chỉnh sửa nội dung, xuất bản và SEO của ${contentLabel}.` : `Hoàn thiện thông tin rồi lưu để tạo ${contentLabel}.`;

  return <AdminDetailPanel backHref={backHref} description={editorDescription} eyebrow={contentLabel} hasUnsavedChanges={hasUnsavedChanges} notice={notice ? <AdminNotice tone="error">{notice}</AdminNotice> : undefined} title={editorTitle}><PostEditor contentType={contentType} onDirtyChange={setHasUnsavedChanges} onError={(message) => { setNotice(message); showToast(message, "error"); }} onSaved={(saved) => { setNotice(undefined); showToast(savedMessage(saved, post?.status, contentLabel), "success"); router.replace(saved.type === "guide" ? `/admin/tai-nguyen/huong-dan/${saved.id}` : `${backHref.split("?")[0]}/${saved.id}`); router.refresh(); }} post={post} taxonomy={taxonomy} /></AdminDetailPanel>;
}
