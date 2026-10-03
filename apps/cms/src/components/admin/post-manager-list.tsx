"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { AdminPost } from "@iorder/core/server/posts/posts.contract";
import { AdminButton } from "@/components/admin/ui/admin-button";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { AdminContentActions } from "@/components/admin/ui/admin-content-actions";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/ui/admin-data-table";
import { AdminStatusBadge, type AdminFeedbackTone } from "@/components/admin/ui/admin-feedback";

const statusLabels: Record<AdminPost["status"], string> = { archived: "Lưu trữ", draft: "Bản nháp", published: "Đã xuất bản", review: "Chờ duyệt", scheduled: "Hẹn giờ" };
const postTypeLabels: Record<AdminPost["type"], string> = { announcement: "Thông báo", case_study: "Câu chuyện khách hàng", guide: "Hướng dẫn", news: "Tin tức", promotion: "Khuyến mãi" };
const statusTones: Record<AdminPost["status"], AdminFeedbackTone> = { archived: "neutral", draft: "neutral", published: "success", review: "warning", scheduled: "info" };
function getPublicPostPath(item: AdminPost) { return item.type === "guide" ? `/ho-tro/cai-dat/${item.slug}` : `/tin-tuc/${item.slug}`; }

export function PostManagerList({ items, baseHref = "/admin/tin-tuc", createHref = `${baseHref}/moi`, title = "Bài viết & Tin tức", singularLabel = "bài viết" }: { items: AdminPost[]; baseHref?: string; createHref?: string; title?: string; singularLabel?: string }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | AdminPost["status"]>("all");
  const filtered = useMemo(() => items.filter((item) => (item.title.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")) || item.slug.includes(query.trim().toLocaleLowerCase("vi"))) && (status === "all" || item.status === status)), [items, query, status]);
  const published = items.filter((item) => item.status === "published").length;
  const attention = items.filter((item) => item.status === "draft" || item.status === "review" || item.status === "scheduled").length;
  const columns = useMemo<AdminDataTableColumn<AdminPost>[]>(() => [
    { id: "title", label: "Tiêu đề", defaultWidth: 300, minWidth: 210, cell: (item) => <Link className="font-bold text-slate-900 hover:text-blue-700" href={`${baseHref}/${item.id}`}>{item.title}</Link> },
    { id: "type", label: "Loại", defaultWidth: 180, minWidth: 140, cell: (item) => <span className="text-slate-600">{postTypeLabels[item.type]}</span> },
    { id: "status", label: "Trạng thái", defaultWidth: 150, minWidth: 130, cell: (item) => <AdminStatusBadge tone={statusTones[item.status]}>{statusLabels[item.status]}</AdminStatusBadge> },
    { id: "updatedAt", label: "Cập nhật", defaultWidth: 170, minWidth: 145, cell: (item) => <span className="text-slate-600">{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(item.updatedAt))}</span> },
    { id: "actions", label: "Thao tác", defaultWidth: 132, minWidth: 116, align: "right", cell: (item) => { const values = { ...item }; ["id", "authorId", "draftVersion", "publishedAt", "updatedAt"].forEach((key) => Reflect.deleteProperty(values, key)); return <AdminContentActions editHref={`${baseHref}/${item.id}`} isArchived={item.status === "archived"} label={singularLabel} mutation={{ method: "PATCH", url: `/api/admin/posts/${item.id}`, body: { ...values, status: item.status === "archived" ? "draft" : "archived" } }} viewHref={item.status === "published" ? getPublicPostPath(item) : undefined} />; } },
  ], [baseHref, singularLabel]);

  return <div className="grid gap-5">
    <section aria-label={`Tóm tắt ${title.toLocaleLowerCase("vi")}`} className="grid gap-3 sm:grid-cols-3"><AdminCard className="p-5"><p className="text-sm font-semibold text-slate-600">Tổng nội dung</p><strong className="mt-2 block text-3xl font-extrabold text-slate-950">{items.length}</strong></AdminCard><AdminCard className="p-5"><p className="text-sm font-semibold text-slate-600">Đã xuất bản</p><strong className="mt-2 block text-3xl font-extrabold text-emerald-700">{published}</strong></AdminCard><AdminCard className="p-5"><p className="text-sm font-semibold text-slate-600">Cần xử lý</p><strong className="mt-2 block text-3xl font-extrabold text-amber-700">{attention}</strong></AdminCard></section>
    <AdminCard className="grid gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold text-slate-950">Danh sách {title}</h2><p className="mt-1 text-sm text-slate-600">Chọn nội dung để chỉnh sửa trong màn hình riêng.</p></div><AdminButton href={createHref}>Viết {singularLabel} mới</AdminButton></div>
      <div className="grid gap-3 border-y border-slate-100 py-4 sm:grid-cols-[minmax(0,1fr)_190px]"><label className="sr-only" htmlFor="post-search">Tìm kiếm bài viết</label><input className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100" id="post-search" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tiêu đề hoặc slug..." value={query} /><label className="sr-only" htmlFor="post-status">Lọc trạng thái</label><select className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" id="post-status" onChange={(event) => setStatus(event.target.value as "all" | AdminPost["status"])} value={status}><option value="all">Tất cả trạng thái</option><option value="draft">Bản nháp</option><option value="review">Chờ duyệt</option><option value="scheduled">Hẹn giờ</option><option value="published">Đã xuất bản</option><option value="archived">Lưu trữ</option></select></div>
      <AdminDataTable columns={columns} emptyMessage="Chưa tìm thấy nội dung phù hợp." getRowId={(item) => item.id} rows={filtered} tableId={`posts-${title.toLocaleLowerCase("vi").replaceAll(" ", "-")}`} />
    </AdminCard>
  </div>;
}
