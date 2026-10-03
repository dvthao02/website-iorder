"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PostEditor, type PostTaxonomy } from "@/components/admin/posts-content-manager";
import { PublishedPreviewLink } from "@/components/admin/published-preview-link";
import type { AdminPost } from "@iorder/core/server/posts/posts.contract";
import { AdminNotice, useAdminToast } from "@/components/admin/ui/admin-feedback";
import { AdminDetailPanel } from "@/components/admin/ui/admin-detail-panel";

export function PostEditorDetail({ post, taxonomy, backHref = "/admin/tin-tuc", contentType, contentLabel = "bài viết" }: { post?: AdminPost; taxonomy: PostTaxonomy; backHref?: string; contentType?: AdminPost["type"]; contentLabel?: string }) {
  const router = useRouter();
  const [notice, setNotice] = useState<string>();
  const { show: showToast } = useAdminToast();
  const editorTitle = post?.title ?? `Viết ${contentLabel} mới`;
  const editorDescription = post ? `Chỉnh sửa nội dung, xuất bản và SEO của ${contentLabel}.` : `Hoàn thiện thông tin rồi lưu để tạo ${contentLabel}.`;

  return <AdminDetailPanel actions={<PublishedPreviewLink contentType={post?.type} kind="post" slug={post?.slug} status={post?.status} />} backHref={backHref} description={editorDescription} eyebrow={contentLabel} notice={notice ? <AdminNotice tone="error">{notice}</AdminNotice> : undefined} title={editorTitle}><PostEditor contentType={contentType} onError={(message) => { setNotice(message); showToast(message, "error"); }} onSaved={(saved) => { setNotice(undefined); showToast(post ? "Đã lưu thay đổi." : "Đã tạo bài viết mới.", "success"); router.replace(`${backHref}/${saved.id}`); router.refresh(); }} post={post} taxonomy={taxonomy} /></AdminDetailPanel>;
}
