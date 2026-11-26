"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { auditPurgeDays } from "@iorder/shared/server/audit/audit.contract";
import { requestAdminJson } from "@/lib/admin-api";
import { AdminButton } from "./ui/admin-button";
import { AdminRadio } from "./ui/admin-radio";
import { AdminSelect } from "./ui/admin-select";
import { useAdminToast } from "./ui/admin-feedback";
import { AdminTypedConfirmDialog } from "./ui/admin-typed-confirm-dialog";

type Mode = "selected" | "filtered" | "older_than" | "all";
export type AuditPurgeFilter = { query?: string; entityType?: string; userId?: string; verb?: string; from?: string; to?: string };

const dayLabels: Record<(typeof auditPurgeDays)[number], string> = { 1: "1 ngày", 7: "7 ngày", 30: "30 ngày", 90: "90 ngày", 180: "6 tháng", 365: "1 năm" };
const count = (value: number) => value.toLocaleString("vi-VN");

/** Vì sao nút Xóa đang khóa: không có dòng nào trong phạm vi đã chọn, kèm gợi ý đổi phạm vi (nhật ký còn mới thì các mốc dài đều trống). */
function emptyMessage(mode: Mode, days: number) {
  const keep = "Các dòng ghi việc xóa nhật ký luôn được giữ lại.";
  if (mode === "older_than") return `Không có dòng nào cũ hơn ${dayLabels[days as keyof typeof dayLabels] ?? `${days} ngày`}. Nhật ký còn mới nên hãy chọn khoảng ngắn hơn, hoặc “Toàn bộ nhật ký” (gõ “xóa hết” để xác nhận). ${keep}`;
  if (mode === "all") return `Nhật ký không còn dòng nào để xóa. ${keep}`;
  return `Không có dòng nào để xóa trong phạm vi này. ${keep}`;
}

function requestBody(mode: Mode, days: number, selectedIds: string[], filter: AuditPurgeFilter | null) {
  if (mode === "selected") return { mode, ids: selectedIds };
  if (mode === "filtered") return { mode, filter: Object.fromEntries(Object.entries(filter ?? {}).filter(([, value]) => value)) };
  if (mode === "older_than") return { mode, days };
  return { mode };
}

/**
 * Hộp "Xóa nhật ký hoạt động" (chỉ Super Admin): chọn phạm vi, thấy trước số dòng sẽ bị xóa, gõ chữ để xác nhận. Việc xóa luôn
 * được ghi lại bằng một dòng "Xóa nhật ký hoạt động" (ai, lúc nào, phạm vi, số dòng) mà chính thao tác xóa không bao giờ xóa.
 */
export function AuditLogPurgeDialog({ filter, onClose, onDone, selectedIds }: { filter: AuditPurgeFilter | null; onClose: () => void; onDone: () => void; selectedIds: string[] }) {
  const { show } = useAdminToast();
  const [mode, setMode] = useState<Mode>(selectedIds.length ? "selected" : filter ? "filtered" : "older_than");
  const [days, setDays] = useState<number>(90);
  const [affected, setAffected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef(0);

  async function fetchCount(nextMode: Mode, nextDays: number) {
    const ticket = ++latest.current;
    try {
      const result = await requestAdminJson("/api/v1/admin/audit", "POST", { ...requestBody(nextMode, nextDays, selectedIds, filter), dryRun: true }, "Không đếm được số dòng sẽ xóa.") as { affected: number };
      if (ticket === latest.current) setAffected(result.affected);
    } catch (error) {
      if (ticket === latest.current) show(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    }
  }
  // Đếm lần đầu khi mở hộp (chỉ một lần); các lần sau do người dùng đổi phạm vi. fetchCount chỉ gọi setState sau await, không đồng bộ.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void fetchCount(mode, days); }, []);

  function choose(nextMode: Mode, nextDays = days) {
    setMode(nextMode);
    setDays(nextDays);
    setAffected(null);
    void fetchCount(nextMode, nextDays);
  }

  async function confirm() {
    setBusy(true);
    try {
      const result = await requestAdminJson("/api/v1/admin/audit", "POST", { ...requestBody(mode, days, selectedIds, filter), dryRun: false }, "Không dọn được nhật ký lúc này.") as { affected: number };
      show(`Đã xóa ${count(result.affected)} thao tác khỏi nhật ký.`, "success");
      onDone();
    } catch (error) {
      show(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      setBusy(false);
    }
  }

  const option = (value: Mode, label: ReactNode) => <AdminRadio checked={mode === value} disabled={busy} name="audit-purge-mode" onChange={() => choose(value)}>{label}</AdminRadio>;
  return <AdminTypedConfirmDialog busy={busy} confirmDisabled={affected === null || affected === 0} confirmLabel={affected ? `Xóa ${count(affected)} thao tác` : "Xóa"} onClose={() => !busy && onClose()} onConfirm={() => void confirm()} title="Xóa nhật ký hoạt động?" word={mode === "all" ? "xóa hết" : "xóa"}>
    <div className="admin-purge__options" role="radiogroup" aria-label="Phạm vi xóa">
      {selectedIds.length ? option("selected", <span>Các dòng đã chọn ({count(selectedIds.length)})</span>) : null}
      {filter ? option("filtered", <span>Mọi dòng đang khớp bộ lọc hiện tại</span>) : null}
      {option("older_than", <span>Các dòng cũ hơn{" "}
        <AdminSelect aria-label="Cũ hơn" disabled={busy} onChange={(event) => choose("older_than", Number(event.target.value))} value={days}>
          {auditPurgeDays.map((value) => <option key={value} value={value}>{dayLabels[value]}</option>)}
        </AdminSelect></span>)}
      {option("all", <span>Toàn bộ nhật ký</span>)}
    </div>
    <p className="admin-purge__count" role="status">{affected === null ? "Đang đếm…" : affected === 0 ? emptyMessage(mode, days) : <>Sẽ xóa <strong>{count(affected)}</strong> thao tác. Không hoàn tác được.</>}</p>
    <p className="admin-help">Việc xóa được ghi lại thành một dòng &quot;Xóa nhật ký hoạt động&quot; (ai xóa, lúc nào, phạm vi, số dòng); các dòng ghi việc xóa trước đó không bị xóa. Bản sao lưu database tạo trước đó vẫn chứa các dòng này.</p>
  </AdminTypedConfirmDialog>;
}

/** Nút "Xóa nhật ký" trên thanh tiêu đề màn Nhật ký hoạt động. */
export function AuditLogPurgeButton({ filter }: { filter: AuditPurgeFilter | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return <>
    <AdminButton leadingIcon={<Trash2 aria-hidden="true" size={16} />} onClick={() => setOpen(true)} variant="secondary">Xóa nhật ký</AdminButton>
    {open ? <AuditLogPurgeDialog filter={filter} onClose={() => setOpen(false)} onDone={() => { setOpen(false); router.refresh(); }} selectedIds={[]} /> : null}
  </>;
}
