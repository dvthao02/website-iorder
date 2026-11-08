"use client";

import { Copy, History, LoaderCircle, RotateCcw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import type { BackupHistoryEntry } from "@iorder/core/server/backup/backup-status";
import { requestAdminJson } from "@/lib/admin-api";
import { vpsRestoreSteps, vpsScheduleSteps, type BackupStep } from "@/lib/backup-commands";
import { matchesRestoreConfirmation, restoreConfirmWord } from "@/lib/restore-confirm";
import { AdminButton } from "./ui/admin-button";
import { AdminCard } from "./ui/admin-card";
import { AdminDataTable, type AdminDataTableColumn } from "./ui/admin-data-table";
import { useAdminFocusTrap } from "./ui/admin-focus-trap";
import { AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";
import { AdminInput } from "./ui/admin-input";

const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
const kindLabel = { success: "Thành công", failure: "Lỗi", restore: "Đã phục hồi" } as const;
const kindTone = { success: "success", failure: "error", restore: "neutral" } as const;
const size = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`;

type Row = BackupHistoryEntry & { id: string };

function Steps({ steps }: { steps: BackupStep[] }) {
  const { show } = useAdminToast();
  async function copy(command: string) {
    try { await navigator.clipboard.writeText(command); show("Đã chép lệnh.", "success"); }
    catch { show("Trình duyệt không cho chép tự động. Hãy bôi đen lệnh để chép.", "error"); }
  }
  return <ol className="admin-backup-steps">
    {steps.map((step) => <li key={step.title}>
      <strong>{step.title}</strong>
      <p>{step.detail}</p>
      <div className="admin-backup-steps__command">
        <pre><code>{step.command}</code></pre>
        <button aria-label={`Chép lệnh: ${step.title}`} onClick={() => void copy(step.command)} title="Chép lệnh" type="button"><Copy aria-hidden="true" size={15} /></button>
      </div>
    </li>)}
  </ol>;
}

/** Hộp xác nhận: phải gõ từ "phục hồi" (dễ gõ, không phân biệt hoa thường/dấu) để chống bấm nhầm; ngày giờ bản được chọn in đậm trong lời cảnh báo. */
function RestoreConfirmDialog({ busy, backupTime, onClose, onConfirm }: { busy: boolean; backupTime: string; onClose: () => void; onConfirm: () => void }) {
  const [typed, setTyped] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  useAdminFocusTrap({ containerRef: dialogRef, initialFocusSelector: "[data-restore-confirm-input]", isOpen: true, onClose });
  const matches = matchesRestoreConfirmation(typed);
  return <div className="admin-confirm-dialog-backdrop" onMouseDown={() => !busy && onClose()} role="presentation">
    <section aria-labelledby="restore-confirm-title" aria-modal="true" className="admin-confirm-dialog" onMouseDown={(event) => event.stopPropagation()} ref={dialogRef} role="alertdialog" tabIndex={-1}>
      <h2 id="restore-confirm-title">Phục hồi dữ liệu?</h2>
      <p>Toàn bộ dữ liệu hiện tại (bài viết, trang, tài khoản, cấu hình…) sẽ bị thay bằng dữ liệu của bản sao lưu lúc <strong>{backupTime}</strong>. Website và CMS có thể báo lỗi vài giây trong lúc phục hồi.</p>
      <p>Để xác nhận, gõ chữ <strong>{restoreConfirmWord}</strong> vào ô bên dưới:</p>
      <AdminInput autoComplete="off" data-restore-confirm-input placeholder={restoreConfirmWord} disabled={busy} onChange={(event) => setTyped(event.target.value)} value={typed} />
      <div className="admin-confirm-dialog__actions">
        <AdminButton disabled={busy} onClick={onClose} variant="secondary">Hủy</AdminButton>
        <AdminButton disabled={!matches || busy} onClick={onConfirm} variant="danger">{busy ? <LoaderCircle aria-hidden="true" className="admin-content-actions__spinner" size={16} /> : null}Phục hồi dữ liệu</AdminButton>
      </div>
    </section>
  </div>;
}

/** Lịch sử sao lưu/phục hồi, nút "Sao lưu ngay"/"Phục hồi" (một cú bấm, không cần biết Docker hay PowerShell là gì), và bật/tắt lịch tự động mỗi đêm. */
export function BackupManager({ canOperate, history, scheduled: initialScheduled }: { canOperate: boolean; history: BackupHistoryEntry[]; scheduled: boolean }) {
  const router = useRouter();
  const { show } = useAdminToast();
  const [scheduled, setScheduled] = useState(initialScheduled);
  const [running, setRunning] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirmRow, setConfirmRow] = useState<(Row & { kind: "success" }) | null>(null);

  const rows = useMemo<Row[]>(() => history.map((entry, index) => ({ ...entry, id: `${entry.ranAt.valueOf()}-${index}` })), [history]);
  // Chỉ bản sao lưu thành công, còn đủ thông tin, mới dùng được để hiện lệnh phục hồi VPS.
  type VpsSuccess = Row & { kind: "success"; location: string; repoDir: string; database: string };
  const isVpsSuccess = (row: Row): row is VpsSuccess => row.kind === "success" && row.source === "vps" && Boolean(row.location) && Boolean(row.repoDir) && Boolean(row.database);
  const vpsSuccesses = rows.filter(isVpsSuccess);
  const latestVpsRepo = vpsSuccesses[0]?.repoDir ?? null;

  async function runNow() {
    setRunning(true);
    try {
      await requestAdminJson("/api/admin/backup", "POST", { action: "run" }, "Không sao lưu được lúc này.");
      show("Đã sao lưu xong.", "success");
      router.refresh();
    } catch (error) {
      show(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      setRunning(false);
    }
  }

  async function toggleSchedule() {
    setScheduling(true);
    const next = !scheduled;
    try {
      await requestAdminJson("/api/admin/backup", "POST", { action: next ? "schedule-on" : "schedule-off" }, "Không đổi được lịch tự động.");
      setScheduled(next);
      show(next ? "Đã bật tự động sao lưu mỗi đêm lúc 21:00." : "Đã tắt tự động sao lưu.", "success");
    } catch (error) {
      show(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      setScheduling(false);
    }
  }

  async function confirmRestore() {
    if (!confirmRow) return;
    setRestoring(true);
    try {
      await requestAdminJson("/api/admin/backup", "POST", { action: "restore", stamp: confirmRow.stamp }, "Không phục hồi được lúc này.");
      show("Đã phục hồi xong.", "success");
      setConfirmRow(null);
      router.refresh();
    } catch (error) {
      show(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      setRestoring(false);
    }
  }

  const columns: AdminDataTableColumn<Row>[] = [
    { id: "ranAt", label: "Thời điểm", defaultWidth: 120, minWidth: 110, cell: (row) => <span className="whitespace-nowrap">{dateTime.format(row.ranAt)}</span> },
    { id: "result", label: "Kết quả", defaultWidth: 120, minWidth: 110, cell: (row) => <AdminStatusBadge tone={kindTone[row.kind]}>{kindLabel[row.kind]}</AdminStatusBadge> },
    { id: "source", label: "Máy", defaultWidth: 120, minWidth: 110, cell: (row) => row.source === "windows" ? "Máy Windows" : "Máy chủ" },
    { id: "size", label: "Dung lượng", defaultWidth: 116, minWidth: 110, cell: (row) => row.kind === "success" ? size(row.databaseBytes) : "—" },
    { id: "detail", label: "Chi tiết", defaultWidth: 240, minWidth: 160, cell: (row) => {
      if (row.kind === "success") return <span className="text-[var(--cms-muted)]">{row.verified ? `Đã khôi phục thử${row.users === null ? "" : `: ${row.users} tài khoản, ${row.mediaAssets ?? 0} media`}` : "Chưa khôi phục thử"}</span>;
      if (row.kind === "failure") return <span className="text-[var(--cms-status-error-text)]" title={row.message}>{row.message}</span>;
      return <span className="text-[var(--cms-muted)]">Từ bản lúc {dateTime.format(new Date(row.fromStamp.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z")))}</span>;
    } },
    { id: "action", label: "", defaultWidth: 120, minWidth: 120, align: "right", cell: (row) => canOperate && row.kind === "success" && row.source === "windows" && row.location && row.repoDir && row.database
      ? <AdminButton onClick={() => setConfirmRow(row)} size="sm" variant="secondary"><RotateCcw aria-hidden="true" size={14} />Phục hồi</AdminButton>
      : null },
  ];

  return <div className="admin-backup">
    <AdminCard>
      <header><div><h2>Sao lưu</h2><p>Dump database (kèm khôi phục thử) và toàn bộ ảnh, tệp media vào máy này; giữ 14 bản database gần nhất.</p></div></header>
      {canOperate ? <div className="admin-backup__actions">
        <AdminButton leadingIcon={running ? <LoaderCircle aria-hidden="true" className="admin-content-actions__spinner" size={16} /> : <Save aria-hidden="true" size={16} />} disabled={running} onClick={() => void runNow()}>{running ? "Đang sao lưu…" : "Sao lưu ngay"}</AdminButton>
        <AdminButton leadingIcon={scheduling ? <LoaderCircle aria-hidden="true" className="admin-content-actions__spinner" size={16} /> : <History aria-hidden="true" size={16} />} disabled={scheduling} onClick={() => void toggleSchedule()} variant="secondary">
          {scheduled ? "Tắt tự động sao lưu mỗi đêm" : "Bật tự động sao lưu mỗi đêm 21:00"}
        </AdminButton>
        {scheduled ? <AdminStatusBadge tone="success">Đang tự động chạy mỗi đêm</AdminStatusBadge> : null}
      </div> : <p className="admin-help">Chỉ Super Admin sao lưu/phục hồi và bật lịch tự động được; bạn xem được lịch sử bên dưới.</p>}
      <p className="admin-help">Bản sao lưu đang nằm cùng máy với dữ liệu: hỏng ổ đĩa là mất cả hai. Nên thỉnh thoảng chép thư mục sao lưu ra ổ khác hoặc lưu trữ đám mây.</p>
    </AdminCard>

    <AdminCard className="admin-card--flush">
      <header className="admin-backup__flush-header"><div><h2>Lịch sử</h2><p>30 lần gần nhất. Bản thành công trên máy này bấm &quot;Phục hồi&quot; ngay trong bảng.</p></div></header>
      <AdminDataTable columns={columns} emptyMessage="Chưa có lần sao lưu nào được ghi nhận." getRowId={(row) => row.id} rows={rows} showSettingsButton={false} tableId="backup-history" />
    </AdminCard>

    {vpsSuccesses.length ? <AdminCard>
      <header><div><h2>Phục hồi trên máy chủ thật (VPS)</h2><p>CMS không tự phục hồi được lên máy chủ ở xa; làm theo các lệnh dưới đây trên VPS, chạy lần lượt.</p></div></header>
      <Steps steps={vpsRestoreSteps(vpsSuccesses[0]!)} />
    </AdminCard> : null}

    <AdminCard>
      <header><div><h2>Lên lịch trên máy chủ thật (VPS)</h2><p>Khi đã triển khai lên VPS, lên lịch sao lưu tự động bằng cron.</p></div></header>
      <Steps steps={vpsScheduleSteps(latestVpsRepo)} />
    </AdminCard>

    {confirmRow ? <RestoreConfirmDialog busy={restoring} backupTime={dateTime.format(confirmRow.ranAt)} onClose={() => !restoring && setConfirmRow(null)} onConfirm={() => void confirmRestore()} /> : null}
  </div>;
}
