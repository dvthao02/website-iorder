"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Plus } from "lucide-react";

import type { AdminPostListItem } from "@iorder/core/server/posts/posts.contract";
import type { AdminListPage as AdminListResult } from "@iorder/core/server/shared/admin-list.contract";
import { AdminButton } from "@/components/admin/ui/admin-button";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { AdminContentActions } from "@/components/admin/ui/admin-content-actions";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/ui/admin-data-table";
import { AdminStatusBadge, type AdminFeedbackTone } from "@/components/admin/ui/admin-feedback";
import { AdminFilterBar, type AdminFilterChip } from "@/components/admin/ui/admin-filter-bar";
import { AdminListHeader } from "@/components/admin/ui/admin-list-header";
import { AdminListPage } from "@/components/admin/ui/admin-list-page";
import { AdminSearchField } from "@/components/admin/ui/admin-search-field";
import { AdminPagination } from "@/components/admin/ui/admin-pagination";
import { ContentBulkBar, useRowSelection } from "@/components/admin/ui/content-bulk-bar";
import { useListNavigation } from "@/components/admin/ui/use-list-navigation";

const statusLabels: Record<AdminPostListItem["status"], string> = { archived: "Lưu trữ", draft: "Bản nháp", published: "Đã xuất bản", review: "Chờ duyệt", scheduled: "Hẹn giờ" };
const postTypeLabels: Record<AdminPostListItem["type"], string> = { announcement: "Thông báo", case_study: "Câu chuyện khách hàng", guide: "Hướng dẫn", news: "Tin tức", promotion: "Khuyến mãi" };
const statusTones: Record<AdminPostListItem["status"], AdminFeedbackTone> = { archived: "neutral", draft: "neutral", published: "success", review: "warning", scheduled: "info" };
const dateFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" });

function getPublicPostPath(item: AdminPostListItem) { return item.type === "guide" ? `/ho-tro/cai-dat/${item.slug}` : `/tin-tuc/${item.slug}`; }

type TaxonomyOption = { id: string; name: string };

type PostManagerListProps = {
  baseHref?: string;
  createHref?: string;
  initialQuery: string;
  initialStatus: "all" | AdminPostListItem["status"];
  result: AdminListResult<AdminPostListItem>;
  singularLabel?: string;
  tabs?: ReactNode;
  title?: string;
  /** Bộ lọc loại bài (bỏ trống khi danh sách chỉ có một loại, ví dụ hướng dẫn). */
  typeOptions?: AdminPostListItem["type"][];
  categories?: TaxonomyOption[];
  tags?: TaxonomyOption[];
};

export function PostManagerList({ baseHref = "/admin/tin-tuc", createHref = `${baseHref}/moi`, initialQuery, initialStatus, result, tabs, title = "Bài viết & Tin tức", singularLabel = "bài viết", typeOptions = [], categories = [], tags = [] }: PostManagerListProps) {
  const { navigate, searchParams, setFilter, setSort, sort } = useListNavigation();
  const [query, setQuery] = useState(initialQuery);
  const { selectedIds, setSelectedIds, clear } = useRowSelection(searchParams.toString());
  const columns = useMemo<AdminDataTableColumn<AdminPostListItem>[]>(() => [
    { id: "title", label: "Tiêu đề", defaultWidth: 300, minWidth: 210, sortKey: "title", cell: (item) => <Link href={`${baseHref}/${item.id}`}>{item.title}</Link> },
    { id: "type", label: "Loại", defaultWidth: 170, minWidth: 130, sortKey: "type", cell: (item) => <span className="admin-text-muted">{postTypeLabels[item.type]}</span> },
    { id: "status", label: "Trạng thái", defaultWidth: 150, minWidth: 130, sortKey: "status", cell: (item) => <AdminStatusBadge tone={statusTones[item.status]}>{statusLabels[item.status]}</AdminStatusBadge> },
    { id: "updatedAt", label: "Cập nhật", defaultWidth: 160, minWidth: 140, sortKey: "updatedAt", sortFirst: "desc", cell: (item) => <span className="admin-text-muted">{dateFormatter.format(new Date(item.updatedAt))}</span> },
    { id: "actions", label: "Thao tác", defaultWidth: 120, minWidth: 120, align: "right", cell: (item) => <AdminContentActions module="posts" deleteMutation={item.status === "archived" ? { method: "DELETE", url: `/api/admin/posts/${item.id}`, body: { expectedVersion: item.draftVersion } } : undefined} editHref={`${baseHref}/${item.id}`} isArchived={item.status === "archived"} label={singularLabel} mutation={{ method: "PATCH", url: `/api/admin/posts/${item.id}`, body: { action: item.status === "archived" ? "restore" : "archive", expectedVersion: item.draftVersion } }} viewHref={item.status === "published" ? getPublicPostPath(item) : undefined} /> },
  ], [baseHref, singularLabel]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ page: undefined, query: query.trim() || undefined });
  }

  const typeFilter = searchParams.get("type") ?? "";
  const categoryFilter = searchParams.get("categoryId") ?? "";
  const tagFilter = searchParams.get("tagId") ?? "";
  const chips: AdminFilterChip[] = [
    ...(initialQuery ? [{ key: "query", label: `Từ khóa: “${initialQuery}”`, onRemove: () => { setQuery(""); setFilter("query", undefined); } }] : []),
    ...(initialStatus !== "all" ? [{ key: "status", label: `Trạng thái: ${statusLabels[initialStatus]}`, onRemove: () => setFilter("status", undefined) }] : []),
    ...(typeFilter ? [{ key: "type", label: `Loại: ${postTypeLabels[typeFilter as AdminPostListItem["type"]] ?? typeFilter}`, onRemove: () => setFilter("type", undefined) }] : []),
    ...(categoryFilter ? [{ key: "categoryId", label: `Chuyên mục: ${categories.find((item) => item.id === categoryFilter)?.name ?? "?"}`, onRemove: () => setFilter("categoryId", undefined) }] : []),
    ...(tagFilter ? [{ key: "tagId", label: `Thẻ: ${tags.find((item) => item.id === tagFilter)?.name ?? "?"}`, onRemove: () => setFilter("tagId", undefined) }] : []),
  ];
  const filtered = chips.length > 0;

  return <AdminListPage variant="dense">
    <AdminCard>
      <AdminListHeader actions={<AdminButton hideWithoutPermission permission="posts.create" href={createHref} leadingIcon={<Plus aria-hidden="true" size={16} />}>Viết {singularLabel} mới</AdminButton>} description={`${result.total} ${singularLabel}${filtered ? " khớp bộ lọc" : ""}`} title={title} />
      {tabs}
      <AdminFilterBar chips={chips} more={typeOptions.length > 1 || tags.length ? <>
        {typeOptions.length > 1 ? <select aria-label="Lọc loại bài" onChange={(event) => setFilter("type", event.target.value || undefined)} value={typeFilter}><option value="">Tất cả loại</option>{typeOptions.map((type) => <option key={type} value={type}>{postTypeLabels[type]}</option>)}</select> : null}
        {tags.length ? <select aria-label="Lọc thẻ" onChange={(event) => setFilter("tagId", event.target.value || undefined)} value={tagFilter}><option value="">Tất cả thẻ</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select> : null}
      </> : undefined} moreActiveCount={[typeFilter, tagFilter].filter(Boolean).length} onClearAll={() => { setQuery(""); navigate({ page: undefined, query: undefined, status: undefined, type: undefined, categoryId: undefined, tagId: undefined }); }} onSubmit={submitSearch} search={<AdminSearchField id="post-search" label={`Tìm kiếm ${singularLabel}`} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tiêu đề hoặc slug" value={query} />}>
        <select aria-label="Lọc trạng thái" onChange={(event) => setFilter("status", event.target.value === "all" ? undefined : event.target.value)} value={initialStatus}><option value="all">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        {categories.length ? <select aria-label="Lọc chuyên mục" onChange={(event) => setFilter("categoryId", event.target.value || undefined)} value={categoryFilter}><option value="">Tất cả chuyên mục</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select> : null}
      </AdminFilterBar>
      <ContentBulkBar items={result.items} module="posts" noun={singularLabel} onClear={clear} request={(item, action) => ({ method: "PATCH", url: `/api/admin/posts/${item.id}`, body: { action, expectedVersion: item.draftVersion } })} selectedIds={selectedIds} />
      <AdminDataTable columns={columns} emptyMessage={filtered ? "Không có nội dung khớp bộ lọc. Thử đổi từ khóa hoặc bộ lọc." : "Chưa có nội dung nào."} getRowId={(item) => item.id} onSelectionChange={setSelectedIds} onSortChange={setSort} rows={result.items} selectedIds={selectedIds} sort={sort} tableId={`posts-${title.toLocaleLowerCase("vi").replaceAll(" ", "-")}`} />
      <AdminPagination page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} onChange={(page) => navigate({ page: page === 1 ? undefined : String(page) })} />
    </AdminCard>
  </AdminListPage>;
}
