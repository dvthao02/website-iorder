"use client";

import { adminApiError } from "@/lib/admin-api";
import { Download, Inbox, Mail, MapPin, Phone, UsersRound } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LeadListQuery } from "@iorder/core/server/leads/leads.contract";
import type { AdminListPage as ListResult } from "@iorder/core/server/shared/admin-list.contract";
import { leadStatusUpdateResponseSchema } from "@iorder/core/server/leads/leads.contract";

import { AdminCard } from "./ui/admin-card";
import { AdminEmptyState } from "./ui/admin-empty-state";
import { AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";
import { AdminFilterBar } from "./ui/admin-filter-bar";
import { AdminFilterTabs } from "./ui/admin-filter-tabs";
import { AdminListHeader } from "./ui/admin-list-header";
import { AdminListPage } from "./ui/admin-list-page";
import { AdminSearchField } from "./ui/admin-search-field";
import { AdminPagination } from "./ui/admin-pagination";
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
      if (!response.ok) throw adminApiError(payload, "Không thể cập nhật liên hệ.");
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
    <AdminCard>
      <AdminListHeader actions={counts.all ? <a className="admin-button admin-button--secondary" download href={`/api/admin/leads/export?${new URLSearchParams({ status: filter, ...(initialQuery.query ? { query: initialQuery.query } : {}) })}`}><Download aria-hidden="true" />Xuất CSV</a> : undefined} description={loading ? "Đang tải danh sách liên hệ…" : initialQuery.query ? `${counts.all} liên hệ khớp “${initialQuery.query}”` : `${counts.new} liên hệ mới cần xử lý`} title="Khách hàng tiềm năng" />
      <AdminFilterTabs ariaLabel="Lọc liên hệ" disabled={loading || busy.size > 0} items={filterItems} onValueChange={value => navigate(value)} value={filter} />
      <AdminFilterBar onSubmit={(event) => { event.preventDefault(); navigate(filter, 1, search.trim()); }}>
        <AdminSearchField disabled={loading || busy.size > 0} label="Tìm liên hệ" onChange={event => setSearch(event.target.value)} placeholder="Tên, điện thoại, email hoặc nhu cầu" value={search} />
      </AdminFilterBar>

      <div className="admin-stack-list">
        {visibleLeads.map((lead) => <article key={lead.id}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h3>{lead.name}</h3><AdminStatusBadge tone={statusTone[lead.status]}>{statusLabel[lead.status]}</AdminStatusBadge></div>
              <p className="admin-field__hint">Gửi lúc {formatDateTime(lead.createdAt)}{lead.handledAt ? ` · Xử lý lúc ${formatDateTime(lead.handledAt)}` : ""}</p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px]"><a className="inline-flex items-center gap-1.5 hover:text-[var(--cms-primary)]" href={`tel:${lead.phone}`}><Phone aria-hidden="true" size={15} />{lead.phone}</a>{lead.email ? <a className="inline-flex items-center gap-2 hover:text-[var(--cms-primary)]" href={`mailto:${lead.email}`}><Mail aria-hidden="true" size={15} />{lead.email}</a> : null}{lead.branches ? <span className="inline-flex items-center gap-2"><MapPin aria-hidden="true" size={15} />{lead.branches} chi nhánh</span> : null}</div>
              {(lead.businessModel || lead.need) ? <p className="admin-help mt-2">{lead.businessModel || "Chưa nêu mô hình"}{lead.need ? ` · Nhu cầu: ${lead.need}` : ""}</p> : null}
              {lead.message ? <p className="mt-2 whitespace-pre-wrap text-[13px]">{lead.message}</p> : null}
            </div>
            <label className="admin-field min-w-40">Trạng thái<select disabled={loading || busy.has(lead.id) || !can("leads.update")} onChange={(event) => update(lead.id, event.target.value as LeadStatus)} value={lead.status}><option value="new">{statusLabel.new}</option><option value="contacted">{statusLabel.contacted}</option><option value="closed">{statusLabel.closed}</option></select></label>
          </div>
        </article>)}
        {visibleLeads.length === 0 ? <AdminEmptyState description={filter === "all" && !initialQuery.query ? "Liên hệ gửi từ biểu mẫu website sẽ xuất hiện tại đây và được sắp xếp mới nhất trước." : "Không có liên hệ khớp bộ lọc. Thử đổi trạng thái hoặc từ khóa."} icon={filter === "all" && !initialQuery.query ? <Inbox aria-hidden="true" size={21} /> : <UsersRound aria-hidden="true" size={21} />} title={filter === "all" && !initialQuery.query ? "Chưa có khách hàng tiềm năng" : "Không có kết quả"} /> : null}
      </div>
      <AdminPagination disabled={loading || busy.size > 0} label="Phân trang liên hệ" onChange={(page) => navigate(filter, page)} page={initialPage.page} pageSize={initialPage.pageSize} total={initialPage.total} totalPages={initialPage.totalPages} />
    </AdminCard>
  </AdminListPage>;
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
