"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Plus, Search } from "lucide-react";

import type { AdminListPage as AdminListResult } from "@iorder/core/server/shared/admin-list.contract";
import { getFixedWebsitePage, type AdminPage } from "@iorder/core/server/pages/pages.contract";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { AdminContentActions } from "@/components/admin/ui/admin-content-actions";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/ui/admin-data-table";
import { AdminStatusBadge, type AdminFeedbackTone } from "@/components/admin/ui/admin-feedback";
import { AdminFilterBar } from "@/components/admin/ui/admin-filter-bar";
import { AdminListHeader } from "@/components/admin/ui/admin-list-header";
import { AdminListPage } from "@/components/admin/ui/admin-list-page";
import { AdminPagination } from "@/components/admin/ui/admin-pagination";

type PageStatus = AdminPage["status"];
const statusLabels: Record<PageStatus, string> = { draft: "Bản nháp", review: "Chờ duyệt", scheduled: "Hẹn giờ", published: "Đã xuất bản", archived: "Lưu trữ" };

function getPublicPath(page: AdminPage) { return getFixedWebsitePage(page.slug)?.publicPath ?? `/trang/${page.slug}`; }
function formatDate(value: Date | null) { return value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(value)) : "Chưa xuất bản"; }

type PagesManagerProps = {
  initialQuery: string;
  initialStatus: PageStatus | "all";
  result: AdminListResult<AdminPage>;
};

export function PagesManager({ initialQuery, initialStatus, result }: PagesManagerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const columns = useMemo<AdminDataTableColumn<AdminPage>[]>(() => [
    { id: "page", label: "Trang", defaultWidth: 300, minWidth: 210, cell: (page) => <Link className="block hover:text-blue-700" href={`/admin/pages/${page.id}`}><strong className="block text-[var(--cms-text)]">{page.title}</strong><span className="mt-1 block text-xs text-[var(--cms-muted)]">{getPublicPath(page)}</span></Link> },
    { id: "type", label: "Loại", defaultWidth: 160, minWidth: 130, cell: (page) => <Badge tone={getFixedWebsitePage(page.slug) ? "blue" : "slate"}>{getFixedWebsitePage(page.slug) ? "Trang cố định" : "Trang tự tạo"}</Badge> },
    { id: "status", label: "Trạng thái", defaultWidth: 150, minWidth: 130, cell: (page) => <StatusBadge status={page.status} /> },
    { id: "publishedAt", label: "Xuất bản", defaultWidth: 170, minWidth: 145, cell: (page) => <span className="text-[var(--cms-muted)]">{formatDate(page.publishedAt)}</span> },
    { id: "actions", label: "Thao tác", defaultWidth: 164, minWidth: 150, align: "right", cell: (page) => { const values = { ...page }; ["id", "draftVersion", "publishedAt", "updatedAt"].forEach((key) => Reflect.deleteProperty(values, key)); return <AdminContentActions deleteMutation={page.status === "archived" ? { method: "DELETE", url: `/api/admin/pages/${page.id}` } : undefined} editHref={`/admin/pages/${page.id}`} isArchived={page.status === "archived"} label="trang" mutation={{ method: "POST", url: "/api/admin/pages", body: { id: page.id, expectedVersion: page.draftVersion, values: { ...values, status: page.status === "archived" ? "draft" : "archived" } } }} viewHref={page.status === "published" ? getPublicPath(page) : undefined} />; } },
  ], []);

  function navigate(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => { if (value) next.set(key, value); else next.delete(key); });
    router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ page: undefined, query: query.trim() || undefined });
  }

 return (
  <AdminListPage variant="dense">
    <AdminCard className="grid gap-4 p-5 sm:p-6">
      <AdminListHeader
        actions={
          <Link
            className="admin-button admin-button--primary gap-1.5"
            href="/admin/pages/new"
          >
            <Plus aria-hidden="true" size={16} />
            Tạo trang
          </Link>
        }
        description="Quản lý nội dung, đường dẫn và trạng thái xuất bản của từng trang."
        title="Danh sách trang"
      />

      <AdminFilterBar
        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_190px]"
        onSubmit={submitSearch}
      >
        <div className="relative min-w-0">
          <input
            aria-label="Tìm trang"
            className="h-10 min-w-0 w-full rounded-lg border border-[var(--cms-border)] py-0 pl-3 pr-9 text-sm"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo tên hoặc đường dẫn"
            value={query}
          />

          <Search
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cms-muted)]"
            size={17}
          />
        </div>

        <select
          aria-label="Lọc theo trạng thái"
          className="h-10 rounded-lg border border-[var(--cms-border)] px-3 text-sm"
          onChange={(event) =>
            navigate({
              page: undefined,
              status:
                event.target.value === "all"
                  ? undefined
                  : event.target.value,
            })
          }
          value={initialStatus}
        >
          <option value="all">Tất cả trạng thái</option>

          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </AdminFilterBar>

      <AdminDataTable
        columns={columns}
        emptyMessage="Không tìm thấy trang phù hợp."
        getRowId={(page) => page.id}
        rows={result.items}
        tableId="pages"
      />

      <AdminPagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        totalPages={result.totalPages}
        onChange={(page) =>
          navigate({
            page: page === 1 ? undefined : String(page),
          })
        }
      />
    </AdminCard>
  </AdminListPage>
);
}

function Badge({ children, tone }: { children: string; tone: "blue" | "slate" }) { return <AdminStatusBadge tone={tone === "blue" ? "info" : "neutral"}>{children}</AdminStatusBadge>; }
function StatusBadge({ status }: { status: PageStatus }) { const tones: Record<PageStatus, AdminFeedbackTone> = { draft: "neutral", review: "warning", scheduled: "info", published: "success", archived: "neutral" }; return <AdminStatusBadge tone={tones[status]}>{statusLabels[status]}</AdminStatusBadge>; }
