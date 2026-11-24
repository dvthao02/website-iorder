"use client";

import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { FileSpreadsheet, GitMerge, Repeat, StickyNote, Trash2, UserCheck, UserMinus, UserPlus } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LeadAssignee, LeadListQuery } from "@iorder/shared/server/leads/leads.contract";
import { equipmentAvailabilityLabels } from "@iorder/shared/server/equipment/equipment-availability";
import type { AdminListPage as ListResult } from "@iorder/shared/server/shared/admin-list.contract";
import { leadMergeResponseSchema, leadUpdateResponseSchema } from "@iorder/shared/server/leads/leads.contract";
import { formatPhoneDisplay } from "@iorder/shared/server/leads/leads.phone";

import { LeadDetailFooter, LeadDetailPanel } from "./lead-detail-panel";
import { availabilityTone, focusLabels, LeadAge, LeadAssigneeSelect, LeadPhoneActions, LeadStatusSelect, phoneLinks, priceFormatter, sourceLabels, statusIcons, statusLabel, statuses, type Lead, type LeadFocus, type LeadPatch, type LeadSource, type LeadStatus } from "./leads-parts";
import { AdminBulkBar } from "./ui/admin-bulk-bar";
import { AdminBulkMenu, type AdminBulkMenuAction } from "./ui/admin-bulk-menu";
import { AdminCard } from "./ui/admin-card";
import { useAdminConfirm } from "./ui/admin-confirm-dialog";
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

type LeadsPageData = ListResult<Lead> & { counts: Record<"all" | LeadStatus, number>; assignees: LeadAssignee[] };

// Xóa và gộp xóa cả thông tin cá nhân của khách (Backend: scrubbedLead): nói rõ trước khi xác nhận.
const deleteMessage = "Liên hệ biến khỏi danh sách, thông báo và thống kê, và thông tin cá nhân của khách (tên, số điện thoại, email, lời nhắn, ghi chú) bị xóa vĩnh viễn. Hệ thống chỉ giữ số điện thoại dạng chữ số, IP đã băm và thiết bị để chặn gửi rác lặp lại. Không hoàn tác được.";

export function LeadsManager({ initialPage, initialQuery, initialOpen = null }: { initialPage: LeadsPageData; initialQuery: LeadListQuery; /** Liên hệ mở sẵn khung chi tiết (từ thông báo), kể cả khi không nằm ở trang danh sách đang xem. */ initialOpen?: Lead | null }) {
  const { can, userId } = useAdminPermissions();
  const router = useRouter();
  const [loading, startTransition] = useTransition();
  const { show: showToast } = useAdminToast();
  const { confirm } = useAdminConfirm();
  const leads = initialPage.items;
  const assignees = initialPage.assignees;
  const filter = initialQuery.status;
  const source = initialQuery.source;
  const assigneeFilter = initialQuery.assignee;
  const focus = initialQuery.focus;
  const [search, setSearch] = useState(initialQuery.query);
  const pending = useRef(new Set<string>());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState(false);
  const [openId, setOpenId] = useState<string | null>(initialOpen?.id ?? null);
  const { selectedIds, setSelectedIds, clear } = useRowSelection(JSON.stringify(initialQuery));
  const { busy: bulkBusy, run } = useBulkAction();
  const canUpdate = can("leads.update");
  const canDelete = can("leads.delete");
  useNavigationGuard(busy.size > 0 || bulkBusy || merging, () => showToast("Đang cập nhật liên hệ. Vui lòng chờ trước khi rời trang.", "info"));
  const openLead = leads.find((lead) => lead.id === openId) ?? (initialOpen && initialOpen.id === openId ? initialOpen : null);
  const myName = assignees.find((person) => person.id === userId)?.name ?? null;
  const openIndex = leads.findIndex((lead) => lead.id === openId);

  // Phím tắt khi khung chi tiết đang mở: ↓ hoặc J sang liên hệ sau, ↑ hoặc K về liên hệ trước. Không áp dụng khi đang gõ vào ô nhập,
  // giữ phím bổ trợ hoặc focus nằm ngoài khung (ví dụ hộp xác nhận đang mở).
  useEffect(() => {
    if (openIndex < 0) return;
    function onKey(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target && target !== document.body && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || !target.closest(".admin-side-panel"))) return;
      const step = event.key === "ArrowDown" || event.key === "j" ? 1 : event.key === "ArrowUp" || event.key === "k" ? -1 : 0;
      const neighbour = step ? leads[openIndex + step] : undefined;
      if (!neighbour) return;
      event.preventDefault();
      setOpenId(neighbour.id);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [leads, openIndex]);

  // Giữ bộ lọc khác khi đổi trạng thái/trang; patch ghi đè từng phần.
  function navigate(status: LeadListQuery["status"], page = 1, query = initialQuery.query, patch: Partial<Pick<LeadListQuery, "from" | "to" | "sort" | "dir" | "pageSize" | "source" | "assignee" | "focus">> = {}) {
    if (pending.current.size || loading) return;
    const next = { status, page: String(page), pageSize: String(initialQuery.pageSize), query, source, assignee: assigneeFilter, focus, from: initialQuery.from, to: initialQuery.to, sort: initialQuery.sort, dir: initialQuery.dir, ...patch };
    const params = new URLSearchParams(Object.entries(next).filter(([key, value]) => value && !((key === "status" || key === "source" || key === "assignee" || key === "focus") && value === "all") && !(key === "page" && value === "1")).map(([key, value]) => [key, String(value)]));
    startTransition(() => router.push(`/admin/leads${params.size ? `?${params}` : ""}`, { scroll: false }));
  }

  // Đóng khung chi tiết; nếu mở từ thông báo (?open=…) thì gỡ tham số đó khỏi địa chỉ để làm mới trang không mở lại.
  function closePanel() {
    setOpenId(null);
    if (initialOpen && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("open")) {
        url.searchParams.delete("open");
        window.history.replaceState(null, "", `${url.pathname}${url.search}`);
      }
    }
  }

  /** Cập nhật một liên hệ (trạng thái, ghi chú, người phụ trách, thông tin khách); trả về true khi lưu được. */
  async function update(id: string, patch: LeadPatch): Promise<boolean> {
    if (loading || pending.current.has(id)) return false;
    const current = leads.find(lead => lead.id === id) ?? (initialOpen?.id === id ? initialOpen : undefined);
    const only = (key: keyof LeadPatch) => Object.keys(patch).every((field) => field === key);
    if (only("status") && current?.status === patch.status) return false;
    if (only("assignedTo") && current?.assignedToId === patch.assignedTo) return false;
    pending.current.add(id);
    setBusy(new Set(pending.current));
    let saved = false;
    try {
      const response = await fetch(`/api/v1/admin/leads/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
      const payload = await readAdminJson(response);
      if (!response.ok) throw adminApiError(payload, "Không thể cập nhật liên hệ.", response.status);
      const parsed = leadUpdateResponseSchema.safeParse(payload.lead);
      if (!parsed.success) throw new Error("Phản hồi cập nhật liên hệ không hợp lệ. Tải lại danh sách để kiểm tra.");
      const result = parsed.data;
      if (result.id !== id || (patch.status !== undefined && result.status !== patch.status) || (patch.assignedTo !== undefined && result.assignedToId !== patch.assignedTo)
        || (patch.internalNote !== undefined && (result.internalNote ?? "") !== patch.internalNote.trim()) || (patch.name !== undefined && result.name !== patch.name)
        || (patch.phone !== undefined && result.phone !== patch.phone) || (patch.email !== undefined && result.email !== (patch.email?.trim() || null))) {
        throw new Error("Phản hồi cập nhật liên hệ không khớp. Tải lại danh sách để kiểm tra trước khi thử lại.");
      }
      const assigneeName = patch.assignedTo ? assignees.find((person) => person.id === patch.assignedTo)?.name ?? "người phụ trách" : null;
      showToast(patch.status !== undefined ? `Đã chuyển liên hệ sang “${statusLabel[patch.status]}”.`
        : patch.assignedTo !== undefined ? (assigneeName ? `Đã giao liên hệ cho ${assigneeName}.` : "Đã bỏ giao liên hệ.")
        : patch.internalNote !== undefined ? "Đã lưu ghi chú." : "Đã cập nhật thông tin liên hệ.", "success");
      saved = true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      pending.current.delete(id);
      setBusy(new Set(pending.current));
      // Kể cả response lỗi, DB có thể đã ghi; chỉ đọc lại khi cả nhóm request đã kết thúc.
      if (pending.current.size === 0) startTransition(() => router.refresh());
    }
    return saved;
  }

  /**
   * Cập nhật liên hệ đang mở. Đổi trạng thái ở một tab lọc làm liên hệ rời khỏi danh sách thì khung chuyển sang liên hệ kế tiếp (đóng nếu hết),
   * để xử lý liền tay không bị đóng đột ngột.
   */
  async function updateOpen(lead: Lead, patch: LeadPatch) {
    const index = leads.findIndex((item) => item.id === lead.id);
    const saved = await update(lead.id, patch);
    if (saved && index >= 0 && patch.status !== undefined && filter !== "all" && patch.status !== filter) {
      const neighbour = leads[index + 1] ?? leads[index - 1];
      if (neighbour) setOpenId(neighbour.id); else closePanel();
    }
    return saved;
  }

  function goTo(offset: number) {
    const neighbour = leads[openIndex + offset];
    if (neighbour) setOpenId(neighbour.id);
  }

  // Xem mọi liên hệ cùng số điện thoại: tìm theo số (tìm kiếm khớp mọi cách viết) và bỏ lọc trạng thái, nguồn, người phụ trách.
  function showSamePhone(lead: Lead) {
    const digits = formatPhoneDisplay(lead.phone).digits;
    closePanel();
    setSearch(digits);
    navigate("all", 1, digits, { source: "all", assignee: "all", focus: "all" });
  }

  // Xóa một liên hệ rác từ khung chi tiết.
  async function deleteOpenLead(lead: Lead) {
    if (pending.current.has(lead.id) || !(await confirm({ title: `Xóa liên hệ của ${lead.name}?`, message: deleteMessage, confirmLabel: "Xóa liên hệ", tone: "danger" }))) return;
    pending.current.add(lead.id);
    setBusy(new Set(pending.current));
    try {
      const response = await fetch(`/api/v1/admin/leads/${lead.id}`, { method: "DELETE" });
      if (!response.ok) throw adminApiError(await readAdminJson(response), "Không thể xóa liên hệ.", response.status);
      showToast("Đã xóa liên hệ.", "success");
      closePanel();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      pending.current.delete(lead.id);
      setBusy(new Set(pending.current));
      if (pending.current.size === 0) startTransition(() => router.refresh());
    }
  }

  // Gộp các liên hệ đã chọn (cùng số điện thoại) thành liên hệ mới nhất; nội dung liên hệ cũ được ghi vào ghi chú của nó.
  async function mergeSelected() {
    if (merging || selectedLeads.length < 2) return;
    if (new Set(selectedLeads.map((lead) => formatPhoneDisplay(lead.phone).digits)).size > 1) { showToast("Chỉ gộp được các liên hệ cùng một số điện thoại.", "error"); return; }
    const newest = [...selectedLeads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    if (!(await confirm({ title: `Gộp ${selectedLeads.length} liên hệ của ${newest.name}?`, message: "Giữ lại liên hệ mới nhất; thiết bị, lời nhắn và trạng thái của các liên hệ cũ được ghi vào ghi chú nội bộ của nó, rồi các liên hệ cũ bị xóa khỏi danh sách và thông tin cá nhân trong đó bị xóa. Không hoàn tác được.", confirmLabel: "Gộp liên hệ", tone: "danger" }))) return;
    setMerging(true);
    try {
      const response = await fetch("/api/v1/admin/leads/merge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: selectedLeads.map((lead) => lead.id) }) });
      const payload = await readAdminJson(response);
      if (!response.ok) throw adminApiError(payload, "Không thể gộp liên hệ.", response.status);
      const parsed = leadMergeResponseSchema.safeParse(payload.merge);
      if (!parsed.success) throw new Error("Phản hồi gộp liên hệ không hợp lệ. Tải lại danh sách để kiểm tra.");
      showToast(`Đã gộp ${parsed.data.mergedCount + 1} liên hệ thành một. Nội dung liên hệ cũ nằm trong ghi chú nội bộ.`, "success");
      clear();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      setMerging(false);
      startTransition(() => router.refresh());
    }
  }

  const columns: AdminDataTableColumn<Lead>[] = [
    { id: "name", label: "Khách hàng", defaultWidth: 170, minWidth: 140, sortKey: "name", cell: (lead) => <span className="grid justify-items-start gap-0.5">
      <button className="admin-list-manager__identity" onClick={(event) => { event.stopPropagation(); setOpenId(lead.id); }} type="button"><strong>{lead.name}</strong></button>
      {lead.sameCustomerCount > 1 || lead.internalNote ? <span className="admin-text-muted inline-flex items-center gap-2 text-xs">
        {lead.sameCustomerCount > 1 ? <span className="inline-flex items-center gap-1" title={`Số điện thoại này đã gửi ${lead.sameCustomerCount} liên hệ`}><Repeat aria-hidden="true" size={12} />Gửi {lead.sameCustomerCount} lần</span> : null}
        {lead.internalNote ? <span className="inline-flex items-center gap-1" title={lead.internalNote}><StickyNote aria-hidden="true" size={12} />Có ghi chú</span> : null}
      </span> : null}
    </span> },
    { id: "phone", label: "Điện thoại", defaultWidth: 195, minWidth: 150, cell: (lead) => {
      const phone = phoneLinks(lead.phone);
      return <span className="grid justify-items-start gap-0.5">
        <span className="inline-flex items-center gap-1"><a href={phone.tel} onClick={(event) => event.stopPropagation()}>{phone.text}</a><LeadPhoneActions raw={lead.phone} /></span>
        {phone.valid ? null : <AdminStatusBadge tone="warning">Số chưa chuẩn</AdminStatusBadge>}
      </span>;
    } },
    { id: "email", label: "Email", defaultWidth: 180, minWidth: 130, defaultHidden: true, cell: (lead) => lead.email ? <a className="admin-text-muted" href={`mailto:${lead.email}`}>{lead.email}</a> : <span className="admin-text-muted">—</span> },
    // Liên hệ hỏi mua thiết bị hiện thẻ thiết bị (tên, tình trạng, giá lúc hỏi); liên hệ chung hiện nhu cầu khách chọn.
    { id: "need", label: "Nhu cầu / thiết bị", defaultWidth: 250, minWidth: 170, cell: (lead) => lead.context ? <span className="grid gap-1">
      <a className="admin-link" href={`/admin/equipment/${lead.context.equipmentId}`} onClick={(event) => event.stopPropagation()}>{lead.context.name}</a>
      <span className="admin-text-muted"><AdminStatusBadge tone={availabilityTone[lead.context.availability]}>{equipmentAvailabilityLabels[lead.context.availability]}</AdminStatusBadge> · {priceFormatter.format(lead.context.priceVnd)}</span>
    </span> : <span title={[lead.need, lead.businessModel].filter(Boolean).join(" · ")}>{lead.need ?? "—"}{lead.businessModel ? <span className="admin-text-muted"> · {lead.businessModel}</span> : null}</span> },
    { id: "assignee", label: "Phụ trách", defaultWidth: 185, minWidth: 150, cell: (lead) => <span onClick={(event) => event.stopPropagation()}><LeadAssigneeSelect assignees={assignees} disabled={loading || busy.has(lead.id) || !canUpdate} label={`Người phụ trách của ${lead.name}`} lead={lead} onChange={(assignedTo) => update(lead.id, { assignedTo })} userId={userId} /></span> },
    { id: "createdAt", label: "Gửi lúc", defaultWidth: 135, minWidth: 120, sortKey: "createdAt", sortFirst: "desc", cell: (lead) => <LeadAge lead={lead} /> },
    { id: "status", label: "Trạng thái", defaultWidth: 140, minWidth: 130, cell: (lead) => <LeadStatusSelect disabled={loading || busy.has(lead.id) || !canUpdate} label={`Trạng thái của ${lead.name}`} lead={lead} onChange={(status) => update(lead.id, { status })} /> },
  ];

  const counts = initialPage.counts;
  const filterItems: Array<{ label: string; value: "all" | LeadStatus }> = [
    { label: `Tất cả (${counts.all})`, value: "all" },
    ...statuses.map((status) => ({ label: `${statusLabel[status]} (${counts[status]})`, value: status })),
  ];
  const exportParams = (format: "xlsx" | "csv") => new URLSearchParams(Object.entries({ format, status: filter, source: source === "all" ? "" : source, assignee: assigneeFilter === "all" ? "" : assigneeFilter, focus: focus === "all" ? "" : focus, query: initialQuery.query, from: initialQuery.from, to: initialQuery.to, sort: initialQuery.sort, dir: initialQuery.dir }).filter(([, value]) => value) as [string, string][]);
  const sort: AdminTableSort = initialQuery.sort ? { key: initialQuery.sort, dir: initialQuery.dir ?? "desc" } : null;
  const filtered = Boolean(initialQuery.query || initialQuery.from || initialQuery.to || source !== "all" || assigneeFilter !== "all" || focus !== "all");
  const selectedLeads = leads.filter((lead) => selectedIds.includes(lead.id));
  const assigneeFilterLabel = assigneeFilter === "me" ? "Của tôi" : assigneeFilter === "unassigned" ? "Chưa giao" : assignees.find((person) => person.id === assigneeFilter)?.name ?? "Người khác";

  function bulkStatus(status: LeadStatus) {
    const items = selectedLeads.filter((lead) => lead.status !== status);
    if (!items.length) { showToast(`Các liên hệ đã chọn đều đang ở “${statusLabel[status]}”.`, "info"); return; }
    void run({ items, request: (lead) => ({ method: "PATCH", url: `/api/v1/admin/leads/${lead.id}`, body: { status } }), verb: "Cập nhật", noun: "liên hệ", onDone: clear });
  }

  function bulkAssign(assignedTo: string | null) {
    const items = selectedLeads.filter((lead) => lead.assignedToId !== assignedTo);
    if (!items.length) { showToast("Các liên hệ đã chọn đều đang ở đúng người phụ trách này.", "info"); return; }
    void run({ items, request: (lead) => ({ method: "PATCH", url: `/api/v1/admin/leads/${lead.id}`, body: { assignedTo } }), verb: assignedTo ? "Giao" : "Bỏ giao", noun: "liên hệ", onDone: clear });
  }

  function bulkDelete() {
    void run({ items: selectedLeads, request: (lead) => ({ method: "DELETE", url: `/api/v1/admin/leads/${lead.id}` }), verb: "Xóa", noun: "liên hệ", confirmMessage: deleteMessage, tone: "danger", onDone: clear });
  }

  const updateDenied = canUpdate ? undefined : "Cần quyền cập nhật liên hệ.";
  const deleteDenied = canDelete ? undefined : "Cần quyền xóa liên hệ.";
  const bulkActions: AdminBulkMenuAction[] = [
    ...statuses.map((status) => ({ key: status, group: "Trạng thái", label: `Chuyển sang “${statusLabel[status]}”`, icon: statusIcons[status], count: selectedLeads.filter((lead) => lead.status !== status).length, disabledReason: updateDenied, onSelect: () => bulkStatus(status) })),
    ...(userId && myName ? [{ key: "assign-me", group: "Giao việc", label: "Giao cho tôi", icon: <UserCheck aria-hidden="true" />, count: selectedLeads.filter((lead) => lead.assignedToId !== userId).length, disabledReason: updateDenied, onSelect: () => bulkAssign(userId) }] : []),
    ...assignees.filter((person) => person.id !== userId).map((person) => ({ key: `assign-${person.id}`, group: "Giao việc", label: `Giao cho ${person.name}`, icon: <UserPlus aria-hidden="true" />, count: selectedLeads.filter((lead) => lead.assignedToId !== person.id).length, disabledReason: updateDenied, onSelect: () => bulkAssign(person.id) })),
    { key: "unassign", group: "Giao việc", label: "Bỏ giao", icon: <UserMinus aria-hidden="true" />, count: selectedLeads.filter((lead) => lead.assignedToId).length, disabledReason: updateDenied, onSelect: () => bulkAssign(null) },
    { key: "merge", group: "Dọn dẹp", label: "Gộp các liên hệ cùng số", icon: <GitMerge aria-hidden="true" />, count: selectedLeads.length, disabledReason: deleteDenied ?? (selectedLeads.length < 2 ? "Chọn từ 2 liên hệ cùng số điện thoại trở lên." : undefined), onSelect: () => void mergeSelected() },
    { key: "delete", group: "Dọn dẹp", label: "Xóa liên hệ rác", icon: <Trash2 aria-hidden="true" />, count: selectedLeads.length, tone: "danger", disabledReason: deleteDenied, onSelect: bulkDelete },
  ];

  const chips: AdminFilterChip[] = [
    ...(initialQuery.query ? [{ key: "query", label: `Từ khóa: “${initialQuery.query}”`, onRemove: () => { setSearch(""); navigate(filter, 1, ""); } }] : []),
    ...(source !== "all" ? [{ key: "source", label: `Nguồn: ${sourceLabels[source]}`, onRemove: () => navigate(filter, 1, initialQuery.query, { source: "all" }) }] : []),
    ...(assigneeFilter !== "all" ? [{ key: "assignee", label: `Phụ trách: ${assigneeFilterLabel}`, onRemove: () => navigate(filter, 1, initialQuery.query, { assignee: "all" }) }] : []),
    ...(focus !== "all" ? [{ key: "focus", label: `Chỉ hiện: ${focusLabels[focus]}`, onRemove: () => navigate(filter, 1, initialQuery.query, { focus: "all" }) }] : []),
    ...(initialQuery.from || initialQuery.to ? [{ key: "period", label: `Thời gian: ${periodChipLabel(initialQuery.from, initialQuery.to)}`, onRemove: () => navigate(filter, 1, initialQuery.query, { from: undefined, to: undefined }) }] : []),
  ];

  return <AdminListPage variant="dense">
    <AdminCard>
      <AdminListHeader actions={counts.all ? <>
        <a className="admin-button admin-button--export admin-file-tone--excel" download href={`/api/v1/admin/leads/export?${exportParams("xlsx")}`} title="Tải Excel theo bộ lọc đang xem"><FileSpreadsheet aria-hidden="true" size={16} />Xuất Excel</a>
        <a className="admin-button admin-button--ghost admin-file-tone--csv" download href={`/api/v1/admin/leads/export?${exportParams("csv")}`} title="Tải CSV theo bộ lọc đang xem"><FileSpreadsheet aria-hidden="true" size={16} />CSV</a>
      </> : undefined} description={loading ? "Đang tải danh sách liên hệ…" : `${initialPage.total} liên hệ${filtered ? " khớp bộ lọc" : ""} · ${counts.new} mới cần xử lý`} title="Khách hàng tiềm năng" />
      <AdminFilterTabs ariaLabel="Lọc liên hệ" disabled={loading || busy.size > 0} items={filterItems} onValueChange={value => navigate(value)} value={filter} />
      <AdminFilterBar chips={chips} more={<>
        <select aria-label="Nguồn liên hệ" disabled={loading || busy.size > 0} onChange={(event) => navigate(filter, 1, initialQuery.query, { source: event.target.value as LeadSource })} value={source}>
          {(Object.keys(sourceLabels) as LeadSource[]).map((value) => <option key={value} value={value}>{sourceLabels[value]}</option>)}
        </select>
        <AdminPeriodFilter disabled={loading} from={initialQuery.from} label="Khoảng thời gian gửi" onChange={({ from, to }) => navigate(filter, 1, initialQuery.query, { from, to })} to={initialQuery.to} />
      </>} moreActiveCount={[source !== "all", Boolean(initialQuery.from || initialQuery.to)].filter(Boolean).length} onClearAll={() => { setSearch(""); navigate(filter, 1, "", { from: undefined, to: undefined, source: "all", assignee: "all", focus: "all" }); }} onSubmit={(event) => { event.preventDefault(); navigate(filter, 1, search.trim()); }} search={<AdminSearchField disabled={loading || busy.size > 0} label="Tìm liên hệ" onChange={event => setSearch(event.target.value)} placeholder="Tên, điện thoại, email hoặc nhu cầu" value={search} />}>
        <select aria-label="Người phụ trách" disabled={loading || busy.size > 0} onChange={(event) => navigate(filter, 1, initialQuery.query, { assignee: event.target.value })} value={assigneeFilter}>
          <option value="all">Mọi người phụ trách</option>
          {userId ? <option value="me">Của tôi</option> : null}
          <option value="unassigned">Chưa giao</option>
          {assignees.filter((person) => person.id !== userId).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          {assigneeFilter !== "all" && assigneeFilter !== "me" && assigneeFilter !== "unassigned" && !assignees.some((person) => person.id === assigneeFilter) ? <option value={assigneeFilter}>Người đã nghỉ</option> : null}
        </select>
        <select aria-label="Chỉ hiện" disabled={loading || busy.size > 0} onChange={(event) => navigate(filter, 1, initialQuery.query, { focus: event.target.value as LeadFocus })} value={focus}>
          {(Object.keys(focusLabels) as LeadFocus[]).map((value) => <option key={value} value={value}>{value === "all" ? "Chỉ hiện: tất cả" : focusLabels[value]}</option>)}
        </select>
      </AdminFilterBar>
      <AdminBulkBar count={selectedLeads.length} onClear={clear}>
        <AdminBulkMenu busy={bulkBusy || merging} actions={bulkActions} />
      </AdminBulkBar>
      <AdminDataTable columns={columns} emptyMessage={filter === "all" && !filtered ? "Chưa có liên hệ nào. Liên hệ gửi từ biểu mẫu website sẽ xuất hiện tại đây." : "Không có liên hệ khớp bộ lọc. Thử đổi trạng thái, nguồn, người phụ trách, từ khóa hoặc khoảng thời gian."} getRowId={(lead) => lead.id} getRowLabel={(lead) => lead.name} onRowClick={(lead) => setOpenId(lead.id)} onSelectionChange={setSelectedIds} onSortChange={(next) => navigate(filter, 1, initialQuery.query, { sort: next?.key, dir: next?.dir })} rows={leads} selectedIds={selectedIds} sort={sort} tableId="leads" />
      <AdminPagination unit="liên hệ" disabled={loading || busy.size > 0} label="Phân trang liên hệ" onChange={(page) => navigate(filter, page)} onPageSizeChange={(pageSize) => navigate(filter, 1, initialQuery.query, { pageSize })} page={initialPage.page} pageSize={initialPage.pageSize} total={initialPage.total} totalPages={initialPage.totalPages} />
    </AdminCard>

    <AdminSidePanel
      footer={openLead ? <LeadDetailFooter
        busy={busy.has(openLead.id)} canDelete={canDelete} canUpdate={canUpdate} lead={openLead} onDelete={() => void deleteOpenLead(openLead)} onNext={() => goTo(1)} onPrevious={() => goTo(-1)}
        onStatus={(status) => void updateOpen(openLead, { status })} position={openIndex >= 0 ? { index: openIndex, total: leads.length } : null}
      /> : undefined}
      isOpen={openLead !== null} label="Chi tiết liên hệ" onClose={closePanel}
    >
      {openLead ? <LeadDetailPanel
        assignees={assignees} busy={busy.has(openLead.id)} canUpdate={canUpdate} key={openLead.id} lead={openLead} myName={myName}
        onShowSamePhone={() => showSamePhone(openLead)} onUpdate={(patch) => updateOpen(openLead, patch)} userId={userId}
      /> : null}
    </AdminSidePanel>
  </AdminListPage>;
}
