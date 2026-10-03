"use client";

import Link from "next/link";
import { useMemo } from "react";

import type { EquipmentGroup, EquipmentItem } from "@/components/admin/equipment-manager";
import { AdminButton } from "@/components/admin/ui/admin-button";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { AdminContentActions } from "@/components/admin/ui/admin-content-actions";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/ui/admin-data-table";
import { AdminStatusBadge, type AdminFeedbackTone } from "@/components/admin/ui/admin-feedback";

const statusLabels: Record<EquipmentItem["status"], string> = {
  archived: "Lưu trữ",
  draft: "Bản nháp",
  published: "Đã xuất bản",
  review: "Chờ duyệt",
  scheduled: "Hẹn giờ",
};
const statusTones: Record<EquipmentItem["status"], AdminFeedbackTone> = { archived: "neutral", draft: "neutral", published: "success", review: "warning", scheduled: "info" };

export function EquipmentManagerList({ groups, items }: { groups: EquipmentGroup[]; items: EquipmentItem[] }) {
  const published = items.filter((item) => item.status === "published").length;
  const columns = useMemo<AdminDataTableColumn<EquipmentItem>[]>(() => [
    { id: "name", label: "Thiết bị", defaultWidth: 280, minWidth: 200, cell: (item) => <Link className="font-bold text-slate-900 hover:text-blue-700" href={`/admin/thiet-bi/${item.id}`}>{item.name}</Link> },
    { id: "group", label: "Nhóm", defaultWidth: 180, minWidth: 140, cell: (item) => <span className="text-slate-600">{item.groupName}</span> },
    { id: "model", label: "Model", defaultWidth: 150, minWidth: 120, cell: (item) => <span className="text-slate-600">{item.modelCode ?? "—"}</span> },
    { id: "status", label: "Trạng thái", defaultWidth: 150, minWidth: 130, cell: (item) => <AdminStatusBadge tone={statusTones[item.status]}>{statusLabels[item.status]}</AdminStatusBadge> },
    { id: "actions", label: "Thao tác", defaultWidth: 132, minWidth: 116, align: "right", cell: (item) => { const values = { ...item }; ["id", "groupName", "coverUrl", "coverAlt", "version", "updatedAt"].forEach((key) => Reflect.deleteProperty(values, key)); return <AdminContentActions editHref={`/admin/thiet-bi/${item.id}`} isArchived={item.status === "archived"} label="thiết bị" mutation={{ method: "POST", url: "/api/admin/equipment", body: { kind: "items", id: item.id, values: { ...values, status: item.status === "archived" ? "draft" : "archived" } } }} viewHref={item.status === "published" ? `/thiet-bi/${item.slug}` : undefined} />; } },
  ], []);

  return <div className="grid gap-5">
    <section className="grid gap-3 sm:grid-cols-3">
      <AdminCard className="p-5"><p className="text-sm font-semibold text-slate-600">Nhóm thiết bị</p><strong className="mt-2 block text-3xl font-extrabold text-slate-950">{groups.length}</strong><Link className="mt-3 inline-block text-sm font-bold text-blue-700" href="/admin/thiet-bi/nhom">Quản lý nhóm →</Link></AdminCard>
      <AdminCard className="p-5"><p className="text-sm font-semibold text-slate-600">Tổng thiết bị</p><strong className="mt-2 block text-3xl font-extrabold text-slate-950">{items.length}</strong></AdminCard>
      <AdminCard className="p-5"><p className="text-sm font-semibold text-slate-600">Đã xuất bản</p><strong className="mt-2 block text-3xl font-extrabold text-emerald-700">{published}</strong></AdminCard>
    </section>
    <AdminCard className="grid gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold text-slate-950">Danh sách thiết bị</h2><p className="mt-1 text-sm text-slate-600">Chọn một thiết bị để mở màn hình chỉnh sửa riêng.</p></div><AdminButton disabled={!groups.length} href="/admin/thiet-bi/moi">Thêm thiết bị</AdminButton></div>
      <AdminDataTable columns={columns} emptyMessage="Chưa có thiết bị nào." getRowId={(item) => item.id} rows={items} tableId="equipment" />
    </AdminCard>
  </div>;
}
