"use client";

import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { FileSpreadsheet, FileText, Mail, Phone } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LeadListQuery } from "@iorder/core/server/leads/leads.contract";
import type { AdminListPage as ListResult } from "@iorder/core/server/shared/admin-list.contract";
import { leadStatusUpdateResponseSchema } from "@iorder/core/server/leads/leads.contract";

import { AdminBulkBar } from "./ui/admin-bulk-bar";
import { AdminButton } from "./ui/admin-button";
import { AdminCard } from "./ui/admin-card";
import { AdminDataTable, type AdminDataTableColumn, type AdminTableSort } from "./ui/admin-data-table";
import { AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";
import { AdminFilterBar, type AdminFilterChip } from "./ui/admin-filter-bar";
import { AdminPeriodFilter, periodChipLabel } from "./ui/admin-period-filter";
import { AdminFilterTabs } from "./ui/admin-filter-tabs";
import { AdminListHeader } from "./ui/admin-list-header";
import { AdminListPage } from "./ui/admin-list-page";
import { AdminSearchField } from "./ui/admin-search-field";
import { AdminSidePanel } from "./ui/admin-side-panel";
import { AdminPagination } from "./ui/admin-pagination";
import { useRowSelection } from "./ui/content-bulk-bar";
import { useBulkAction } from "./ui/use-bulk-action";
import { useNavigationGuard } from "./ui/use-navigation-guard";
import { useAdminPermissions } from "./ui/admin-permissions";

type LeadStatus = "new" | "contacted" | "closed";
type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  businessModel: string | null;
  branches: string | null;
  need: string | null;
  message: string | null;
  status: LeadStatus;
  createdAt: Date;
  handledAt: Date | null;
};

const statusLabel: Record<LeadStatus, string> = { new: "Mới", contacted: "Đã liên hệ", closed: "Đã xử lý" };
const statusTone = { new: "warning", contacted: "info", closed: "success" } as const;
const statuses: LeadStatus[] = ["new", "contacted", "closed"];
const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
export function LeadsManager({ initialPage, initialQuery }: { initialPage: ListResult<Lead> & { counts: Record<"all" | LeadStatus, number> }; initialQuery: LeadListQuery }) {
  const { can } = useAdminPermissions();
  const router = useRouter();
  const [loading, startTransition] = useTransition();
  const { show: showToast } = useAdminToast();
  const leads = initialPage.items;
  const filter = initialQuery.status;
  const [search, setSearch] = useState(initialQuery.query);
  const pending = useRef(new Set<string>());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const { selectedIds, setSelectedIds, clear } = useRowSelection(JSON.stringify(initialQuery));
  const { busy: bulkBusy, run } = useBulkAction();
  const canUpdate = can("leads.update");
  useNavigationGuard(busy.size > 0 || bulkBusy, () => showToast("Đang cập nhật liên hệ. Vui lòng chờ trước khi rời trang.", "info"));
  const openLead = leads.find((lead) => lead.id === openId) ?? null;

  // Giữ bộ lọc khác khi đổi trạng thái/trang; patch ghi đè từng phần.
  function navigate(status: LeadListQuery["status"], page = 1, query = initialQuery.query, patch: Partial<Pick<LeadListQuery, "from" | "to" | "sort" | "dir">> = {}) {
    if (pending.current.size || loading) return;
    const next = { status, page: String(page), pageSize: String(initialQuery.pageSize), query, from: initialQuery.from, to: initialQuery.to, sort: initialQuery.sort, dir: initialQuery.dir, ...patch };
    const params = new URLSearchParams(Object.entries(next).filter(([key, value]) => value && !(key === "status" && value === "all") && !(key === "page" && value === "1")).map(([key, value]) => [key, String(value)]));
    startTransition(() => router.push(`/admin/khach-hang-tiem-nang${params.size ? `?${params}` : ""}`, { scroll: false }));
  }


  async function update(id: string, status: LeadStatus) {
    if (loading || pending.current.has(id) || leads.find(lead => lead.id === id)?.status === status) return;
    pending.current.add(id);
    setBusy(new Set(pending.current));
    try {
      const response = await fetch(`/api/admin/leads/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
      const payload = await readAdminJson(response);
      if (!response.ok) throw adminApiError(payload, "Không thể cập nhật liên hệ.");
      const parsed = leadStatusUpdateResponseSchema.safeParse(payload.lead);
      if (!parsed.success) throw new Error("Phản hồi cập nhật liên hệ không hợp lệ. Tải lại danh sách để kiểm tra.");
      if (parsed.data.id !== id || parsed.data.status !== status) throw new Error("Phản hồi cập nhật liên hệ không khớp. Tải lại danh sách để kiểm tra trước khi thử lại.");
      showToast(`Đã chuyển liên hệ sang “${statusLabel[status]}”.`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      pending.current.delete(id);
      setBusy(new Set(pending.current));
      // Kể cả response lỗi, DB có thể đã ghi; chỉ đọc lại khi cả nhóm request đã kết thúc.
      if (pending.current.size === 0) startTransition(() => router.refresh());
    }
  }

  const statusSelect = (lead: Lead, label: string) => <select aria-label={label} className="admin-select--compact" disabled={loading || busy.has(lead.id) || !canUpdate} onChange={(event) => update(lead.id, event.target.value as LeadStatus)} value={lead.status}>{statuses.map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}</select>;

  const columns: AdminDataTableColumn<Lead>[] = [
    { id: "name", label: "Khách hàng", defaultWidth: 170, minWidth: 140, sortKey: "name", cell: (lead) => <button className="admin-list-manager__identity" onClick={(event) => { event.stopPropagation(); setOpenId(lead.id); }} type="button"><strong>{lead.name}</strong></button> },
    { id: "phone", label: "Điện thoại", defaultWidth: 125, minWidth: 110, cell: (lead) => <a href={`tel:${lead.phone}`}>{lead.phone}</a> },
    { id: "email", label: "Email", defaultWidth: 180, minWidth: 130, cell: (lead) => lead.email ? <a className="admin-text-muted" href={`mailto:${lead.email}`}>{lead.email}</a> : <span className="admin-text-muted">—</span> },
    { id: "need", label: "Nhu cầu", defaultWidth: 190, minWidth: 140, cell: (lead) => <span title={[lead.need, lead.businessModel].filter(Boolean).join(" · ")}>{lead.need ?? "—"}{lead.businessModel ? <span className="admin-text-muted"> · {lead.businessModel}</span> : null}</span> },
    { id: "createdAt", label: "Gửi lúc", defaultWidth: 125, minWidth: 115, sortKey: "createdAt", sortFirst: "desc", cell: (lead) => <span className="admin-text-muted">{dateTimeFormatter.format(new Date(lead.createdAt))}</span> },
    { id: "status", label: "Trạng thái", defaultWidth: 140, minWidth: 130, cell: (lead) => statusSelect(lead, `Trạng thái của ${lead.name}`) },
  ];

  const counts = initialPage.counts;
  const filterItems: Array<{ label: string; value: "all" | LeadStatus }> = [
    { label: `Tất cả (${counts.all})`, value: "all" },
    ...statuses.map((status) => ({ label: `${statusLabel[status]} (${counts[status]})`, value: status })),
  ];
  const exportParams = (format: "xlsx" | "csv") => new URLSearchParams(Object.entries({ format, status: filter, query: initialQuery.query, from: initialQuery.from, to: initialQuery.to, sort: initialQuery.sort, dir: initialQuery.dir }).filter(([, value]) => value) as [string, string][]);
  const sort: AdminTableSort = initialQuery.sort ? { key: initialQuery.sort, dir: initialQuery.dir ?? "desc" } : null;
  const filtered = Boolean(initialQuery.query || initialQuery.from || initialQuery.to);
  const selectedLeads = leads.filter((lead) => selectedIds.includes(lead.id));

  function bulkStatus(status: LeadStatus) {
    const items = selectedLeads.filter((lead) => lead.status !== status);
    if (!items.length) { showToast(`Các liên hệ đã chọn đều đang ở “${statusLabel[status]}”.`, "info"); return; }
    void run({ items, request: (lead) => ({ method: "PATCH", url: `/api/admin/leads/${lead.id}`, body: { status } }), verb: "Cập nhật", noun: "liên hệ", onDone: clear });
  }

  const chips: AdminFilterChip[] = [
    ...(initialQuery.query ? [{ key: "query", label: `Từ khóa: “${initialQuery.query}”`, onRemove: () => { setSearch(""); navigate(filter, 1, ""); } }] : []),
    ...(initialQuery.from || initialQuery.to ? [{ key: "period", label: `Thời gian: ${periodChipLabel(initialQuery.from, initialQuery.to)}`, onRemove: () => navigate(filter, 1, initialQuery.query, { from: undefined, to: undefined }) }] : []),
  ];

  return <AdminListPage variant="dense">
    <AdminCard>
      <AdminListHeader actions={counts.all ? <>
        <a className="admin-button admin-button--secondary" download href={`/api/admin/leads/export?${exportParams("xlsx")}`} title="Tải Excel theo bộ lọc đang xem"><FileSpreadsheet aria-hidden="true" size={16} />Xuất Excel</a>
        <a className="admin-button admin-button--ghost" download href={`/api/admin/leads/export?${exportParams("csv")}`} title="Tải CSV theo bộ lọc đang xem"><FileText aria-hidden="true" size={16} />CSV</a>
      </> : undefined} description={loading ? "Đang tải danh sách liên hệ…" : `${initialPage.total} liên hệ${filtered ? " khớp bộ lọc" : ""} · ${counts.new} mới cần xử lý`} title="Khách hàng tiềm năng" />
      <AdminFilterTabs ariaLabel="Lọc liên hệ" disabled={loading || busy.size > 0} items={filterItems} onValueChange={value => navigate(value)} value={filter} />
      <AdminFilterBar chips={chips} onClearAll={() => { setSearch(""); navigate(filter, 1, "", { from: undefined, to: undefined }); }} onSubmit={(event) => { event.preventDefault(); navigate(filter, 1, search.trim()); }} search={<AdminSearchField disabled={loading || busy.size > 0} label="Tìm liên hệ" onChange={event => setSearch(event.target.value)} placeholder="Tên, điện thoại, email hoặc nhu cầu" value={search} />}>
        <AdminPeriodFilter disabled={loading} from={initialQuery.from} label="Khoảng thời gian gửi" onChange={({ from, to }) => navigate(filter, 1, initialQuery.query, { from, to })} to={initialQuery.to} />
      </AdminFilterBar>
      <AdminBulkBar count={selectedLeads.length} onClear={clear}>
        {canUpdate ? <>
          <span className="admin-text-muted">Chuyển sang:</span>
          {statuses.map((status) => <AdminButton disabled={bulkBusy} key={status} onClick={() => bulkStatus(status)} size="sm" variant="secondary">{statusLabel[status]}</AdminButton>)}
          {bulkBusy ? <span className="admin-text-muted">Đang xử lý…</span> : null}
        </> : <span className="admin-text-muted">Cần quyền cập nhật liên hệ để đổi trạng thái hàng loạt.</span>}
      </AdminBulkBar>
      <AdminDataTable columns={columns} emptyMessage={filter === "all" && !filtered ? "Chưa có liên hệ nào. Liên hệ gửi từ biểu mẫu website sẽ xuất hiện tại đây." : "Không có liên hệ khớp bộ lọc. Thử đổi trạng thái, từ khóa hoặc khoảng thời gian."} getRowId={(lead) => lead.id} onRowClick={(lead) => setOpenId(lead.id)} onSelectionChange={setSelectedIds} onSortChange={(next) => navigate(filter, 1, initialQuery.query, { sort: next?.key, dir: next?.dir })} rows={leads} selectedIds={selectedIds} sort={sort} tableId="leads" />
      <AdminPagination disabled={loading || busy.size > 0} label="Phân trang liên hệ" onChange={(page) => navigate(filter, page)} page={initialPage.page} pageSize={initialPage.pageSize} total={initialPage.total} totalPages={initialPage.totalPages} />
    </AdminCard>

    <AdminSidePanel isOpen={openLead !== null} label="Chi tiết liên hệ" onClose={() => setOpenId(null)}>
      {openLead ? <>
        <header className="admin-list-manager__panel-header">
          <p>Khách hàng tiềm năng</p>
          <h2>{openLead.name}</h2>
          <small><AdminStatusBadge tone={statusTone[openLead.status]}>{statusLabel[openLead.status]}</AdminStatusBadge></small>
        </header>
        <div className="admin-list-manager__form">
          <dl className="admin-description-list grid-cols-1">
            <div><dt>Điện thoại</dt><dd><a className="inline-flex items-center gap-1.5" href={`tel:${openLead.phone}`}><Phone aria-hidden="true" size={15} />{openLead.phone}</a></dd></div>
            <div><dt>Email</dt><dd>{openLead.email ? <a className="inline-flex items-center gap-1.5" href={`mailto:${openLead.email}`}><Mail aria-hidden="true" size={15} />{openLead.email}</a> : "—"}</dd></div>
            <div><dt>Mô hình kinh doanh</dt><dd>{openLead.businessModel ?? "—"}</dd></div>
            <div><dt>Số chi nhánh</dt><dd>{openLead.branches ?? "—"}</dd></div>
            <div><dt>Nhu cầu</dt><dd>{openLead.need ?? "—"}</dd></div>
            <div><dt>Lời nhắn</dt><dd className="whitespace-pre-wrap font-normal">{openLead.message ?? "—"}</dd></div>
            <div><dt>Gửi lúc</dt><dd>{dateTimeFormatter.format(new Date(openLead.createdAt))}</dd></div>
            {openLead.handledAt ? <div><dt>Xử lý lúc</dt><dd>{dateTimeFormatter.format(new Date(openLead.handledAt))}</dd></div> : null}
            <div><dt>Trạng thái</dt><dd>{statusSelect(openLead, "Trạng thái liên hệ")}</dd></div>
          </dl>
        </div>
      </> : null}
    </AdminSidePanel>
  </AdminListPage>;
}
