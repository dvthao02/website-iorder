"use client";

import { useMemo } from "react";

import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/ui/admin-data-table";
import { auditActionLabel, auditEntityLabel } from "./ui/audit-labels";

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

export function AuditLogTable({ entries, emptyMessage = "Chưa có thao tác nào được ghi nhận." }: { entries: AuditLogEntry[]; emptyMessage?: string }) {
  const columns = useMemo<AdminDataTableColumn<AuditLogEntry>[]>(() => [
    { id: "createdAt", label: "Thời điểm", defaultWidth: 190, minWidth: 160, cell: (entry) => <span className="whitespace-nowrap text-[var(--cms-muted)]">{formatter.format(new Date(entry.createdAt))}</span> },
    { id: "user", label: "Người thực hiện", defaultWidth: 220, minWidth: 160, cell: (entry) => <span className="text-[var(--cms-text)]">{entry.userName ?? entry.userUsername ?? "Hệ thống"}</span> },
    { id: "action", label: "Thao tác", defaultWidth: 240, minWidth: 160, cell: (entry) => <span className="text-sm text-[var(--cms-text)]" title={entry.action}>{auditActionLabel(entry.action)}</span> },
    { id: "entity", label: "Đối tượng", defaultWidth: 220, minWidth: 150, cell: (entry) => <span className="text-sm text-[var(--cms-text)]" title={entry.entityType}>{auditEntityLabel(entry.entityType)}</span> },
  ], []);

  return <AdminDataTable columns={columns} emptyMessage={emptyMessage} getRowId={(entry) => entry.id} rows={entries} tableId="audit-log" />;
}
