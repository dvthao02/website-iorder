"use client";

import { useMemo } from "react";

import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/ui/admin-data-table";

type AuditLogEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: Date;
  userName: string | null;
  userUsername: string | null;
};

const formatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "medium" });

export function AuditLogTable({ entries }: { entries: AuditLogEntry[] }) {
  const columns = useMemo<AdminDataTableColumn<AuditLogEntry>[]>(() => [
    { id: "createdAt", label: "Thời điểm", defaultWidth: 190, minWidth: 160, cell: (entry) => <span className="whitespace-nowrap text-slate-600">{formatter.format(new Date(entry.createdAt))}</span> },
    { id: "user", label: "Người thực hiện", defaultWidth: 220, minWidth: 160, cell: (entry) => <span className="text-slate-700">{entry.userName ?? entry.userUsername ?? "Hệ thống"}</span> },
    { id: "action", label: "Thao tác", defaultWidth: 240, minWidth: 160, cell: (entry) => <code className="text-xs text-slate-700">{entry.action}</code> },
    { id: "entity", label: "Đối tượng", defaultWidth: 220, minWidth: 150, cell: (entry) => <code className="text-xs text-slate-700">{entry.entityType}</code> },
  ], []);

  return <AdminDataTable columns={columns} emptyMessage="Chưa có thao tác nào được ghi nhận." getRowId={(entry) => entry.id} rows={entries} tableId="audit-log" />;
}
