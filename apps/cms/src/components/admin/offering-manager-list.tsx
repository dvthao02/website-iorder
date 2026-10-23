"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { ChevronDown, Plus } from "lucide-react";

import type { AdminOfferingListItem, PublicOfferingType } from "@iorder/core/server/offerings/offering-content.contract";
import type { AdminListPage as AdminListResult } from "@iorder/core/server/shared/admin-list.contract";
import { AdminButton } from "@/components/admin/ui/admin-button";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { AdminContentActions } from "@/components/admin/ui/admin-content-actions";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/ui/admin-data-table";
import { AdminStatusBadge, type AdminFeedbackTone } from "@/components/admin/ui/admin-feedback";
import { AdminFilterBar, type AdminFilterChip } from "@/components/admin/ui/admin-filter-bar";
import { AdminFilterTabs } from "@/components/admin/ui/admin-filter-tabs";
import { AdminListHeader } from "@/components/admin/ui/admin-list-header";
import { AdminListPage } from "@/components/admin/ui/admin-list-page";
import { useAdminPermissions } from "@/components/admin/ui/admin-permissions";
import { AdminPopover } from "@/components/admin/ui/admin-popover";
import { AdminSearchField } from "@/components/admin/ui/admin-search-field";
import { AdminPagination } from "@/components/admin/ui/admin-pagination";
import { ContentBulkBar, useRowSelection } from "@/components/admin/ui/content-bulk-bar";
import { useListNavigation } from "@/components/admin/ui/use-list-navigation";

export type OfferingTypeFilter = "all" | PublicOfferingType;

type OfferingManagerListProps = {
  initialQuery: string;
  initialStatus: "all" | AdminOfferingListItem["status"];
  initialType: OfferingTypeFilter;
  result: AdminListResult<AdminOfferingListItem>;
};

const statusLabels: Record<AdminOfferingListItem["status"], string> = { archived: "Lưu trữ", draft: "Bản nháp", published: "Đã xuất bản", review: "Chờ duyệt", scheduled: "Hẹn giờ" };
const statusTones: Record<AdminOfferingListItem["status"], AdminFeedbackTone> = { archived: "error", draft: "neutral", published: "success", review: "warning", scheduled: "info" };
// Ba loại dùng chung một màn danh sách; trang sửa vẫn theo từng loại để giữ nguyên URL đã có.
export const offeringTypes: Array<{ type: PublicOfferingType; label: string; editorHref: string; publicPath: string; hint: string }> = [
  { type: "software", label: "Sản phẩm", editorHref: "/admin/products", publicPath: "/phan-mem", hint: "Phần mềm, ứng dụng" },
  { type: "solution", label: "Giải pháp", editorHref: "/admin/solutions", publicPath: "/giai-phap", hint: "Hạ tầng, thiết bị trọn gói" },
  { type: "service", label: "Dịch vụ", editorHref: "/admin/services", publicPath: "/dich-vu", hint: "Tư vấn, triển khai, phát triển theo yêu cầu" },
];
const typeInfo = Object.fromEntries(offeringTypes.map((entry) => [entry.type, entry])) as Record<PublicOfferingType, (typeof offeringTypes)[number]>;

function CreateOfferingButton({ type }: { type: OfferingTypeFilter }) {
  const { can } = useAdminPermissions();
  if (!can("offerings.create")) return null;
  if (type !== "all") return <AdminButton href={`${typeInfo[type].editorHref}/moi`} leadingIcon={<Plus aria-hidden="true" size={16} />}>Tạo {typeInfo[type].label.toLocaleLowerCase("vi")}</AdminButton>;
  return <AdminPopover className="admin-create-menu" label="Chọn loại cần tạo" trigger={<span className="admin-button admin-button--primary"><Plus aria-hidden="true" size={16} />Tạo mới<ChevronDown aria-hidden="true" size={14} /></span>}>
    <div className="admin-header-popover admin-header-popover--menu">{offeringTypes.map((entry) => <Link href={`${entry.editorHref}/moi`} key={entry.type}><strong>{entry.label}</strong><small>{entry.hint}</small></Link>)}</div>
  </AdminPopover>;
}

export function OfferingManagerList({ initialQuery, initialStatus, initialType, result }: OfferingManagerListProps) {
  const { navigate, searchParams, setFilter, setSort, sort } = useListNavigation();
  const [query, setQuery] = useState(initialQuery);
  const { selectedIds, setSelectedIds, clear } = useRowSelection(searchParams.toString());
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  const noun = initialType === "all" ? "mục" : typeInfo[initialType].label.toLocaleLowerCase("vi");
  const columns = useMemo<AdminDataTableColumn<AdminOfferingListItem>[]>(() => [
    { id: "title", label: "Tên", defaultWidth: 300, minWidth: 200, sortKey: "title", cell: (item) => <Link href={`${typeInfo[item.type].editorHref}/${item.id}`}>{item.title}</Link> },
    ...(initialType === "all" ? [{ id: "type", label: "Loại", defaultWidth: 120, minWidth: 100, cell: (item: AdminOfferingListItem) => <span>{typeInfo[item.type].label}</span> }] : []),
    { id: "slug", label: "Slug", defaultWidth: 180, minWidth: 140, cell: (item) => <span className="admin-text-muted">{item.slug}</span> },
    { id: "status", label: "Trạng thái", defaultWidth: 150, minWidth: 130, sortKey: "status", cell: (item) => <AdminStatusBadge tone={statusTones[item.status]}>{statusLabels[item.status]}</AdminStatusBadge> },
    { id: "updatedAt", label: "Cập nhật", defaultWidth: 170, minWidth: 145, sortKey: "updatedAt", sortFirst: "desc", cell: (item) => <span className="admin-text-muted">{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(item.updatedAt))}</span> },
    { id: "actions", label: "Thao tác", defaultWidth: 120, minWidth: 120, align: "right", cell: (item) => <AdminContentActions module="offerings" deleteMutation={item.status === "archived" ? { method: "DELETE", url: `/api/admin/offerings/${item.id}`, body: { expectedVersion: item.draftVersion } } : undefined} editHref={`${typeInfo[item.type].editorHref}/${item.id}`} isArchived={item.status === "archived"} label={typeInfo[item.type].label} mutation={{ method: "PATCH", url: `/api/admin/offerings/${item.id}?type=${item.type}`, body: { action: item.status === "archived" ? "restore" : "archive", expectedVersion: item.draftVersion } }} viewHref={item.status === "published" ? `${typeInfo[item.type].publicPath}/${item.slug}` : undefined} /> },
  ], [initialType]);

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
      <AdminListHeader actions={<CreateOfferingButton type={initialType} />} description={`${result.total} ${noun}${filtered ? " khớp bộ lọc" : ""}`} title="Sản phẩm & Dịch vụ" />
      <AdminFilterTabs<OfferingTypeFilter> restoreNavigationFocus ariaLabel="Loại nội dung" items={[{ label: "Tất cả", value: "all" }, ...offeringTypes.map((entry) => ({ label: entry.label, value: entry.type }))]} onValueChange={(value) => { clear(); setFilter("type", value === "all" ? undefined : value); }} value={initialType} />
      <AdminFilterBar onSubmit={submitSearch} chips={chips} onClearAll={() => { setQuery(""); navigate({ page: undefined, query: undefined, status: undefined }); }} search={<AdminSearchField id="offering-search" label={`Tìm kiếm ${noun}`} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc slug" value={query} />}><label className="sr-only" htmlFor="offering-status">Lọc theo trạng thái</label><select id="offering-status" onChange={(event) => setFilter("status", event.target.value === "all" ? undefined : event.target.value)} value={initialStatus}><option value="all">Tất cả trạng thái</option><option value="draft">Bản nháp</option><option value="review">Chờ duyệt</option><option value="scheduled">Hẹn giờ</option><option value="published">Đã xuất bản</option><option value="archived">Lưu trữ</option></select></AdminFilterBar>
      <ContentBulkBar items={result.items} module="offerings" noun={noun} onClear={clear} request={(item, action) => ({ method: "PATCH", url: `/api/admin/offerings/${item.id}?type=${item.type}`, body: { action, expectedVersion: item.draftVersion } })} selectedIds={selectedIds} />
      <AdminDataTable columns={columns} emptyMessage={filtered ? "Không có mục khớp bộ lọc. Thử đổi từ khóa hoặc trạng thái." : `Chưa có ${noun} nào.`} getRowId={(item) => item.id} onSelectionChange={setSelectedIds} onSettingsOpenChange={setIsColumnSettingsOpen} onSortChange={setSort} rows={result.items} selectedIds={selectedIds} settingsOpen={isColumnSettingsOpen} sort={sort} tableId={initialType === "all" ? "offerings-all" : `offerings-${initialType}`} />
      <AdminPagination page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} onChange={(page) => navigate({ page: page === 1 ? undefined : String(page) })} />
    </AdminCard>
  </AdminListPage>;
}
