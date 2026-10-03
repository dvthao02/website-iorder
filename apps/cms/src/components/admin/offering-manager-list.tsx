"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Settings2 } from "lucide-react";

import type { AdminOffering } from "@iorder/core/server/offerings/offering-content.contract";
import { AdminButton } from "@/components/admin/ui/admin-button";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { AdminContentActions } from "@/components/admin/ui/admin-content-actions";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/ui/admin-data-table";
import { AdminStatusBadge, type AdminFeedbackTone } from "@/components/admin/ui/admin-feedback";

type OfferingManagerListProps = {
  baseHref: string;
  createHref: string;
  emptyMessage: string;
  items: AdminOffering[];
  singularLabel: string;
  title: string;
};

const statusLabels: Record<AdminOffering["status"], string> = {
  archived: "Lưu trữ",
  draft: "Bản nháp",
  published: "Đã xuất bản",
  review: "Chờ duyệt",
  scheduled: "Hẹn giờ",
};
const statusTones: Record<AdminOffering["status"], AdminFeedbackTone> = { archived: "error", draft: "neutral", published: "success", review: "warning", scheduled: "info" };
const publicCatalogPathByType: Record<AdminOffering["type"], string> = { software: "/phan-mem", solution: "/giai-phap", service: "/dich-vu", industry: "/nganh-nghe" };
function getPublicOfferingPath(item: AdminOffering) { return `${publicCatalogPathByType[item.type]}/${item.slug}`; }

const pageSize = 10;

export function OfferingManagerList({ baseHref, createHref, emptyMessage, items, singularLabel, title }: OfferingManagerListProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | AdminOffering["status"]>("all");
  const [page, setPage] = useState(1);
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  const filteredItems = useMemo(() => items.filter((item) => {
    const matchesQuery = item.title.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")) || item.slug.includes(query.trim().toLocaleLowerCase("vi"));
    return matchesQuery && (status === "all" || item.status === status);
  }), [items, query, status]);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const published = items.filter((item) => item.status === "published").length;
  const waiting = items.filter((item) => item.status === "draft" || item.status === "review").length;
  const columns = useMemo<AdminDataTableColumn<AdminOffering>[]>(() => [
    { id: "title", label: `Tên ${singularLabel.toLocaleLowerCase("vi")}`, defaultWidth: 280, minWidth: 200, cell: (item) => <Link className="font-bold text-slate-900 hover:text-blue-700" href={`${baseHref}/${item.id}`}>{item.title}</Link> },
    { id: "slug", label: "Slug", defaultWidth: 180, minWidth: 140, cell: (item) => <span className="text-slate-600">{item.slug}</span> },
    { id: "status", label: "Trạng thái", defaultWidth: 150, minWidth: 130, cell: (item) => <AdminStatusBadge tone={statusTones[item.status]}>{statusLabels[item.status]}</AdminStatusBadge> },
    { id: "updatedAt", label: "Cập nhật", defaultWidth: 170, minWidth: 145, cell: (item) => <span className="text-slate-600">{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(item.updatedAt))}</span> },
    { id: "actions", label: "Thao tác", defaultWidth: 164, minWidth: 150, align: "right", cell: (item) => { const values = { ...item }; ["id", "draftVersion", "publishedAt", "updatedAt"].forEach((key) => Reflect.deleteProperty(values, key)); return <AdminContentActions deleteMutation={item.status === "archived" ? { method: "DELETE", url: `/api/admin/offerings/${item.id}` } : undefined} editHref={`${baseHref}/${item.id}`} isArchived={item.status === "archived"} label={singularLabel} mutation={{ method: "PATCH", url: `/api/admin/offerings/${item.id}`, body: { ...values, status: item.status === "archived" ? "draft" : "archived" } }} viewHref={item.status === "published" ? getPublicOfferingPath(item) : undefined} />; } },
  ], [baseHref, singularLabel]);

  function changeFilter(nextStatus: "all" | AdminOffering["status"]) {
    setStatus(nextStatus);
    setPage(1);
  }

  return <div className="grid gap-5">
    <section className="grid gap-3 sm:grid-cols-3" aria-label={`Tóm tắt ${title}`}>
      <AdminCard className="p-5"><p className="text-sm font-semibold text-slate-600">Tổng {singularLabel.toLocaleLowerCase("vi")}</p><strong className="mt-2 block text-3xl font-extrabold text-slate-950">{items.length}</strong></AdminCard>
      <AdminCard className="p-5"><p className="text-sm font-semibold text-slate-600">Đã xuất bản</p><strong className="mt-2 block text-3xl font-extrabold text-emerald-700">{published}</strong></AdminCard>
      <AdminCard className="p-5"><p className="text-sm font-semibold text-slate-600">Cần xử lý</p><strong className="mt-2 block text-3xl font-extrabold text-amber-700">{waiting}</strong></AdminCard>
    </section>

    <AdminCard className="grid gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-extrabold text-slate-950">Danh sách {singularLabel.toLocaleLowerCase("vi")}</h2><p className="mt-1 text-sm text-slate-600">Chọn một mục để mở màn hình chỉnh sửa riêng.</p></div>
        <div className="flex items-center gap-2">
          <AdminButton onClick={() => setIsColumnSettingsOpen(true)} variant="secondary"><Settings2 aria-hidden="true" size={16} />Cài đặt cột</AdminButton>
          <AdminButton href={createHref}>Tạo {singularLabel.toLocaleLowerCase("vi")}</AdminButton>
        </div>
      </div>
      <div className="grid gap-3 border-y border-slate-100 py-4 sm:grid-cols-[minmax(0,1fr)_190px]">
        <label className="sr-only" htmlFor="offering-search">Tìm kiếm {singularLabel.toLocaleLowerCase("vi")}</label>
        <input className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100" id="offering-search" onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={`Tìm theo tên hoặc slug ${singularLabel.toLocaleLowerCase("vi")}...`} value={query} />
        <label className="sr-only" htmlFor="offering-status">Lọc theo trạng thái</label>
        <select className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" id="offering-status" onChange={(event) => changeFilter(event.target.value as "all" | AdminOffering["status"])} value={status}>
          <option value="all">Tất cả trạng thái</option>
          <option value="draft">Bản nháp</option>
          <option value="review">Chờ duyệt</option>
          <option value="scheduled">Hẹn giờ</option>
          <option value="published">Đã xuất bản</option>
          <option value="archived">Lưu trữ</option>
        </select>
      </div>
      <AdminDataTable columns={columns} emptyMessage={emptyMessage} getRowId={(item) => item.id} onSettingsOpenChange={setIsColumnSettingsOpen} rows={visibleItems} settingsOpen={isColumnSettingsOpen} showSettingsButton={false} tableId={`offering-${title.toLocaleLowerCase("vi").replaceAll(" ", "-")}`} />
      <div className="flex items-center justify-between gap-3 text-sm text-slate-600"><span>Hiển thị {filteredItems.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filteredItems.length)} / {filteredItems.length}</span><div className="flex gap-2"><button className="h-9 rounded-lg border border-slate-200 px-3 font-semibold disabled:cursor-not-allowed disabled:opacity-45" disabled={currentPage <= 1} onClick={() => setPage((value) => value - 1)} type="button">Trước</button><span className="grid min-w-16 place-items-center font-semibold">{currentPage}/{totalPages}</span><button className="h-9 rounded-lg border border-slate-200 px-3 font-semibold disabled:cursor-not-allowed disabled:opacity-45" disabled={currentPage >= totalPages} onClick={() => setPage((value) => value + 1)} type="button">Sau</button></div></div>
    </AdminCard>
  </div>;
}
