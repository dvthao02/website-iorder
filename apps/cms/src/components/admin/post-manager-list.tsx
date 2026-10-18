"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Plus } from "lucide-react";

import type { AdminPostListItem } from "@iorder/core/server/posts/posts.contract";
import type { AdminListPage as AdminListResult } from "@iorder/core/server/shared/admin-list.contract";
import { AdminButton } from "@/components/admin/ui/admin-button";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { AdminContentActions } from "@/components/admin/ui/admin-content-actions";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/ui/admin-data-table";
import { AdminStatusBadge, type AdminFeedbackTone } from "@/components/admin/ui/admin-feedback";
import { AdminFilterBar } from "@/components/admin/ui/admin-filter-bar";
import { AdminListHeader } from "@/components/admin/ui/admin-list-header";
import { AdminListPage } from "@/components/admin/ui/admin-list-page";
import { AdminSearchField } from "@/components/admin/ui/admin-search-field";
import { AdminPagination } from "@/components/admin/ui/admin-pagination";

const statusLabels: Record<AdminPostListItem["status"], string> = { archived: "Lưu trữ", draft: "Bản nháp", published: "Đã xuất bản", review: "Chờ duyệt", scheduled: "Hẹn giờ" };
const postTypeLabels: Record<AdminPostListItem["type"], string> = { announcement: "Thông báo", case_study: "Câu chuyện khách hàng", guide: "Hướng dẫn", news: "Tin tức", promotion: "Khuyến mãi" };
const statusTones: Record<AdminPostListItem["status"], AdminFeedbackTone> = { archived: "neutral", draft: "neutral", published: "success", review: "warning", scheduled: "info" };

function getPublicPostPath(item: AdminPostListItem) { return item.type === "guide" ? `/ho-tro/cai-dat/${item.slug}` : `/tin-tuc/${item.slug}`; }

type PostManagerListProps = {
  baseHref?: string;
  createHref?: string;
  initialQuery: string;
  initialStatus: "all" | AdminPostListItem["status"];
  result: AdminListResult<AdminPostListItem>;
  singularLabel?: string;
  tabs?: ReactNode;
  title?: string;
};

export function PostManagerList({ baseHref = "/admin/tin-tuc", createHref = `${baseHref}/moi`, initialQuery, initialStatus, result, tabs, title = "Bài viết & Tin tức", singularLabel = "bài viết" }: PostManagerListProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const columns = useMemo<AdminDataTableColumn<AdminPostListItem>[]>(() => [
    { id: "title", label: "Tiêu đề", defaultWidth: 300, minWidth: 210, cell: (item) => <Link href={`${baseHref}/${item.id}`}>{item.title}</Link> },
    { id: "type", label: "Loại", defaultWidth: 180, minWidth: 140, cell: (item) => <span className="admin-text-muted">{postTypeLabels[item.type]}</span> },
    { id: "status", label: "Trạng thái", defaultWidth: 150, minWidth: 130, cell: (item) => <AdminStatusBadge tone={statusTones[item.status]}>{statusLabels[item.status]}</AdminStatusBadge> },
    { id: "updatedAt", label: "Cập nhật", defaultWidth: 170, minWidth: 145, cell: (item) => <span className="admin-text-muted">{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(item.updatedAt))}</span> },
    { id: "actions", label: "Thao tác", defaultWidth: 164, minWidth: 150, align: "right", cell: (item) => <AdminContentActions module="posts" deleteMutation={item.status === "archived" ? { method: "DELETE", url: `/api/admin/posts/${item.id}`, body: { expectedVersion: item.draftVersion } } : undefined} editHref={`${baseHref}/${item.id}`} isArchived={item.status === "archived"} label={singularLabel} mutation={{ method: "PATCH", url: `/api/admin/posts/${item.id}`, body: { action: item.status === "archived" ? "restore" : "archive", expectedVersion: item.draftVersion } }} viewHref={item.status === "published" ? getPublicPostPath(item) : undefined} /> },
  ], [baseHref, singularLabel]);

  function navigate(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => { if (value) next.set(key, value); else next.delete(key); });
    router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ page: undefined, query: query.trim() || undefined });
  }

  return <AdminListPage variant="dense">
    <AdminCard>
      <AdminListHeader actions={<AdminButton hideWithoutPermission permission="posts.create" href={createHref} leadingIcon={<Plus aria-hidden="true" size={16} />}>Viết {singularLabel} mới</AdminButton>} description={`${result.total} ${singularLabel}`} title={title} />
      {tabs}
      <AdminFilterBar onSubmit={submitSearch}><AdminSearchField id="post-search" label="Tìm kiếm bài viết" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tiêu đề hoặc slug" value={query} /><label className="sr-only" htmlFor="post-status">Lọc trạng thái</label><select id="post-status" onChange={(event) => navigate({ page: undefined, status: event.target.value === "all" ? undefined : event.target.value })} value={initialStatus}><option value="all">Tất cả trạng thái</option><option value="draft">Bản nháp</option><option value="review">Chờ duyệt</option><option value="scheduled">Hẹn giờ</option><option value="published">Đã xuất bản</option><option value="archived">Lưu trữ</option></select></AdminFilterBar>
      <AdminDataTable columns={columns} emptyMessage="Chưa tìm thấy nội dung phù hợp." getRowId={(item) => item.id} rows={result.items} tableId={`posts-${title.toLocaleLowerCase("vi").replaceAll(" ", "-")}`} />
      <AdminPagination page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} onChange={(page) => navigate({ page: page === 1 ? undefined : String(page) })} />
    </AdminCard>
  </AdminListPage>;
}

