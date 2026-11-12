"use client";

import { useState, type FormEvent } from "react";

import { AdminFilterBar, type AdminFilterChip } from "@/components/admin/ui/admin-filter-bar";
import { AdminPeriodFilter, periodChipLabel } from "@/components/admin/ui/admin-period-filter";
import { AdminSearchField } from "@/components/admin/ui/admin-search-field";
import { useListNavigation } from "@/components/admin/ui/use-list-navigation";
import { auditEntityLabels } from "./ui/audit-labels";

const verbOptions: [string, string][] = [
  ["create", "Tạo"], ["update", "Cập nhật"], ["delete", "Xóa"], ["archive", "Lưu trữ"], ["restore", "Khôi phục"],
  ["status_update", "Cập nhật trạng thái"], ["upload", "Tải lên"], ["export", "Xuất dữ liệu"],
  ["login", "Đăng nhập"], ["login_failed", "Đăng nhập thất bại"], ["logout", "Đăng xuất"], ["password_change", "Đổi mật khẩu"],
];

type Actor = { id: string; fullName: string; username: string };
type Initial = { query: string; entityType: string; userId?: string; verb?: string; from?: string; to?: string };

export function AuditLogFilters({ actors, initial }: { actors: Actor[]; initial: Initial }) {
  const { navigate, setFilter } = useListNavigation();
  const [query, setQuery] = useState(initial.query);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ page: undefined, query: query.trim() || undefined });
  }

  const actor = actors.find((item) => item.id === initial.userId);
  const chips: AdminFilterChip[] = [
    ...(initial.query ? [{ key: "query", label: `Từ khóa: “${initial.query}”`, onRemove: () => { setQuery(""); setFilter("query", undefined); } }] : []),
    ...(initial.userId ? [{ key: "userId", label: `Người thực hiện: ${actor?.fullName ?? "?"}`, onRemove: () => setFilter("userId", undefined) }] : []),
    ...(initial.from || initial.to ? [{ key: "period", label: `Thời gian: ${periodChipLabel(initial.from, initial.to)}`, onRemove: () => navigate({ page: undefined, from: undefined, to: undefined }) }] : []),
    ...(initial.verb ? [{ key: "verb", label: `Thao tác: ${verbOptions.find(([value]) => value === initial.verb)?.[1] ?? initial.verb}`, onRemove: () => setFilter("verb", undefined) }] : []),
    ...(initial.entityType ? [{ key: "entityType", label: `Đối tượng: ${auditEntityLabels[initial.entityType] ?? initial.entityType}`, onRemove: () => setFilter("entityType", undefined) }] : []),
  ];

  return <AdminFilterBar chips={chips} more={<>
    <select aria-label="Loại thao tác" onChange={(event) => setFilter("verb", event.target.value || undefined)} value={initial.verb ?? ""}>
      <option value="">Mọi thao tác</option>
      {verbOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
    <select aria-label="Loại đối tượng" onChange={(event) => setFilter("entityType", event.target.value || undefined)} value={initial.entityType}>
      <option value="">Mọi đối tượng</option>
      {Object.entries(auditEntityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  </>} moreActiveCount={[initial.verb, initial.entityType].filter(Boolean).length} onClearAll={() => { setQuery(""); navigate({ page: undefined, query: undefined, entityType: undefined, userId: undefined, verb: undefined, from: undefined, to: undefined }); }} onSubmit={submit} search={<AdminSearchField label="Tìm thao tác, người thực hiện hoặc IP" maxLength={160} onChange={(event) => setQuery(event.target.value)} placeholder="Thao tác, người thực hiện, IP" value={query} />}>
    <select aria-label="Người thực hiện" onChange={(event) => setFilter("userId", event.target.value || undefined)} value={initial.userId ?? ""}>
      <option value="">Mọi người thực hiện</option>
      {actors.map((item) => <option key={item.id} value={item.id}>{item.fullName} ({item.username})</option>)}
    </select>
    <AdminPeriodFilter from={initial.from} label="Khoảng thời gian" onChange={({ from, to }) => navigate({ page: undefined, from, to })} to={initial.to} />
  </AdminFilterBar>;
}
