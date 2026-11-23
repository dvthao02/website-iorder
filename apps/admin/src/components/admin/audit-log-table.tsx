"use client";

import { Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { summarizeUserAgent } from "@iorder/shared/server/shared/user-agent";
import { AuditLogPurgeDialog, type AuditPurgeFilter } from "@/components/admin/audit-log-purge";
import { AdminBulkBar } from "@/components/admin/ui/admin-bulk-bar";
import { AdminButton } from "@/components/admin/ui/admin-button";
import { useRowSelection } from "@/components/admin/ui/content-bulk-bar";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/ui/admin-data-table";
import { AdminSidePanel } from "@/components/admin/ui/admin-side-panel";
import { useListNavigation } from "@/components/admin/ui/use-list-navigation";
import { auditActionLabel, auditEntityLabel, auditFieldLabels } from "./ui/audit-labels";

type AuditLogEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: Date;
  userName: string | null;
  userUsername: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  changedFields: string[];
};

const formatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "medium" });
const timeFormatter = new Intl.DateTimeFormat("vi-VN", { timeStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" });
const dayFormatter = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
const notRecorded = <span className="font-normal text-[var(--cms-muted)]">Không ghi nhận (bản ghi cũ hoặc do hệ thống chạy)</span>;
const hint = "block break-all text-[length:var(--cms-text-xs)] font-normal text-[var(--cms-muted)]";

// IPv4 qua socket IPv6 có dạng ::ffff:1.2.3.4.
function displayIp(ip: string | null) {
  return ip?.replace(/^::ffff:/i, "") ?? null;
}

function changeSummary(entry: AuditLogEntry) {
  const labels = auditFieldLabels(entry.changedFields);
  if (!labels.length) return "";
  return labels.length > 3 ? `${labels.slice(0, 3).join(", ")} +${labels.length - 3}` : labels.join(", ");
}

function AuditLogDetail({ entry }: { entry: AuditLogEntry }) {
  const device = summarizeUserAgent(entry.userAgent);
  const fields = auditFieldLabels(entry.changedFields);
  const createdAt = new Date(entry.createdAt);
  return <dl className="admin-description-list grid-cols-1">
    <div><dt>Thời điểm</dt><dd>{timeFormatter.format(createdAt)} · {dayFormatter.format(createdAt)}</dd></div>
    <div><dt>Người thực hiện</dt><dd>{entry.userName ?? "Hệ thống"}{entry.userUsername ? <span className="text-[var(--cms-muted)]"> · {entry.userUsername}</span> : null}</dd></div>
    <div><dt>Thao tác</dt><dd>{auditActionLabel(entry.action)}</dd></div>
    <div><dt>Đối tượng</dt><dd>{auditEntityLabel(entry.entityType)}{entry.entityId ? <code className={hint}>{entry.entityId}</code> : null}</dd></div>
    {fields.length ? <div><dt>Nội dung thay đổi</dt><dd>{fields.join(", ")}</dd></div> : null}
    <div><dt>Địa chỉ IP</dt><dd>{displayIp(entry.ipAddress) ?? notRecorded}</dd></div>
    <div><dt>Thiết bị</dt><dd>{entry.userAgent ? <>{device.label}<span className={hint}>{entry.userAgent}</span></> : notRecorded}</dd></div>
    <div><dt>Mã request</dt><dd>{entry.requestId ? <><code className="break-all">{entry.requestId}</code><span className={hint}>Dùng để tra log máy chủ khi cần điều tra.</span></> : notRecorded}</dd></div>
  </dl>;
}

/** canManage (Super Admin): chọn dòng để xóa; filter là bộ lọc đang áp dụng (null nếu không lọc) cho lựa chọn "xóa theo bộ lọc". */
export function AuditLogTable({ canManage = false, entries, emptyMessage = "Chưa có thao tác nào được ghi nhận.", filter = null }: { canManage?: boolean; entries: AuditLogEntry[]; emptyMessage?: string; filter?: AuditPurgeFilter | null }) {
  const router = useRouter();
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);
  const [purging, setPurging] = useState(false);
  const { setSort, sort } = useListNavigation();
  // Dòng đã chọn tự bỏ khi đổi trang/bộ lọc/sắp xếp (URL đổi).
  const selection = useRowSelection(useSearchParams().toString());
  const columns = useMemo<AdminDataTableColumn<AuditLogEntry>[]>(() => [
    { id: "createdAt", label: "Thời điểm", defaultWidth: 150, minWidth: 140, sortKey: "createdAt", sortFirst: "desc", cell: (entry) => <span className="whitespace-nowrap text-[var(--cms-muted)]">{formatter.format(new Date(entry.createdAt))}</span> },
    { id: "user", label: "Người thực hiện", defaultWidth: 160, minWidth: 120, sortKey: "user", cell: (entry) => <span>{entry.userName ?? entry.userUsername ?? "Hệ thống"}</span> },
    { id: "action", label: "Thao tác", defaultWidth: 200, minWidth: 150, sortKey: "action", cell: (entry) => <span className="text-sm" title={entry.action}>{auditActionLabel(entry.action)}</span> },
    { id: "entity", label: "Đối tượng", defaultWidth: 170, minWidth: 130, sortKey: "entityType", cell: (entry) => {
      const changes = changeSummary(entry);
      return <span className="text-sm">{auditEntityLabel(entry.entityType)}{changes ? <span className="block text-[length:var(--cms-text-xs)] text-[var(--cms-muted)]">{changes}</span> : null}</span>;
    } },
    { id: "ip", label: "IP", defaultWidth: 120, minWidth: 100, sortKey: "ipAddress", cell: (entry) => <span className="whitespace-nowrap text-sm text-[var(--cms-muted)]">{displayIp(entry.ipAddress) ?? "—"}</span> },
    { id: "device", label: "Thiết bị", defaultWidth: 190, minWidth: 140, cell: (entry) => <span className="text-sm text-[var(--cms-muted)]" title={entry.userAgent ?? undefined}>{entry.userAgent ? summarizeUserAgent(entry.userAgent).label : "—"}</span> },
  ], []);

  return <>
    {canManage ? <AdminBulkBar count={selection.selectedIds.length} onClear={selection.clear}>
      <AdminButton disabled={!selection.selectedIds.length} leadingIcon={<Trash2 aria-hidden="true" size={16} />} onClick={() => setPurging(true)} variant="secondary">Xóa các dòng đã chọn</AdminButton>
    </AdminBulkBar> : null}
    <AdminDataTable columns={columns} emptyMessage={emptyMessage} getRowId={(entry) => entry.id} getRowLabel={(entry) => `${auditActionLabel(entry.action)} lúc ${formatter.format(new Date(entry.createdAt))}`} onRowClick={setSelected} onSelectionChange={canManage ? selection.setSelectedIds : undefined} onSortChange={setSort} rows={entries} selectedIds={canManage ? selection.selectedIds : undefined} sort={sort} tableId="audit-log" />
    {purging ? <AuditLogPurgeDialog filter={filter} onClose={() => setPurging(false)} onDone={() => { setPurging(false); selection.clear(); router.refresh(); }} selectedIds={selection.selectedIds} /> : null}
    <AdminSidePanel isOpen={selected !== null} label="Chi tiết thao tác" onClose={() => setSelected(null)}>
      {selected ? <>
        <header className="admin-list-manager__panel-header">
          <p>Nhật ký hoạt động</p>
          <h2>{auditActionLabel(selected.action)}</h2>
        </header>
        <div className="admin-list-manager__form"><AuditLogDetail entry={selected} /></div>
      </> : null}
    </AdminSidePanel>
  </>;
}
