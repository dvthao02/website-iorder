"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Plus, Settings2 } from "lucide-react";

import type { AdminOfferingListItem } from "@iorder/core/server/offerings/offering-content.contract";
import type { AdminListPage as AdminListResult } from "@iorder/core/server/shared/admin-list.contract";
import { AdminButton } from "@/components/admin/ui/admin-button";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { AdminContentActions } from "@/components/admin/ui/admin-content-actions";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/ui/admin-data-table";
import { AdminStatusBadge, type AdminFeedbackTone } from "@/components/admin/ui/admin-feedback";
import { AdminFilterBar } from "@/components/admin/ui/admin-filter-bar";
import { AdminListHeader } from "@/components/admin/ui/admin-list-header";
import { AdminListPage } from "@/components/admin/ui/admin-list-page";
import { AdminPagination } from "@/components/admin/ui/admin-pagination";

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
const publicCatalogPathByType: Record<AdminOfferingListItem["type"], string> = { software: "/phan-mem", solution: "/giai-phap", service: "/dich-vu", industry: "/nganh-nghe" };
function getPublicOfferingPath(item: AdminOfferingListItem) { return `${publicCatalogPathByType[item.type]}/${item.slug}`; }

export function OfferingManagerList({ baseHref, createHref, emptyMessage, initialQuery, initialStatus, result, singularLabel, title }: OfferingManagerListProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  const columns = useMemo<AdminDataTableColumn<AdminOfferingListItem>[]>(() => [
    { id: "title", label: `Tên ${singularLabel.toLocaleLowerCase("vi")}`, defaultWidth: 280, minWidth: 200, cell: (item) => <Link className="font-bold text-[var(--cms-text)] hover:text-blue-700" href={`${baseHref}/${item.id}`}>{item.title}</Link> },
    { id: "slug", label: "Slug", defaultWidth: 180, minWidth: 140, cell: (item) => <span className="text-[var(--cms-muted)]">{item.slug}</span> },
    { id: "status", label: "Trạng thái", defaultWidth: 150, minWidth: 130, cell: (item) => <AdminStatusBadge tone={statusTones[item.status]}>{statusLabels[item.status]}</AdminStatusBadge> },
    { id: "updatedAt", label: "Cập nhật", defaultWidth: 170, minWidth: 145, cell: (item) => <span className="text-[var(--cms-muted)]">{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(item.updatedAt))}</span> },
    { id: "actions", label: "Thao tác", defaultWidth: 164, minWidth: 150, align: "right", cell: (item) => <AdminContentActions deleteMutation={item.status === "archived" ? { method: "DELETE", url: `/api/admin/offerings/${item.id}`, body: { expectedVersion: item.draftVersion } } : undefined} editHref={`${baseHref}/${item.id}`} isArchived={item.status === "archived"} label={singularLabel} mutation={{ method: "PATCH", url: `/api/admin/offerings/${item.id}?type=${item.type}`, body: { action: item.status === "archived" ? "restore" : "archive", expectedVersion: item.draftVersion } }} viewHref={item.status === "published" ? getPublicOfferingPath(item) : undefined} /> },
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
    <AdminCard className="grid gap-4 p-5 sm:p-6">
      <AdminListHeader actions={<><AdminButton onClick={() => setIsColumnSettingsOpen(true)} variant="secondary"><Settings2 aria-hidden="true" size={16} />Cài đặt cột</AdminButton><AdminButton href={createHref} leadingIcon={<Plus aria-hidden="true" size={16} />}>Tạo {singularLabel.toLocaleLowerCase("vi")}</AdminButton></>} description="Quản lý nội dung, trạng thái xuất bản và thông tin hiển thị của từng mục." title={`Danh sách ${singularLabel.toLocaleLowerCase("vi")}`} />
      <AdminFilterBar className="grid gap-3 border-y border-[var(--cms-border)] py-4 sm:grid-cols-[minmax(0,1fr)_190px_auto]" onSubmit={submitSearch}><label className="sr-only" htmlFor="offering-search">Tìm kiếm {singularLabel.toLocaleLowerCase("vi")}</label><input className="h-10 w-full rounded-xl border border-[var(--cms-border)] bg-[var(--cms-card)] px-3 text-sm text-[var(--cms-text)] outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100" id="offering-search" onChange={(event) => setQuery(event.target.value)} placeholder={`Tìm theo tên hoặc slug ${singularLabel.toLocaleLowerCase("vi")}...`} value={query} /><label className="sr-only" htmlFor="offering-status">Lọc theo trạng thái</label><select className="h-10 rounded-xl border border-[var(--cms-border)] bg-[var(--cms-card)] px-3 text-sm font-semibold text-[var(--cms-text)] outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" id="offering-status" onChange={(event) => navigate({ page: undefined, status: event.target.value === "all" ? undefined : event.target.value })} value={initialStatus}><option value="all">Tất cả trạng thái</option><option value="draft">Bản nháp</option><option value="review">Chờ duyệt</option><option value="scheduled">Hẹn giờ</option><option value="published">Đã xuất bản</option><option value="archived">Lưu trữ</option></select><button className="rounded-xl border border-[var(--cms-border)] px-3 text-sm font-bold text-[var(--cms-text)] hover:bg-[var(--cms-hover)]" type="submit">Tìm</button></AdminFilterBar>
      <AdminDataTable columns={columns} emptyMessage={emptyMessage} getRowId={(item) => item.id} onSettingsOpenChange={setIsColumnSettingsOpen} rows={result.items} settingsOpen={isColumnSettingsOpen} showSettingsButton={false} tableId={`offering-${title.toLocaleLowerCase("vi").replaceAll(" ", "-")}`} />
      <AdminPagination page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} onChange={(page) => navigate({ page: page === 1 ? undefined : String(page) })} />
    </AdminCard>
  </AdminListPage>;
}

