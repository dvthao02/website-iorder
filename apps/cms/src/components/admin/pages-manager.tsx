"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { Eye, Pencil, Plus } from "lucide-react";

import type { AdminListPage as AdminListResult } from "@iorder/core/server/shared/admin-list.contract";
import { getFixedWebsitePage, isListingPageSlug, type AdminPageListItem as AdminPage } from "@iorder/core/server/pages/pages.contract";
import type { ContentStateAction } from "@iorder/core/server/shared/content-version";
import { AdminButton } from "@/components/admin/ui/admin-button";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { AdminContentActions } from "@/components/admin/ui/admin-content-actions";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/ui/admin-data-table";
import { AdminStatusBadge, type AdminFeedbackTone } from "@/components/admin/ui/admin-feedback";
import { AdminFilterBar, type AdminFilterChip } from "@/components/admin/ui/admin-filter-bar";
import { AdminFilterTabs } from "@/components/admin/ui/admin-filter-tabs";
import { AdminListHeader } from "@/components/admin/ui/admin-list-header";
import { AdminListPage } from "@/components/admin/ui/admin-list-page";
import { AdminSearchField } from "@/components/admin/ui/admin-search-field";
import { AdminPagination } from "@/components/admin/ui/admin-pagination";
import { ContentBulkBar, useRowSelection } from "@/components/admin/ui/content-bulk-bar";
import { useListNavigation } from "@/components/admin/ui/use-list-navigation";
import { listingPageModuleHref, listingPageModuleLabel } from "@/lib/listing-pages";
import { publishedPublicUrl } from "@/lib/published-public-url";

type PageStatus = AdminPage["status"];
export type StaticPageType = "all" | "standard" | "listing" | "custom";
const statusLabels: Record<PageStatus, string> = { draft: "Bản nháp", review: "Chờ duyệt", scheduled: "Hẹn giờ", published: "Đã xuất bản", archived: "Lưu trữ" };
const typeTabs: Array<{ value: StaticPageType; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "standard", label: "Trang nội dung" },
  { value: "listing", label: "Trang danh sách" },
  { value: "custom", label: "Trang tự tạo" },
];
const emptyMessages: Record<StaticPageType, string> = {
  all: "Chưa có trang nào.",
  standard: "Chưa có trang nội dung.",
  listing: "Chưa có trang danh sách.",
  custom: "Chưa có trang tự tạo. Dùng “Tạo trang” cho trang landing, khuyến mãi… (hiện ở /trang/<đường dẫn>), rồi thêm vào Menu.",
};
const dateFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" });

function getPublicPath(page: AdminPage) { return getFixedWebsitePage(page.slug)?.publicPath ?? `/trang/${page.slug}`; }
const isCustomPage = (page: AdminPage) => !getFixedWebsitePage(page.slug);

// Server tự đọc trang đầy đủ (kèm khối) rồi lưu với trạng thái mới; danh sách không cần giữ khối.
function pageStateRequest(page: AdminPage, action: ContentStateAction) {
  return { method: "PATCH" as const, url: `/api/admin/pages/${page.id}`, body: { action, expectedVersion: page.draftVersion } };
}

// Loại trang, một dòng: trang danh sách kèm module cấp nội dung (bấm để sang module đó).
function PageKind({ page }: { page: AdminPage }) {
  if (isListingPageSlug(page.slug)) return <span className="admin-page-kind">Danh sách <span aria-hidden="true">·</span> <Link href={listingPageModuleHref[page.slug]} title={`Nội dung lấy từ ${listingPageModuleLabel[page.slug]}`}>{listingPageModuleLabel[page.slug]}</Link></span>;
  return <span className="admin-page-kind">{isCustomPage(page) ? "Tự tạo" : "Nội dung"}</span>;
}

// Trang có sẵn (đường dẫn thuộc code): chỉ xem và sửa nội dung, không lưu trữ hay xóa được.
function FixedPageActions({ page }: { page: AdminPage }) {
  return <span className="admin-content-actions">
    {page.status === "published" ? <Link aria-label={`Xem trang ${page.title}`} className="admin-content-actions__button admin-content-actions__view" href={publishedPublicUrl(getPublicPath(page))} rel="noreferrer" target="_blank" title="Xem trang"><Eye aria-hidden="true" size={16} /></Link> : null}
    <Link aria-label={`Chỉnh sửa trang ${page.title}`} className="admin-content-actions__button admin-content-actions__edit" href={`/admin/pages/${page.id}`} title="Chỉnh sửa trang"><Pencil aria-hidden="true" size={16} /></Link>
  </span>;
}

type PagesManagerProps = {
  counts: Record<StaticPageType, number>;
  initialQuery: string;
  initialStatus: PageStatus | "all";
  initialType: StaticPageType;
  result: AdminListResult<AdminPage>;
};

/**
 * Màn "Trang tĩnh": mọi trang trừ Trang chủ (có mục riêng) trong một bảng — trang nội dung có sẵn (Giới thiệu, Liên hệ,
 * Chính sách…), trang danh sách (phần đầu và SEO của /tin-tuc, /thiet-bi…) và trang tự tạo; tab lọc theo loại.
 * Chỉ trang tự tạo chọn được để lưu trữ/xóa hàng loạt (trang có sẵn do code quản lý đường dẫn).
 */
export function PagesManager({ counts, initialQuery, initialStatus, initialType, result }: PagesManagerProps) {
  const { navigate, pagination, searchParams, setFilter, setSort, sort } = useListNavigation();
  const [query, setQuery] = useState(initialQuery);
  const { selectedIds, setSelectedIds, clear } = useRowSelection(searchParams.toString());
  const chips: AdminFilterChip[] = [
    ...(initialQuery ? [{ key: "query", label: `Từ khóa: “${initialQuery}”`, onRemove: () => { setQuery(""); navigate({ page: undefined, query: undefined }); } }] : []),
    ...(initialStatus !== "all" ? [{ key: "status", label: `Trạng thái: ${statusLabels[initialStatus]}`, onRemove: () => setFilter("status", undefined) }] : []),
  ];
  const filtered = chips.length > 0;
  // Chỉ trang tự tạo chọn được (lưu trữ/xóa hàng loạt); trang này không có trang tự tạo thì bỏ hẳn cột ô chọn.
  const selectable = result.items.some(isCustomPage);
  const columns = useMemo<AdminDataTableColumn<AdminPage>[]>(() => [
    { id: "page", label: "Trang", defaultWidth: 320, minWidth: 220, sortKey: "title", cell: (page) => <Link className="block hover:text-[var(--cms-primary)]" href={`/admin/pages/${page.id}`}><strong className="block">{page.title}</strong><span className="admin-field__hint block">{getPublicPath(page)}</span></Link> },
    { id: "kind", label: "Loại", defaultWidth: 240, minWidth: 160, cell: (page) => <PageKind page={page} /> },
    { id: "status", label: "Trạng thái", defaultWidth: 140, minWidth: 120, sortKey: "status", cell: (page) => <StatusBadge status={page.status} /> },
    { id: "updatedAt", label: "Cập nhật", defaultWidth: 140, minWidth: 120, sortKey: "updatedAt", sortFirst: "desc", cell: (page) => <span className="admin-text-muted">{dateFormatter.format(new Date(page.updatedAt))}</span> },
    { id: "actions", label: "Thao tác", defaultWidth: 120, minWidth: 120, align: "right", cell: (page) => isCustomPage(page)
      ? <AdminContentActions module="pages" deleteMutation={page.status === "archived" ? { method: "DELETE", url: `/api/admin/pages/${page.id}`, body: { expectedVersion: page.draftVersion } } : undefined} editHref={`/admin/pages/${page.id}`} isArchived={page.status === "archived"} label="trang" mutation={pageStateRequest(page, page.status === "archived" ? "restore" : "archive")} viewHref={page.status === "published" ? getPublicPath(page) : undefined} />
      : <FixedPageActions page={page} /> },
  ], []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ page: undefined, query: query.trim() || undefined });
  }

  return <AdminListPage variant="dense">
    <AdminCard>
      <AdminListHeader actions={<AdminButton hideWithoutPermission href="/admin/pages/new" leadingIcon={<Plus aria-hidden="true" size={16} />} permission="pages.create">Tạo trang</AdminButton>} description={`${result.total} trang${filtered ? " khớp bộ lọc" : ""}`} title="Trang tĩnh" />
      <AdminFilterTabs<StaticPageType> restoreNavigationFocus ariaLabel="Loại trang" items={typeTabs.map((tab) => ({ value: tab.value, label: `${tab.label} (${counts[tab.value]})` }))} onValueChange={(value) => { clear(); setFilter("type", value === "all" ? undefined : value); }} value={initialType} />
      <AdminFilterBar onSubmit={submitSearch} chips={chips} onClearAll={() => { setQuery(""); navigate({ page: undefined, query: undefined, status: undefined }); }} search={<AdminSearchField label="Tìm trang" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc đường dẫn" value={query} />}>
        <select aria-label="Lọc theo trạng thái" onChange={(event) => setFilter("status", event.target.value === "all" ? undefined : event.target.value)} value={initialStatus}>
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </AdminFilterBar>
      <ContentBulkBar deleteRequest={(page) => ({ method: "DELETE", url: `/api/admin/pages/${page.id}`, body: { expectedVersion: page.draftVersion } })} items={result.items} module="pages" noun="trang" onClear={clear} request={pageStateRequest} selectedIds={selectedIds} />
      <AdminDataTable columns={columns} emptyMessage={filtered ? "Không có trang khớp bộ lọc." : emptyMessages[initialType]} getRowId={(page) => page.id} isRowSelectable={isCustomPage} onSelectionChange={selectable ? setSelectedIds : undefined} onSortChange={setSort} rows={result.items} selectedIds={selectable ? selectedIds : undefined} sort={sort} tableId="static-pages" />
      <AdminPagination unit="trang" page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} {...pagination} />
    </AdminCard>
  </AdminListPage>;
}

function StatusBadge({ status }: { status: PageStatus }) { const tones: Record<PageStatus, AdminFeedbackTone> = { draft: "neutral", review: "warning", scheduled: "info", published: "success", archived: "neutral" }; return <AdminStatusBadge tone={tones[status]}>{statusLabels[status]}</AdminStatusBadge>; }
