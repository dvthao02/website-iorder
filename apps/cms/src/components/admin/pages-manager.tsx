"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";

import type { AdminListPage as AdminListResult } from "@iorder/core/server/shared/admin-list.contract";
import { getFixedWebsitePage, type AdminPage } from "@iorder/core/server/pages/pages.contract";
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

type PageStatus = AdminPage["status"];
const statusLabels: Record<PageStatus, string> = { draft: "Bản nháp", review: "Chờ duyệt", scheduled: "Hẹn giờ", published: "Đã xuất bản", archived: "Lưu trữ" };
const dateFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" });

function getPublicPath(page: AdminPage) { return getFixedWebsitePage(page.slug)?.publicPath ?? `/trang/${page.slug}`; }
function formatDate(value: Date | null) { return value ? dateFormatter.format(new Date(value)) : "Chưa xuất bản"; }

// Lưu trữ/khôi phục trang đi qua API lưu trang, nên gửi lại toàn bộ giá trị với trạng thái mới.
function pageStateRequest(page: AdminPage, status: PageStatus) {
  const values = { ...page };
  ["id", "draftVersion", "publishedAt", "updatedAt"].forEach((key) => Reflect.deleteProperty(values, key));
  return { method: "POST" as const, url: "/api/admin/pages", body: { id: page.id, expectedVersion: page.draftVersion, values: { ...values, status } } };
}

type PagesManagerProps = {
  initialQuery: string;
  initialStatus: PageStatus | "all";
  result: AdminListResult<AdminPage>;
};

export function PagesManager({ initialQuery, initialStatus, result }: PagesManagerProps) {
  const { navigate, searchParams, setFilter, setSort, sort } = useListNavigation();
  const [query, setQuery] = useState(initialQuery);
  const { selectedIds, setSelectedIds, clear } = useRowSelection(searchParams.toString());
  const chips: AdminFilterChip[] = [
    ...(initialQuery ? [{ key: "query", label: `Từ khóa: “${initialQuery}”`, onRemove: () => { setQuery(""); navigate({ page: undefined, query: undefined }); } }] : []),
    ...(initialStatus !== "all" ? [{ key: "status", label: `Trạng thái: ${statusLabels[initialStatus]}`, onRemove: () => setFilter("status", undefined) }] : []),
  ];
  const filtered = chips.length > 0;
  const columns = useMemo<AdminDataTableColumn<AdminPage>[]>(() => [
    { id: "page", label: "Trang", defaultWidth: 300, minWidth: 210, sortKey: "title", cell: (page) => <Link className="block hover:text-[var(--cms-primary)]" href={`/admin/pages/${page.id}`}><strong className="block">{page.title}</strong><span className="admin-field__hint block">{getPublicPath(page)}</span></Link> },
    { id: "type", label: "Loại", defaultWidth: 160, minWidth: 130, cell: (page) => <Badge tone={getFixedWebsitePage(page.slug) ? "blue" : "slate"}>{getFixedWebsitePage(page.slug)?.kind === "listing" ? "Trang danh sách" : getFixedWebsitePage(page.slug) ? "Trang cố định" : "Trang tự tạo"}</Badge> },
    { id: "status", label: "Trạng thái", defaultWidth: 150, minWidth: 130, sortKey: "status", cell: (page) => <StatusBadge status={page.status} /> },
    { id: "publishedAt", label: "Xuất bản", defaultWidth: 150, minWidth: 130, cell: (page) => <span className="admin-text-muted">{formatDate(page.publishedAt)}</span> },
    { id: "updatedAt", label: "Cập nhật", defaultWidth: 150, minWidth: 130, sortKey: "updatedAt", sortFirst: "desc", cell: (page) => <span className="admin-text-muted">{dateFormatter.format(new Date(page.updatedAt))}</span> },
    { id: "actions", label: "Thao tác", defaultWidth: 120, minWidth: 120, align: "right", cell: (page) => <AdminContentActions module="pages" deleteMutation={page.status === "archived" ? { method: "DELETE", url: `/api/admin/pages/${page.id}`, body: { expectedVersion: page.draftVersion } } : undefined} editHref={`/admin/pages/${page.id}`} isArchived={page.status === "archived"} label="trang" mutation={pageStateRequest(page, page.status === "archived" ? "draft" : "archived")} viewHref={page.status === "published" ? getPublicPath(page) : undefined} /> },
  ], []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ page: undefined, query: query.trim() || undefined });
  }

  return <AdminListPage variant="dense">
    <AdminCard>
      <AdminListHeader actions={<AdminButton hideWithoutPermission href="/admin/pages/new" leadingIcon={<Plus aria-hidden="true" size={16} />} permission="pages.create">Tạo trang</AdminButton>} description={`${result.total} trang${filtered ? " khớp bộ lọc" : ""}`} title="Trang website" />
      <AdminFilterBar onSubmit={submitSearch} chips={chips} onClearAll={() => { setQuery(""); navigate({ page: undefined, query: undefined, status: undefined }); }} search={<AdminSearchField label="Tìm trang" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc đường dẫn" value={query} />}>

        <select aria-label="Lọc theo trạng thái" onChange={(event) => setFilter("status", event.target.value === "all" ? undefined : event.target.value)} value={initialStatus}>
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </AdminFilterBar>
      <ContentBulkBar items={result.items} module="pages" noun="trang" onClear={clear} request={(page, action) => pageStateRequest(page, action === "archive" ? "archived" : "draft")} selectedIds={selectedIds} />
      <AdminDataTable columns={columns} emptyMessage={filtered ? "Không có trang khớp bộ lọc." : "Chưa có trang nào."} getRowId={(page) => page.id} onSelectionChange={setSelectedIds} onSortChange={setSort} rows={result.items} selectedIds={selectedIds} sort={sort} tableId="pages" />
      <AdminPagination page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} onChange={(page) => navigate({ page: page === 1 ? undefined : String(page) })} />
    </AdminCard>
  </AdminListPage>;
}

function Badge({ children, tone }: { children: string; tone: "blue" | "slate" }) { return <AdminStatusBadge tone={tone === "blue" ? "info" : "neutral"}>{children}</AdminStatusBadge>; }
function StatusBadge({ status }: { status: PageStatus }) { const tones: Record<PageStatus, AdminFeedbackTone> = { draft: "neutral", review: "warning", scheduled: "info", published: "success", archived: "neutral" }; return <AdminStatusBadge tone={tones[status]}>{statusLabels[status]}</AdminStatusBadge>; }
