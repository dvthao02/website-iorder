"use client";

import { Inbox, Mail, MapPin, Phone, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminCard } from "./ui/admin-card";
import { AdminEmptyState } from "./ui/admin-empty-state";
import { AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";

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

export function LeadsManager({ initialLeads }: { initialLeads: Lead[] }) {
  const { show: showToast } = useAdminToast();
  const [leads, setLeads] = useState(initialLeads);
  const [filter, setFilter] = useState<"all" | LeadStatus>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const visibleLeads = useMemo(() => leads.filter((lead) => filter === "all" || lead.status === filter), [filter, leads]);

  async function update(id: string, status: LeadStatus) {
    setBusy(id);
    try {
      const response = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Không thể cập nhật liên hệ.");
      setLeads((rows) => rows.map((row) => row.id === id ? { ...row, status, handledAt: status === "new" ? null : new Date() } : row));
      showToast(`Đã chuyển liên hệ sang “${statusLabel[status]}”.`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      setBusy(null);
    }
  }

  const counts = {
    all: leads.length,
    new: leads.filter((lead) => lead.status === "new").length,
    contacted: leads.filter((lead) => lead.status === "contacted").length,
    closed: leads.filter((lead) => lead.status === "closed").length,
  };

  return <div className="grid gap-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <LeadSummary label="Tất cả liên hệ" value={counts.all} />
      <LeadSummary label="Cần xử lý" tone="amber" value={counts.new} />
      <LeadSummary label="Đã liên hệ" tone="blue" value={counts.contacted} />
      <LeadSummary label="Đã xử lý" tone="green" value={counts.closed} />
    </div>

    <AdminCard className="p-0">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
        <div><h2 className="text-lg font-extrabold text-slate-950">Hộp thư khách hàng</h2><p className="mt-1 text-sm text-slate-600">Ưu tiên liên hệ mới, cập nhật trạng thái ngay sau khi xử lý.</p></div>
        <div aria-label="Lọc liên hệ" className="flex flex-wrap gap-2">
          {(["all", "new", "contacted", "closed"] as const).map((value) => <button className={filter === value ? "rounded-full bg-blue-100 px-3 py-1.5 text-sm font-bold text-blue-800" : "rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-200"} key={value} onClick={() => setFilter(value)} type="button">{value === "all" ? "Tất cả" : statusLabel[value]} ({counts[value]})</button>)}
        </div>
      </header>

      <div className="grid gap-3 p-4">
        {visibleLeads.map((lead) => <article className="rounded-xl border border-slate-200 bg-white p-5" key={lead.id}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-extrabold text-slate-950">{lead.name}</h3><AdminStatusBadge tone={statusTone[lead.status]}>{statusLabel[lead.status]}</AdminStatusBadge></div>
              <p className="mt-1 text-xs text-slate-500">Gửi lúc {formatDateTime(lead.createdAt)}{lead.handledAt ? ` · Xử lý lúc ${formatDateTime(lead.handledAt)}` : ""}</p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-700"><a className="inline-flex items-center gap-2 font-semibold hover:text-blue-700" href={`tel:${lead.phone}`}><Phone aria-hidden="true" size={15} />{lead.phone}</a>{lead.email ? <a className="inline-flex items-center gap-2 hover:text-blue-700" href={`mailto:${lead.email}`}><Mail aria-hidden="true" size={15} />{lead.email}</a> : null}{lead.branches ? <span className="inline-flex items-center gap-2"><MapPin aria-hidden="true" size={15} />{lead.branches} chi nhánh</span> : null}</div>
              {(lead.businessModel || lead.need) ? <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{lead.businessModel || "Chưa nêu mô hình"}{lead.need ? ` · Nhu cầu: ${lead.need}` : ""}</p> : null}
              {lead.message ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{lead.message}</p> : null}
            </div>
            <label className="grid min-w-40 gap-1.5 text-sm font-bold text-slate-700">Trạng thái<select className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" disabled={busy === lead.id} onChange={(event) => update(lead.id, event.target.value as LeadStatus)} value={lead.status}><option value="new">{statusLabel.new}</option><option value="contacted">{statusLabel.contacted}</option><option value="closed">{statusLabel.closed}</option></select></label>
          </div>
        </article>)}
        {visibleLeads.length === 0 ? <AdminEmptyState description={leads.length === 0 ? "Liên hệ gửi từ biểu mẫu website sẽ xuất hiện tại đây và được sắp xếp mới nhất trước." : "Không có liên hệ nào ở trạng thái đã chọn."} icon={leads.length === 0 ? <Inbox aria-hidden="true" size={21} /> : <UsersRound aria-hidden="true" size={21} />} title={leads.length === 0 ? "Chưa có khách hàng tiềm năng" : "Không có kết quả"} /> : null}
      </div>
    </AdminCard>
  </div>;
}

function LeadSummary({ label, tone = "slate", value }: { label: string; tone?: "slate" | "amber" | "blue" | "green"; value: number }) {
  const toneClass = { slate: "bg-slate-50 text-slate-900", amber: "bg-amber-50 text-amber-900", blue: "bg-blue-50 text-blue-900", green: "bg-emerald-50 text-emerald-900" }[tone];
  return <section className={`rounded-xl border border-slate-200 p-4 ${toneClass}`}><p className="text-sm font-semibold opacity-75">{label}</p><strong className="mt-1 block text-2xl">{value}</strong></section>;
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
