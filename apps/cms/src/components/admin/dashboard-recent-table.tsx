"use client";

import Link from "next/link";
import { useMemo } from "react";

import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/ui/admin-data-table";
import { AdminStatusBadge, type AdminFeedbackTone } from "@/components/admin/ui/admin-feedback";

type ContentStatus = "draft" | "review" | "scheduled" | "published" | "archived";
type DashboardContent = { id: string; title: string; type: string; status: ContentStatus; updatedAt: Date; href: string };
const statusLabels: Record<ContentStatus, string> = { draft: "Bản nháp", review: "Chờ duyệt", scheduled: "Hẹn giờ", published: "Đã xuất bản", archived: "Lưu trữ" };
const formatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" });

export function DashboardRecentTable({ items }: { items: DashboardContent[] }) {
  const columns = useMemo<AdminDataTableColumn<DashboardContent>[]>(() => [
    { id: "title", label: "Tiêu đề", defaultWidth: 290, minWidth: 200, cell: (item) => <Link className="font-bold text-slate-900 hover:text-blue-700" href={item.href}>{item.title}</Link> },
    { id: "type", label: "Loại nội dung", defaultWidth: 180, minWidth: 140, cell: (item) => <span className="text-slate-600">{item.type}</span> },
    { id: "status", label: "Trạng thái", defaultWidth: 150, minWidth: 130, cell: (item) => <AdminStatusBadge tone={statusTone[item.status]}>{statusLabels[item.status]}</AdminStatusBadge> },
    { id: "updatedAt", label: "Cập nhật", defaultWidth: 180, minWidth: 145, cell: (item) => <span className="text-slate-600">{formatter.format(new Date(item.updatedAt))}</span> },
  ], []);

  return <AdminDataTable columns={columns} emptyMessage="Chưa có nội dung nào." getRowId={(item) => `${item.type}-${item.id}`} rows={items} tableId="dashboard-recent-content" />;
}

const statusTone: Record<ContentStatus, AdminFeedbackTone> = { draft: "neutral", review: "warning", scheduled: "info", published: "success", archived: "error" };
