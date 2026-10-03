"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AdminCard } from "@/components/admin/ui/admin-card";
import { AdminContentActions } from "@/components/admin/ui/admin-content-actions";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/ui/admin-data-table";
import { AdminStatusBadge, type AdminFeedbackTone } from "@/components/admin/ui/admin-feedback";
import { getFixedWebsitePage, type AdminPage } from "@iorder/core/server/pages/pages.contract";

const perPage = 10;
const statusLabels: Record<AdminPage["status"], string> = { draft: "Bản nháp", review: "Chờ duyệt", scheduled: "Hẹn giờ", published: "Đã xuất bản", archived: "Lưu trữ" };

function getPublicPath(page: AdminPage) { return getFixedWebsitePage(page.slug)?.publicPath ?? `/trang/${page.slug}`; }
function formatDate(value: Date | null) { return value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(value)) : "Chưa xuất bản"; }

export function PagesManager({ initialPages }: { initialPages: AdminPage[] }) {
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<AdminPage["status"] | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const filteredPages = useMemo(() => initialPages.filter((page) => `${page.title} ${page.slug}`.toLocaleLowerCase("vi").includes(keyword.trim().toLocaleLowerCase("vi")) && (status === "all" || page.status === status)), [initialPages, keyword, status]);
  const totalPages = Math.max(1, Math.ceil(filteredPages.length / perPage));
  const pageNumber = Math.min(currentPage, totalPages);
  const visiblePages = filteredPages.slice((pageNumber - 1) * perPage, pageNumber * perPage);
  const publishedCount = initialPages.filter((page) => page.status === "published").length;
  const draftCount = initialPages.filter((page) => page.status === "draft" || page.status === "review").length;
  const scheduledCount = initialPages.filter((page) => page.status === "scheduled").length;
  const columns = useMemo<AdminDataTableColumn<AdminPage>[]>(() => [
    { id: "page", label: "Trang", defaultWidth: 300, minWidth: 210, cell: (page) => <Link className="block hover:text-blue-700" href={`/admin/pages/${page.id}`}><strong className="block text-slate-900">{page.title}</strong><span className="mt-1 block text-xs text-slate-500">{getPublicPath(page)}</span></Link> },
    { id: "type", label: "Loại", defaultWidth: 160, minWidth: 130, cell: (page) => <Badge tone={getFixedWebsitePage(page.slug) ? "blue" : "slate"}>{getFixedWebsitePage(page.slug) ? "Trang cố định" : "Trang tự tạo"}</Badge> },
    { id: "status", label: "Trạng thái", defaultWidth: 150, minWidth: 130, cell: (page) => <StatusBadge status={page.status} /> },
    { id: "publishedAt", label: "Xuất bản", defaultWidth: 170, minWidth: 145, cell: (page) => <span className="text-slate-600">{formatDate(page.publishedAt)}</span> },
    { id: "actions", label: "Thao tác", defaultWidth: 132, minWidth: 116, align: "right", cell: (page) => { const values = { ...page }; ["id", "draftVersion", "publishedAt", "updatedAt"].forEach((key) => Reflect.deleteProperty(values, key)); return <AdminContentActions editHref={`/admin/pages/${page.id}`} isArchived={page.status === "archived"} label="trang" mutation={{ method: "POST", url: "/api/admin/pages", body: { id: page.id, values: { ...values, status: page.status === "archived" ? "draft" : "archived" } } }} viewHref={page.status === "published" ? getPublicPath(page) : undefined} />; } },
  ], []);

  function updateFilters(nextKeyword: string, nextStatus: AdminPage["status"] | "all") { setKeyword(nextKeyword); setStatus(nextStatus); setCurrentPage(1); }

  return <div className="mx-auto grid max-w-7xl gap-5">
    <section aria-label="Tổng quan trang" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard description="Trang đang được CMS quản lý" label="Tất cả trang" value={initialPages.length} /><SummaryCard description="Đang hiển thị trên website" label="Đã xuất bản" tone="green" value={publishedCount} /><SummaryCard description="Chưa hiển thị công khai" label="Bản nháp & chờ duyệt" tone="amber" value={draftCount} /><SummaryCard description="Chờ đến thời điểm xuất bản" label="Hẹn giờ" tone="purple" value={scheduledCount} /></section>
    <AdminCard className="grid gap-4 p-5 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-extrabold text-slate-950">Danh sách trang</h2><p className="mt-1 text-sm text-slate-600">Chọn một trang để chỉnh sửa ở màn hình riêng.</p></div>
        <Link className="admin-button admin-button--primary" href="/admin/pages/new">Tạo trang</Link>
      </header>
      <div className="flex flex-wrap gap-2 border-y border-slate-100 py-4">
        <input aria-label="Tìm trang" className="h-10 min-w-52 flex-1 rounded-lg border border-slate-300 px-3 text-sm" onChange={(event) => updateFilters(event.target.value, status)} placeholder="Tìm theo tên hoặc đường dẫn" value={keyword} />
        <select aria-label="Lọc theo trạng thái" className="h-10 rounded-lg border border-slate-300 px-3 text-sm" onChange={(event) => updateFilters(keyword, event.target.value as AdminPage["status"] | "all")} value={status}><option value="all">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      </div>
      <AdminDataTable columns={columns} emptyMessage="Không tìm thấy trang phù hợp." getRowId={(page) => page.id} rows={visiblePages} tableId="pages" />
      <footer className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"><span>Hiển thị {filteredPages.length ? (pageNumber - 1) * perPage + 1 : 0}–{Math.min(pageNumber * perPage, filteredPages.length)} trên {filteredPages.length} trang</span><div className="flex items-center gap-2"><button className="rounded-lg border border-slate-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50" disabled={pageNumber === 1} onClick={() => setCurrentPage(pageNumber - 1)} type="button">Trước</button><span>Trang {pageNumber}/{totalPages}</span><button className="rounded-lg border border-slate-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50" disabled={pageNumber === totalPages} onClick={() => setCurrentPage(pageNumber + 1)} type="button">Sau</button></div></footer>
    </AdminCard>
  </div>;
}

function SummaryCard({ label, value, description, tone = "blue" }: { label: string; value: number; description: string; tone?: "blue" | "green" | "amber" | "purple" }) { const tones = { blue: "border-blue-100 bg-blue-50", green: "border-emerald-100 bg-emerald-50", amber: "border-amber-100 bg-amber-50", purple: "border-violet-100 bg-violet-50" }; return <article className={`rounded-xl border p-4 ${tones[tone]}`}><strong className="block text-3xl text-slate-950">{value}</strong><span className="mt-2 block font-bold text-slate-800">{label}</span><small className="mt-1 block text-slate-600">{description}</small></article>; }
function Badge({ children, tone }: { children: string; tone: "blue" | "slate" }) { return <AdminStatusBadge tone={tone === "blue" ? "info" : "neutral"}>{children}</AdminStatusBadge>; }
function StatusBadge({ status }: { status: AdminPage["status"] }) { const tones: Record<AdminPage["status"], AdminFeedbackTone> = { draft: "neutral", review: "warning", scheduled: "info", published: "success", archived: "neutral" }; return <AdminStatusBadge tone={tones[status]}>{statusLabels[status]}</AdminStatusBadge>; }
