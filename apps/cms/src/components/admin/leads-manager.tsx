"use client";

import { Inbox, Mail, MapPin, Phone, UsersRound } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LeadListQuery } from "@iorder/core/server/leads/leads.contract";
import type { AdminListPage as ListResult } from "@iorder/core/server/shared/admin-list.contract";
import { AdminButton } from "./ui/admin-button";
import { AdminInput } from "./ui/admin-input";
import { leadStatusUpdateResponseSchema } from "@iorder/core/server/leads/leads.contract";

import { AdminCard } from "./ui/admin-card";
import { AdminEmptyState } from "./ui/admin-empty-state";
import { AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";
import { AdminFilterBar } from "./ui/admin-filter-bar";
import { AdminFilterTabs } from "./ui/admin-filter-tabs";
import { AdminListHeader } from "./ui/admin-list-header";
import { AdminListPage } from "./ui/admin-list-page";
import { AdminMetricGrid } from "./ui/admin-metric-grid";
import { AdminPagination } from "./ui/admin-pagination";
import { useNavigationGuard } from "./ui/use-navigation-guard";

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

export function LeadsManager({ initialPage, initialQuery }: { initialPage: ListResult<Lead> & { counts: Record<"all" | LeadStatus, number> }; initialQuery: LeadListQuery }) {
  const router = useRouter();
  const [loading, startTransition] = useTransition();
  const { show: showToast } = useAdminToast();
  const leads = initialPage.items;
  const filter = initialQuery.status;
  const [search, setSearch] = useState(initialQuery.query);
  const pending = useRef(new Set<string>());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  useNavigationGuard(busy.size > 0, () => showToast("Đang cập nhật liên hệ. Vui lòng chờ trước khi rời trang.", "info"));
  const visibleLeads = leads;
  function navigate(status: LeadListQuery["status"], page = 1, query = initialQuery.query) {
    if (pending.current.size || loading) return;
    const params = new URLSearchParams({ status, page: String(page), pageSize: String(initialQuery.pageSize), query });
    startTransition(() => router.push(`/admin/khach-hang-tiem-nang?${params}`, { scroll: false }));
  }

  async function update(id: string, status: LeadStatus) {
    if (loading || pending.current.has(id) || leads.find(lead => lead.id === id)?.status === status) return;
    pending.current.add(id);
    setBusy(new Set(pending.current));
    try {
      const response = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Không thể cập nhật liên hệ.");
      const parsed = leadStatusUpdateResponseSchema.safeParse(payload.lead);
      if (!parsed.success) throw new Error("Phản hồi cập nhật liên hệ không hợp lệ. Tải lại danh sách để kiểm tra.");
      const saved = parsed.data;
      if (saved.id !== id || saved.status !== status) throw new Error("Phản hồi cập nhật liên hệ không khớp. Tải lại danh sách để kiểm tra trước khi thử lại.");
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

  const counts = initialPage.counts;
  const filterItems: Array<{ label: string; value: "all" | LeadStatus }> = [
    { label: `Tất cả (${counts.all})`, value: "all" },
    { label: `${statusLabel.new} (${counts.new})`, value: "new" },
    { label: `${statusLabel.contacted} (${counts.contacted})`, value: "contacted" },
    { label: `${statusLabel.closed} (${counts.closed})`, value: "closed" },
  ];

  return <AdminListPage>
    <AdminMetricGrid items={[
      { label: "Tất cả liên hệ", value: counts.all },
      { label: "Cần xử lý", tone: "amber", value: counts.new },
      { label: "Đã liên hệ", tone: "blue", value: counts.contacted },
      { label: "Đã xử lý", tone: "green", value: counts.closed },
    ]} />

    <AdminCard className="p-0">
      <div className="p-5">
        <AdminListHeader description="Ưu tiên liên hệ mới, cập nhật trạng thái ngay sau khi xử lý." title="Hộp thư khách hàng" />
        {initialQuery.query ? <p className="text-sm text-[var(--cms-muted)]">Số liệu bên trên và các tab tính theo từ khóa “{initialQuery.query}”.</p> : null}
        <AdminFilterBar onSubmit={(event) => { event.preventDefault(); navigate(filter, 1, search.trim()); }}>
          <AdminFilterTabs ariaLabel="Lọc liên hệ" disabled={loading || busy.size > 0} items={filterItems} onValueChange={value => navigate(value)} value={filter} />
          <AdminInput aria-label="Tìm liên hệ" disabled={loading || busy.size > 0} onChange={event => setSearch(event.target.value)} placeholder="Tên, điện thoại, email hoặc nhu cầu" value={search} />
          <AdminButton disabled={loading || busy.size > 0} type="submit">Tìm kiếm</AdminButton>
        </AdminFilterBar>
        {loading ? <p role="status">Đang tải danh sách liên hệ…</p> : null}
      </div>

      <div className="grid gap-3 p-4">
        {visibleLeads.map((lead) => <article className="rounded-xl border border-[var(--cms-border)] bg-[var(--cms-card)] p-5" key={lead.id}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-extrabold text-[var(--cms-text)]">{lead.name}</h3><AdminStatusBadge tone={statusTone[lead.status]}>{statusLabel[lead.status]}</AdminStatusBadge></div>
              <p className="mt-1 text-xs text-[var(--cms-muted)]">Gửi lúc {formatDateTime(lead.createdAt)}{lead.handledAt ? ` · Xử lý lúc ${formatDateTime(lead.handledAt)}` : ""}</p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--cms-text)]"><a className="inline-flex items-center gap-2 font-semibold hover:text-blue-700" href={`tel:${lead.phone}`}><Phone aria-hidden="true" size={15} />{lead.phone}</a>{lead.email ? <a className="inline-flex items-center gap-2 hover:text-blue-700" href={`mailto:${lead.email}`}><Mail aria-hidden="true" size={15} />{lead.email}</a> : null}{lead.branches ? <span className="inline-flex items-center gap-2"><MapPin aria-hidden="true" size={15} />{lead.branches} chi nhánh</span> : null}</div>
              {(lead.businessModel || lead.need) ? <p className="mt-4 rounded-lg bg-[var(--cms-hover)] px-3 py-2 text-sm text-[var(--cms-text)]">{lead.businessModel || "Chưa nêu mô hình"}{lead.need ? ` · Nhu cầu: ${lead.need}` : ""}</p> : null}
              {lead.message ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--cms-text)]">{lead.message}</p> : null}
            </div>
            <label className="grid min-w-40 gap-1.5 text-sm font-bold text-[var(--cms-text)]">Trạng thái<select className="rounded-lg border border-[var(--cms-border)] bg-[var(--cms-card)] px-3 py-2 font-normal" disabled={loading || busy.has(lead.id)} onChange={(event) => update(lead.id, event.target.value as LeadStatus)} value={lead.status}><option value="new">{statusLabel.new}</option><option value="contacted">{statusLabel.contacted}</option><option value="closed">{statusLabel.closed}</option></select></label>
          </div>
        </article>)}
        {visibleLeads.length === 0 ? <AdminEmptyState description={filter === "all" && !initialQuery.query ? "Liên hệ gửi từ biểu mẫu website sẽ xuất hiện tại đây và được sắp xếp mới nhất trước." : "Không có liên hệ khớp bộ lọc. Thử đổi trạng thái hoặc từ khóa."} icon={filter === "all" && !initialQuery.query ? <Inbox aria-hidden="true" size={21} /> : <UsersRound aria-hidden="true" size={21} />} title={filter === "all" && !initialQuery.query ? "Chưa có khách hàng tiềm năng" : "Không có kết quả"} /> : null}
      </div>
      <AdminPagination className="border-t border-[var(--cms-border)] p-4" disabled={loading || busy.size > 0} label="Phân trang liên hệ" onChange={(page) => navigate(filter, page)} page={initialPage.page} pageSize={initialPage.pageSize} total={initialPage.total} totalPages={initialPage.totalPages} />
    </AdminCard>
  </AdminListPage>;
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
