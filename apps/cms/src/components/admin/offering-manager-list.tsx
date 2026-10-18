"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";

import type { AdminOfferingListItem } from "@iorder/core/server/offerings/offering-content.contract";
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

type OfferingManagerListProps = {
  baseHref: string;
  createHref: string;
  emptyMessage: string;
  initialQuery: string;
  initialStatus: "all" | AdminOfferingListItem["status"];
  result: AdminListResult<AdminOfferingListItem>;
  singularLabel: string;
  title: string;
};

const statusLabels: Record<AdminOfferingListItem["status"], string> = { archived: "Lưu trữ", draft: "Bản nháp", published: "Đã xuất bản", review: "Chờ duyệt", scheduled: "Hẹn giờ" };
const statusTones: Record<AdminOfferingListItem["status"], AdminFeedbackTone> = { archived: "error", draft: "neutral", published: "success", review: "warning", scheduled: "info" };
const publicCatalogPathByType: Record<AdminOfferingListItem["type"], string> = { software: "/phan-mem", solution: "/giai-phap", service: "/dich-vu" };
function getPublicOfferingPath(item: AdminOfferingListItem) { return `${publicCatalogPathByType[item.type]}/${item.slug}`; }

export function OfferingManagerList({ baseHref, createHref, emptyMessage, initialQuery, initialStatus, result, singularLabel, title }: OfferingManagerListProps) {
  const { navigate, searchParams, setFilter, setSort, sort } = useListNavigation();
  const [query, setQuery] = useState(initialQuery);
  const { selectedIds, setSelectedIds, clear } = useRowSelection(searchParams.toString());
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  const columns = useMemo<AdminDataTableColumn<AdminOfferingListItem>[]>(() => [
    { id: "title", label: `Tên ${singularLabel.toLocaleLowerCase("vi")}`, defaultWidth: 280, minWidth: 200, sortKey: "title", cell: (item) => <Link href={`${baseHref}/${item.id}`}>{item.title}</Link> },
    { id: "slug", label: "Slug", defaultWidth: 180, minWidth: 140, cell: (item) => <span className="admin-text-muted">{item.slug}</span> },
    { id: "status", label: "Trạng thái", defaultWidth: 150, minWidth: 130, sortKey: "status", cell: (item) => <AdminStatusBadge tone={statusTones[item.status]}>{statusLabels[item.status]}</AdminStatusBadge> },
    { id: "updatedAt", label: "Cập nhật", defaultWidth: 170, minWidth: 145, sortKey: "updatedAt", sortFirst: "desc", cell: (item) => <span className="admin-text-muted">{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(item.updatedAt))}</span> },
    { id: "actions", label: "Thao tác", defaultWidth: 120, minWidth: 120, align: "right", cell: (item) => <AdminContentActions module="offerings" deleteMutation={item.status === "archived" ? { method: "DELETE", url: `/api/admin/offerings/${item.id}`, body: { expectedVersion: item.draftVersion } } : undefined} editHref={`${baseHref}/${item.id}`} isArchived={item.status === "archived"} label={singularLabel} mutation={{ method: "PATCH", url: `/api/admin/offerings/${item.id}?type=${item.type}`, body: { action: item.status === "archived" ? "restore" : "archive", expectedVersion: item.draftVersion } }} viewHref={item.status === "published" ? getPublicOfferingPath(item) : undefined} /> },
  ], [baseHref, singularLabel]);

  const chips: AdminFilterChip[] = [
    ...(initialQuery ? [{ key: "query", label: `Từ khóa: “${initialQuery}”`, onRemove: () => { setQuery(""); navigate({ page: undefined, query: undefined }); } }] : []),
    ...(initialStatus !== "all" ? [{ key: "status", label: `Trạng thái: ${statusLabels[initialStatus]}`, onRemove: () => setFilter("status", undefined) }] : []),
  ];
  const filtered = chips.length > 0;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ page: undefined, query: query.trim() || undefined });
  }

  return <AdminListPage variant="dense">
    <AdminCard>
      <AdminListHeader actions={<><AdminButton hideWithoutPermission permission="offerings.create" href={createHref} leadingIcon={<Plus aria-hidden="true" size={16} />}>Tạo {singularLabel.toLocaleLowerCase("vi")}</AdminButton></>} description={`${result.total} ${singularLabel.toLocaleLowerCase("vi")}${filtered ? " khớp bộ lọc" : ""}`} title={title} />
      <AdminFilterBar onSubmit={submitSearch} chips={chips} onClearAll={() => { setQuery(""); navigate({ page: undefined, query: undefined, status: undefined }); }} search={<AdminSearchField id="offering-search" label={`Tìm kiếm ${singularLabel.toLocaleLowerCase("vi")}`} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc slug" value={query} />}><label className="sr-only" htmlFor="offering-status">Lọc theo trạng thái</label><select id="offering-status" onChange={(event) => setFilter("status", event.target.value === "all" ? undefined : event.target.value)} value={initialStatus}><option value="all">Tất cả trạng thái</option><option value="draft">Bản nháp</option><option value="review">Chờ duyệt</option><option value="scheduled">Hẹn giờ</option><option value="published">Đã xuất bản</option><option value="archived">Lưu trữ</option></select></AdminFilterBar>
      <ContentBulkBar items={result.items} module="offerings" noun={singularLabel.toLocaleLowerCase("vi")} onClear={clear} request={(item, action) => ({ method: "PATCH", url: `/api/admin/offerings/${item.id}?type=${item.type}`, body: { action, expectedVersion: item.draftVersion } })} selectedIds={selectedIds} />
      <AdminDataTable columns={columns} emptyMessage={filtered ? "Không có mục khớp bộ lọc. Thử đổi từ khóa hoặc trạng thái." : emptyMessage} getRowId={(item) => item.id} onSelectionChange={setSelectedIds} onSettingsOpenChange={setIsColumnSettingsOpen} onSortChange={setSort} rows={result.items} selectedIds={selectedIds} settingsOpen={isColumnSettingsOpen} sort={sort} tableId={`offering-${title.toLocaleLowerCase("vi").replaceAll(" ", "-")}`} />
      <AdminPagination page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} onChange={(page) => navigate({ page: page === 1 ? undefined : String(page) })} />
    </AdminCard>
  </AdminListPage>;
}

