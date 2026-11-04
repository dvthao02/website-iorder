"use client";

import { Copy, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import type { BackupHistoryEntry } from "@iorder/core/server/backup/backup-status";
import { restoreSteps, scheduleSteps, type BackupSource, type BackupStep, type RestorableBackup } from "@/lib/backup-commands";
import { AdminCard } from "./ui/admin-card";
import { AdminDataTable, type AdminDataTableColumn } from "./ui/admin-data-table";
import { AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";

const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
const sources: Record<BackupSource, string> = { vps: "Máy chủ", windows: "Máy Windows" };
// Script giữ 14 bản database (mặc định); bản cũ hơn có thể đã bị xóa khỏi thư mục nên không đưa vào hướng dẫn phục hồi.
const restorableLimit = 14;

type Row = BackupHistoryEntry & { id: string };
const size = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`;

function restorable(entry: BackupHistoryEntry): RestorableBackup | null {
  return entry.ok && entry.location && entry.repoDir && entry.database
    ? { source: entry.source, location: entry.location, repoDir: entry.repoDir, stamp: entry.stamp, database: entry.database }
    : null;
}

function Steps({ steps }: { steps: BackupStep[] }) {
  const { show } = useAdminToast();
  async function copy(command: string) {
    try {
      await navigator.clipboard.writeText(command);
      show("Đã chép lệnh.", "success");
    } catch {
      show("Trình duyệt không cho chép tự động. Hãy bôi đen lệnh để chép.", "error");
    }
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

/** Lịch sử sao lưu, hướng dẫn phục hồi (điền sẵn đường dẫn của bản được chọn) và cách lên lịch. CMS không tự chạy lệnh nào. */
export function BackupManager({ history }: { history: BackupHistoryEntry[] }) {
  const rows = useMemo<Row[]>(() => history.map((entry, index) => ({ ...entry, id: `${entry.ranAt.valueOf()}-${index}` })), [history]);
  const choices = useMemo(() => rows.flatMap((row) => { const backup = restorable(row); return backup ? [{ id: row.id, ranAt: row.ranAt, backup }] : []; }).slice(0, restorableLimit), [rows]);
  const [chosenId, setChosenId] = useState(choices[0]?.id ?? "");
  const chosen = choices.find((choice) => choice.id === chosenId) ?? choices[0];
  const [scheduleSource, setScheduleSource] = useState<BackupSource>(rows[0]?.source ?? "windows");
  const scheduleRepo = rows.find((row) => row.source === scheduleSource && row.repoDir)?.repoDir ?? null;

  const columns: AdminDataTableColumn<Row>[] = [
    { id: "ranAt", label: "Thời điểm", defaultWidth: 130, minWidth: 120, cell: (row) => <span className="whitespace-nowrap">{dateTime.format(row.ranAt)}</span> },
    { id: "result", label: "Kết quả", defaultWidth: 110, minWidth: 100, cell: (row) => row.ok ? <AdminStatusBadge tone="success">Thành công</AdminStatusBadge> : <AdminStatusBadge tone="error">Lỗi</AdminStatusBadge> },
    { id: "source", label: "Máy", defaultWidth: 120, minWidth: 100, cell: (row) => sources[row.source] },
    { id: "size", label: "Database", defaultWidth: 100, minWidth: 90, cell: (row) => row.ok ? size(row.databaseBytes) : "—" },
    { id: "detail", label: "Chi tiết", defaultWidth: 320, minWidth: 180, cell: (row) => row.ok
      ? <span className="text-[var(--cms-muted)]">{row.verified ? `Đã khôi phục thử${row.users === null ? "" : `: ${row.users} tài khoản, ${row.mediaAssets ?? 0} media`}` : "Chưa khôi phục thử"}</span>
      : <span className="text-[var(--cms-status-error-text)]" title={row.message}>{row.message}</span> },
  ];

  return <div className="admin-backup">
    <AdminCard className="admin-card--flush">
      <header className="admin-backup__flush-header"><div><h2>Lịch sử sao lưu</h2><p>30 lần gần nhất. Bấm một bản thành công để xem cách phục hồi bản đó.</p></div></header>
      <AdminDataTable columns={columns} emptyMessage="Chưa có lần sao lưu nào được ghi nhận." getRowId={(row) => row.id} onRowClick={(row) => { if (choices.some((choice) => choice.id === row.id)) setChosenId(row.id); }} rows={rows} showSettingsButton={false} tableId="backup-history" />
    </AdminCard>

    <AdminCard>
      <header><div><h2>Phục hồi từ bản sao lưu</h2><p>Chạy lần lượt các lệnh dưới đây trong cùng một cửa sổ {chosen?.backup.source === "vps" ? "terminal trên VPS" : "PowerShell"}.</p></div></header>
      {chosen ? <>
        <div className="admin-notice admin-notice--warning" role="note"><TriangleAlert aria-hidden="true" size={18} /><span>Phục hồi <strong>ghi đè toàn bộ dữ liệu hiện tại</strong> (bài viết, trang, tài khoản, cấu hình…) bằng dữ liệu của bản đã chọn, và website tạm ngừng trong lúc làm.</span></div>
        <label className="admin-field admin-backup__choice">
          <span>Bản sao lưu</span>
          <select onChange={(event) => setChosenId(event.target.value)} value={chosen.id}>
            {choices.map((choice) => <option key={choice.id} value={choice.id}>{dateTime.format(choice.ranAt)} · {sources[choice.backup.source]} · {choice.backup.stamp}</option>)}
          </select>
        </label>
        <Steps steps={restoreSteps(chosen.backup)} />
      </> : <p className="admin-help">Chưa có bản sao lưu nào đủ thông tin để hướng dẫn phục hồi. Chạy sao lưu một lần (mục bên dưới) rồi tải lại trang.</p>}
    </AdminCard>

    <AdminCard>
      <header><div><h2>Chạy sao lưu và lên lịch</h2><p>Sao lưu gồm database (kèm khôi phục thử) và toàn bộ ảnh, tệp media; giữ 14 bản database gần nhất.</p></div></header>
      <div aria-label="Nơi chạy sao lưu" className="admin-view-tabs admin-backup__tabs" role="tablist">
        {(["windows", "vps"] as const).map((source) => <button aria-selected={scheduleSource === source} className={`admin-view-tabs__tab${scheduleSource === source ? " admin-view-tabs__tab--active" : ""}`} key={source} onClick={() => setScheduleSource(source)} role="tab" type="button">{source === "windows" ? "Máy Windows" : "Máy chủ (VPS)"}</button>)}
      </div>
      <Steps steps={scheduleSteps(scheduleSource, scheduleRepo)} />
      <p className="admin-help">Bản sao lưu đang nằm cùng máy với dữ liệu: hỏng ổ đĩa là mất cả hai. Nên chép thư mục sao lưu ra ổ khác hoặc lưu trữ đám mây định kỳ.</p>
    </AdminCard>
  </div>;
}
