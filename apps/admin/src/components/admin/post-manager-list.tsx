"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Plus, Tags } from "lucide-react";

import type { AdminPostListItem } from "@iorder/shared/server/posts/posts.contract";
import type { AdminListPage as AdminListResult } from "@iorder/shared/server/shared/admin-list.contract";
import { AdminButton } from "@/components/admin/ui/admin-button";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { AdminContentActions } from "@/components/admin/ui/admin-content-actions";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/ui/admin-data-table";
import { AdminStatusBadge, type AdminFeedbackTone } from "@/components/admin/ui/admin-feedback";
import { AdminRowTitle } from "@/components/admin/ui/admin-row-title";
import { DataTransferActions } from "@/components/admin/data-transfer-actions";
import { AdminFilterBar, type AdminFilterChip } from "@/components/admin/ui/admin-filter-bar";
import { AdminListHeader } from "@/components/admin/ui/admin-list-header";
import { AdminListPage } from "@/components/admin/ui/admin-list-page";
import { AdminSearchField } from "@/components/admin/ui/admin-search-field";
import { AdminPagination } from "@/components/admin/ui/admin-pagination";
import { useAdminPermissions } from "@/components/admin/ui/admin-permissions";
import { ContentBulkBar, useRowSelection } from "@/components/admin/ui/content-bulk-bar";
import { useBulkAction } from "@/components/admin/ui/use-bulk-action";
import { useListNavigation } from "@/components/admin/ui/use-list-navigation";

const statusLabels: Record<AdminPostListItem["status"], string> = { archived: "Lưu trữ", draft: "Bản nháp", published: "Đã xuất bản", review: "Chờ duyệt", scheduled: "Hẹn giờ" };
const postTypeLabels: Record<AdminPostListItem["type"], string> = { announcement: "Thông báo", case_study: "Câu chuyện khách hàng", guide: "Hướng dẫn", news: "Tin tức", promotion: "Khuyến mãi" };
const statusTones: Record<AdminPostListItem["status"], AdminFeedbackTone> = { archived: "neutral", draft: "neutral", published: "success", review: "warning", scheduled: "info" };
const dateFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" });

function getPublicPostPath(item: AdminPostListItem) { return item.type === "guide" ? `/ho-tro/huong-dan/${item.slug}` : `/tin-tuc/${item.slug}`; }

type TaxonomyOption = { id: string; name: string };
/** Cột chuyên mục của bảng: với hướng dẫn gọi là "Nhóm" (đúng như nhóm trên website), bài chưa có chuyên mục hiện `empty`. */
type GroupColumn = { label: string; empty: string };

/**
 * "Chuyển vào nhóm…" cho các dòng đã chọn: đặt chuyên mục mới (thay chuyên mục cũ) hoặc bỏ chuyên mục. Mỗi bài gửi một
 * request có kiểm phiên bản như khi lưu từ trình soạn; bài lỗi (409…) không chặn bài khác.
 */
function MoveToGroup({ items, selectedIds, categories, group, noun, onDone }: { items: AdminPostListItem[]; selectedIds: readonly string[]; categories: TaxonomyOption[]; group: GroupColumn; noun: string; onDone: () => void }) {
  const { can } = useAdminPermissions();
  const { busy, run } = useBulkAction();
  const selected = items.filter((item) => selectedIds.includes(item.id));
  if (!selected.length || !categories.length) return null;
  const denied = can("posts.update") ? undefined : "Cần quyền sửa.";
  function move(value: string) {
    if (!value) return;
    const target = value === "__none" ? null : categories.find((category) => category.id === value);
    const name = target?.name ?? group.empty;
    void run({
      items: selected,
      request: (item) => ({ method: "PATCH", url: `/api/v1/admin/posts/${item.id}`, body: { categoryIds: target ? [target.id] : [], expectedVersion: item.draftVersion } }),
      verb: "Chuyển nhóm",
      noun,
      confirmMessage: `${selected.length} ${noun} sẽ chuyển vào “${name}”${target ? "" : " (bỏ chuyên mục)"}. Bài đang hiển thị trên website đổi nhóm ngay.`,
      onDone,
    });
  }
  return <select aria-label={`Chuyển các ${noun} đã chọn vào ${group.label.toLocaleLowerCase("vi")}`} disabled={busy || Boolean(denied)} onChange={(event) => move(event.target.value)} title={denied} value="">
    <option value="">Chuyển vào {group.label.toLocaleLowerCase("vi")}…</option>
    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
    <option value="__none">{group.empty} (bỏ chuyên mục)</option>
  </select>;
}

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
  /** Nút tới màn Chuyên mục & Thẻ (màn này không có dòng riêng trên sidebar). */
  showTaxonomyLink?: boolean;
  /** Cột chuyên mục/nhóm + thao tác "Chuyển vào nhóm…" (hướng dẫn: thay cột Loại vốn luôn là "Hướng dẫn"). */
  groupColumn?: GroupColumn;
};

export function PostManagerList({ baseHref = "/admin/news", createHref = `${baseHref}/new`, initialQuery, initialStatus, result, tabs, title = "Bài viết & Tin tức", singularLabel = "bài viết", typeOptions = [], categories = [], tags = [], showTaxonomyLink = false, groupColumn }: PostManagerListProps) {
  const { navigate, pagination, searchParams, setFilter, setSort, sort } = useListNavigation();
  const [query, setQuery] = useState(initialQuery);
  const { selectedIds, setSelectedIds, clear } = useRowSelection(searchParams.toString());
  const columns = useMemo<AdminDataTableColumn<AdminPostListItem>[]>(() => [
    { id: "title", label: "Tiêu đề", defaultWidth: 300, minWidth: 210, sortKey: "title", cell: (item) => <AdminRowTitle href={`${baseHref}/${item.id}`} imageUrl={item.coverUrl} title={item.title} /> },
    ...(groupColumn ? [{ id: "group", label: groupColumn.label, defaultWidth: 190, minWidth: 140, cell: (item: AdminPostListItem) => item.categories.length ? <span>{item.categories.map((category) => category.name).join(", ")}</span> : <span className="admin-text-muted">{groupColumn.empty}</span> }] : []),
    ...(typeOptions.length > 1 || !groupColumn ? [{ id: "type", label: "Loại", defaultWidth: 170, minWidth: 130, sortKey: "type", cell: (item: AdminPostListItem) => <span className="admin-text-muted">{postTypeLabels[item.type]}</span> }] : []),
    { id: "status", label: "Trạng thái", defaultWidth: 150, minWidth: 130, sortKey: "status", cell: (item) => <AdminStatusBadge tone={statusTones[item.status]}>{statusLabels[item.status]}</AdminStatusBadge> },
    { id: "updatedAt", label: "Cập nhật", defaultWidth: 160, minWidth: 140, sortKey: "updatedAt", sortFirst: "desc", cell: (item) => <span className="admin-text-muted">{dateFormatter.format(new Date(item.updatedAt))}</span> },
    { id: "actions", label: "Thao tác", defaultWidth: 120, minWidth: 120, align: "right", cell: (item) => <AdminContentActions module="posts" deleteMutation={item.status === "archived" ? { method: "DELETE", url: `/api/v1/admin/posts/${item.id}`, body: { expectedVersion: item.draftVersion } } : undefined} editHref={`${baseHref}/${item.id}`} isArchived={item.status === "archived"} label={singularLabel} mutation={{ method: "PATCH", url: `/api/v1/admin/posts/${item.id}`, body: { action: item.status === "archived" ? "restore" : "archive", expectedVersion: item.draftVersion } }} viewHref={item.status === "published" ? getPublicPostPath(item) : undefined} /> },
  ], [baseHref, groupColumn, singularLabel, typeOptions.length]);

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

  // Cùng component cho Bài viết và Hướng dẫn: bảng xuất/nhập theo màn đang mở.
  const transferKind = baseHref.startsWith("/admin/guides") ? "guides" : "posts";
  return <AdminListPage variant="dense">
    <AdminCard>
      <AdminListHeader actions={<><DataTransferActions dataset={transferKind} label={transferKind === "guides" ? "Hướng dẫn" : "Bài viết"} module="posts" word={transferKind} />{showTaxonomyLink ? <AdminButton hideWithoutPermission permission="taxonomy.view" href="/admin/taxonomy" leadingIcon={<Tags aria-hidden="true" size={16} />} variant="secondary">Chuyên mục &amp; Thẻ</AdminButton> : null}<AdminButton hideWithoutPermission permission="posts.create" href={createHref} leadingIcon={<Plus aria-hidden="true" size={16} />}>{singularLabel === "bài viết" ? "Viết bài" : `Viết ${singularLabel}`}</AdminButton></>} description={`${result.total} ${singularLabel}${filtered ? " khớp bộ lọc" : ""}`} title={title} />
      {tabs}
      <AdminFilterBar chips={chips} more={typeOptions.length > 1 || tags.length ? <>
        {typeOptions.length > 1 ? <select aria-label="Lọc loại bài" onChange={(event) => setFilter("type", event.target.value || undefined)} value={typeFilter}><option value="">Tất cả loại</option>{typeOptions.map((type) => <option key={type} value={type}>{postTypeLabels[type]}</option>)}</select> : null}
        {tags.length ? <select aria-label="Lọc thẻ" onChange={(event) => setFilter("tagId", event.target.value || undefined)} value={tagFilter}><option value="">Tất cả thẻ</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select> : null}
      </> : undefined} moreActiveCount={[typeFilter, tagFilter].filter(Boolean).length} onClearAll={() => { setQuery(""); navigate({ page: undefined, query: undefined, status: undefined, type: undefined, categoryId: undefined, tagId: undefined }); }} onSubmit={submitSearch} search={<AdminSearchField id="post-search" label={`Tìm kiếm ${singularLabel}`} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tiêu đề hoặc slug" value={query} />}>
        <select aria-label="Lọc trạng thái" onChange={(event) => setFilter("status", event.target.value === "all" ? undefined : event.target.value)} value={initialStatus}><option value="all">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        {categories.length ? <select aria-label="Lọc chuyên mục" onChange={(event) => setFilter("categoryId", event.target.value || undefined)} value={categoryFilter}><option value="">Tất cả {(groupColumn?.label ?? "chuyên mục").toLocaleLowerCase("vi")}</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select> : null}
      </AdminFilterBar>
      <ContentBulkBar items={result.items} module="posts" noun={singularLabel} onClear={clear} request={(item, action) => ({ method: "PATCH", url: `/api/v1/admin/posts/${item.id}`, body: { action, expectedVersion: item.draftVersion } })} deleteRequest={(item) => ({ method: "DELETE", url: `/api/v1/admin/posts/${item.id}`, body: { expectedVersion: item.draftVersion } })} exportDataset={transferKind} extra={groupColumn ? <MoveToGroup categories={categories} group={groupColumn} items={result.items} noun={singularLabel} onDone={clear} selectedIds={selectedIds} /> : undefined} selectedIds={selectedIds} />
      <AdminDataTable columns={columns} emptyMessage={filtered ? "Không có nội dung khớp bộ lọc. Thử đổi từ khóa hoặc bộ lọc." : "Chưa có nội dung nào."} getRowId={(item) => item.id} getRowLabel={(item) => item.title} onSelectionChange={setSelectedIds} onSortChange={setSort} rows={result.items} selectedIds={selectedIds} sort={sort} tableId={`posts-${title.toLocaleLowerCase("vi").replaceAll(" ", "-")}`} />
      <AdminPagination unit={singularLabel} page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} {...pagination} />
    </AdminCard>
  </AdminListPage>;
}
