"use client";

import { adminApiError } from "@/lib/admin-api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";

import type { AdminListPage as AdminListResult } from "@iorder/core/server/shared/admin-list.contract";
import type { EquipmentGroup, EquipmentItem } from "@/components/admin/equipment-manager";
import { AdminButton } from "@/components/admin/ui/admin-button";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { AdminContentActions } from "@/components/admin/ui/admin-content-actions";
import { useAdminConfirm } from "@/components/admin/ui/admin-confirm-dialog";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/ui/admin-data-table";
import { AdminStatusBadge, type AdminFeedbackTone, useAdminToast } from "@/components/admin/ui/admin-feedback";
import { AdminFilterBar, type AdminFilterChip } from "@/components/admin/ui/admin-filter-bar";
import { AdminListHeader } from "@/components/admin/ui/admin-list-header";
import { AdminListPage } from "@/components/admin/ui/admin-list-page";
import { AdminSearchField } from "@/components/admin/ui/admin-search-field";
import { AdminPagination } from "@/components/admin/ui/admin-pagination";
import { withSinglePendingAction } from "@/components/admin/ui/single-pending-action";
import { ContentBulkBar, useRowSelection } from "@/components/admin/ui/content-bulk-bar";
import { useListNavigation } from "@/components/admin/ui/use-list-navigation";
import { parseDeletedEntityId } from "@/lib/admin-detail-payload";
import { useAdminPermissions } from "./ui/admin-permissions";

const statusLabels: Record<EquipmentItem["status"], string> = { archived: "Lưu trữ", draft: "Bản nháp", published: "Đã xuất bản", review: "Chờ duyệt", scheduled: "Hẹn giờ" };
const priceFormatter = new Intl.NumberFormat("vi-VN");
const dateFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" });
const statusTones: Record<EquipmentItem["status"], AdminFeedbackTone> = { archived: "neutral", draft: "neutral", published: "success", review: "warning", scheduled: "info" };

type EquipmentManagerListProps = {
  groups: EquipmentGroup[];
  initialGroupId: string;
  initialQuery: string;
  initialStatus: "all" | EquipmentItem["status"];
  initialTab: "items" | "groups";
  result: AdminListResult<EquipmentItem>;
};

export function EquipmentManagerList({ groups, initialGroupId, initialQuery, initialStatus, initialTab, result }: EquipmentManagerListProps) {
  const activeTab = initialTab;
  const { navigate, searchParams, setFilter, setSort, sort } = useListNavigation();
  const [query, setQuery] = useState(initialQuery);
  const { selectedIds, setSelectedIds, clear } = useRowSelection(searchParams.toString());
  const chips: AdminFilterChip[] = [
    ...(initialQuery ? [{ key: "query", label: `Từ khóa: “${initialQuery}”`, onRemove: () => { setQuery(""); navigate({ page: undefined, query: undefined }); } }] : []),
    ...(initialGroupId !== "all" ? [{ key: "groupId", label: `Nhóm: ${groups.find((group) => group.id === initialGroupId)?.name ?? "?"}`, onRemove: () => setFilter("groupId", undefined) }] : []),
    ...(initialStatus !== "all" ? [{ key: "status", label: `Trạng thái: ${statusLabels[initialStatus]}`, onRemove: () => setFilter("status", undefined) }] : []),
  ];
  const filtered = chips.length > 0;
  const columns = useMemo<AdminDataTableColumn<EquipmentItem>[]>(() => [
    { id: "name", label: "Thiết bị", defaultWidth: 280, minWidth: 200, sortKey: "name", cell: (item) => <Link href={`/admin/thiet-bi/${item.id}`}>{item.name}</Link> },
    { id: "group", label: "Nhóm", defaultWidth: 180, minWidth: 140, sortKey: "group", cell: (item) => <span className="admin-text-muted">{item.groupName}</span> },
    { id: "model", label: "Model", defaultWidth: 150, minWidth: 120, cell: (item) => <span className="admin-text-muted">{item.modelCode ?? "—"}</span> },
    { id: "price", label: "Giá", defaultWidth: 130, minWidth: 110, align: "right", sortKey: "priceVnd", cell: (item) => <span className="admin-text-muted">{item.priceVnd ? `${priceFormatter.format(item.priceVnd)} ₫` : "Liên hệ"}</span> },
    { id: "status", label: "Trạng thái", defaultWidth: 150, minWidth: 130, sortKey: "status", cell: (item) => <AdminStatusBadge tone={statusTones[item.status]}>{statusLabels[item.status]}</AdminStatusBadge> },
    { id: "updatedAt", label: "Cập nhật", defaultWidth: 150, minWidth: 130, sortKey: "updatedAt", sortFirst: "desc", cell: (item) => <span className="admin-text-muted">{dateFormatter.format(new Date(item.updatedAt))}</span> },
    { id: "actions", label: "Thao tác", defaultWidth: 120, minWidth: 120, align: "right", cell: (item) => <AdminContentActions module="equipment" deleteMutation={item.status === "archived" ? { method: "DELETE", url: `/api/admin/equipment/${item.id}?expectedVersion=${item.version}` } : undefined} editHref={`/admin/thiet-bi/${item.id}`} isArchived={item.status === "archived"} label="thiết bị" mutation={{ method: "PATCH", url: `/api/admin/equipment/${item.id}`, body: { action: item.status === "archived" ? "restore" : "archive", expectedVersion: item.version } }} viewHref={item.status === "published" ? `/thiet-bi/${item.slug}` : undefined} /> },
  ], []);
  const groupColumns = useMemo<AdminDataTableColumn<EquipmentGroup>[]>(() => [
    { id: "name", label: "Nhóm thiết bị", defaultWidth: 280, minWidth: 200, sortValue: (group) => group.name, cell: (group) => <Link href={`/admin/thiet-bi/nhom?edit=${group.id}`}>{group.name}</Link> },
    { id: "slug", label: "Slug", defaultWidth: 220, minWidth: 160, cell: (group) => <span className="admin-text-muted">/{group.slug}</span> },
    { id: "visibility", label: "Hiển thị", defaultWidth: 150, minWidth: 130, sortValue: (group) => (group.isEnabled ? 0 : 1), cell: (group) => <AdminStatusBadge tone={group.isEnabled ? "success" : "neutral"}>{group.isEnabled ? "Đang hiển thị" : "Đã ẩn"}</AdminStatusBadge> },
    { id: "sort", label: "Thứ tự", defaultWidth: 120, minWidth: 100, sortValue: (group) => group.sortOrder, cell: (group) => <span className="admin-text-muted">{group.sortOrder}</span> },
    { id: "actions", label: "Thao tác", defaultWidth: 130, minWidth: 120, align: "right", cell: (group) => <EquipmentGroupActions group={group} /> },
  ], []);

  // Đổi tab bỏ toàn bộ bộ lọc/sắp xếp của tab kia.
  const tabHref = (tab?: string) => `/admin/thiet-bi${tab ? `?tab=${tab}` : ""}`;
  function submitSearch(event: FormEvent<HTMLFormElement>) { event.preventDefault(); navigate({ page: undefined, query: query.trim() || undefined }); }

  return <AdminListPage variant="dense">
    <AdminCard><AdminListHeader actions={<AdminButton hideWithoutPermission permission="equipment.create" href={activeTab === "items" ? "/admin/thiet-bi/moi" : "/admin/thiet-bi/nhom?create=1"} leadingIcon={<Plus aria-hidden="true" size={16} />}>{activeTab === "items" ? "Thêm thiết bị" : "Thêm nhóm thiết bị"}</AdminButton>} description={`${result.total} thiết bị${filtered ? " khớp bộ lọc" : ""} · ${groups.length} nhóm`} title="Thiết bị" />
      <div aria-label="Loại nội dung thiết bị" className="admin-view-tabs" role="tablist"><CollectionTab active={activeTab === "items"} href={tabHref()} label={`Thiết bị (${result.total})`} /><CollectionTab active={activeTab === "groups"} href={tabHref("groups")} label={`Nhóm thiết bị (${groups.length})`} /></div>
      {activeTab === "items" ? <><AdminFilterBar onSubmit={submitSearch} chips={chips} onClearAll={() => { setQuery(""); navigate({ page: undefined, query: undefined, status: undefined, groupId: undefined }); }} search={<AdminSearchField id="equipment-search" label="Tìm kiếm thiết bị" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, slug hoặc model" value={query} />}><select aria-label="Lọc theo nhóm" onChange={(event) => setFilter("groupId", event.target.value === "all" ? undefined : event.target.value)} value={initialGroupId}><option value="all">Tất cả nhóm</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select><select aria-label="Lọc theo trạng thái" onChange={(event) => setFilter("status", event.target.value === "all" ? undefined : event.target.value)} value={initialStatus}><option value="all">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></AdminFilterBar><ContentBulkBar items={result.items} module="equipment" noun="thiết bị" onClear={clear} request={(item, action) => ({ method: "PATCH", url: `/api/admin/equipment/${item.id}`, body: { action, expectedVersion: item.version } })} selectedIds={selectedIds} /><AdminDataTable columns={columns} emptyMessage={filtered ? "Không có thiết bị khớp bộ lọc." : "Chưa có thiết bị nào."} getRowId={(item) => item.id} onSelectionChange={setSelectedIds} onSortChange={setSort} rows={result.items} selectedIds={selectedIds} sort={sort} tableId="equipment" /><AdminPagination page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} onChange={(page) => navigate({ page: page === 1 ? undefined : String(page) })} /></> : <AdminDataTable columns={groupColumns} emptyMessage="Chưa có nhóm thiết bị nào. Hãy tạo nhóm trước khi thêm thiết bị." getRowId={(group) => group.id} rows={groups} tableId="equipment-groups" />}
    </AdminCard>
  </AdminListPage>;
}

function CollectionTab({ active, href, label }: { active: boolean; href: string; label: string }) { return <Link aria-selected={active} className={active ? "admin-view-tabs__tab admin-view-tabs__tab--active" : "admin-view-tabs__tab"} href={href} role="tab">{label}</Link>; }

function EquipmentGroupActions({ group }: { group: EquipmentGroup }) {
  const { can } = useAdminPermissions();
  const router = useRouter();
  const { confirm } = useAdminConfirm();
  const { show } = useAdminToast();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  async function remove() {
    if (pending.current) return;
    if (!await confirm({ title: "Xác nhận xóa nhóm thiết bị", message: `Xóa nhóm “${group.name}” khỏi CMS? Chỉ nhóm không còn thiết bị mới có thể xóa.`, confirmLabel: "Xóa", tone: "danger" })) return;
    return withSinglePendingAction(pending, async () => {
    setBusy(true);
    try {
      const requestUrl = `/api/admin/equipment/${group.id}?kind=groups`;
      const response = await fetch(requestUrl, { method: "DELETE" });
      const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      if (!response.ok) throw adminApiError(payload, "Không thể xóa nhóm thiết bị.");
      parseDeletedEntityId(payload, requestUrl);
      show("Đã xóa nhóm thiết bị khỏi CMS.", "success");
      router.refresh();
    } catch (error) {
      show(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      setBusy(false);
    }
    });
  }

  return <span className="admin-content-actions">
    <Link aria-label={`Chỉnh sửa nhóm ${group.name}`} className="admin-content-actions__button admin-content-actions__edit" href={`/admin/thiet-bi/nhom?edit=${group.id}`} title={`Chỉnh sửa nhóm ${group.name}`}><Pencil aria-hidden="true" size={16} /></Link>
    {can("equipment.delete") ? <button aria-busy={busy} aria-label={`Xóa nhóm ${group.name}`} className="admin-content-actions__button admin-content-actions__delete" disabled={busy} onClick={() => void remove()} title={`Xóa nhóm ${group.name}`} type="button">{busy ? <LoaderCircle aria-hidden="true" className="admin-content-actions__spinner" size={16} /> : <Trash2 aria-hidden="true" size={16} />}</button> : null}
  </span>;
}
