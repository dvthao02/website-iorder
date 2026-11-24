"use client";

import { Copy, History, LoaderCircle, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import type { LocalBackupLibrary } from "@iorder/shared/server/backup/backup-library";
import type { BackupHistoryEntry, BackupKeepSetting } from "@iorder/shared/server/backup/backup-status";
import { requestAdminJson } from "@/lib/admin-api";
import { vpsRestoreSteps, vpsScheduleSteps, type BackupStep } from "@/lib/backup-commands";
import { backupDateTime, formatBackupSize, formatBackupStamp } from "@/lib/backup-format";
import { BackupLibrary } from "./backup-library";
import { AdminButton } from "./ui/admin-button";
import { AdminCard } from "./ui/admin-card";
import { useAdminConfirm } from "./ui/admin-confirm-dialog";
import { AdminDataTable, type AdminDataTableColumn } from "./ui/admin-data-table";
import { AdminNotice, AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";
import { AdminInput } from "./ui/admin-input";

const kindLabel = { success: "Thành công", failure: "Lỗi", restore: "Đã phục hồi" } as const;
const kindTone = { success: "success", failure: "error", restore: "neutral" } as const;

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

/**
 * Sao lưu ngay, lịch tự động mỗi đêm, số bản giữ lại, danh sách bản trên máy (phục hồi, tải về, xóa, nhập) và
 * lịch sử 30 lần gần nhất (xóa được). Mọi thao tác chỉ Super Admin làm được; người chỉ có quyền xem thấy lịch sử.
 */
export function BackupManager({ canOperate, history, keep, local, oneClick, scheduled: initialScheduled }: { canOperate: boolean; history: BackupHistoryEntry[]; keep: BackupKeepSetting; local: LocalBackupLibrary | null; oneClick: boolean; scheduled: boolean }) {
  const router = useRouter();
  const { show } = useAdminToast();
  const { confirm } = useAdminConfirm();
  const [scheduled, setScheduled] = useState(initialScheduled);
  const [running, setRunning] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [savingKeep, setSavingKeep] = useState(false);
  const [keepInput, setKeepInput] = useState(String(keep.value));
  // Bản đã lưu: kèm version để máy chủ phát hiện hai quản trị viên sửa cùng lúc (409).
  const [savedKeep, setSavedKeep] = useState({ value: keep.value, version: keep.version });
  // Máy chủ trả giá trị mới (sau router.refresh, hoặc người khác vừa đổi): lấy lại version và ô nhập.
  const [seenKeep, setSeenKeep] = useState(keep);
  if (seenKeep.version !== keep.version || seenKeep.value !== keep.value) {
    setSeenKeep(keep);
    setSavedKeep({ value: keep.value, version: keep.version });
    setKeepInput(String(keep.value));
  }

  const rows = useMemo<Row[]>(() => history.map((entry, index) => ({ ...entry, id: `${entry.ranAt.valueOf()}-${index}` })), [history]);
  // Chỉ bản sao lưu thành công, còn đủ thông tin, mới dùng được để hiện lệnh phục hồi VPS.
  type VpsSuccess = Row & { kind: "success"; location: string; repoDir: string; database: string };
  const isVpsSuccess = (row: Row): row is VpsSuccess => row.kind === "success" && row.source === "vps" && Boolean(row.location) && Boolean(row.repoDir) && Boolean(row.database);
  const vpsSuccesses = rows.filter(isVpsSuccess);
  const latestVpsRepo = vpsSuccesses[0]?.repoDir ?? null;

  const keepNumber = Number(keepInput);
  const keepValid = keepInput.trim() !== "" && Number.isInteger(keepNumber) && keepNumber >= keep.min && keepNumber <= keep.max;

  async function runNow() {
    setRunning(true);
    try {
      await requestAdminJson("/api/v1/admin/backup", "POST", { action: "run" }, "Không sao lưu được lúc này.");
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
      await requestAdminJson("/api/v1/admin/backup", "POST", { action: next ? "schedule-on" : "schedule-off" }, "Không đổi được lịch tự động.");
      setScheduled(next);
      show(next ? "Đã bật tự động sao lưu mỗi đêm lúc 21:00." : "Đã tắt tự động sao lưu.", "success");
    } catch (error) {
      show(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      setScheduling(false);
    }
  }

  async function saveKeep(event: FormEvent) {
    event.preventDefault();
    if (!keepValid) return;
    setSavingKeep(true);
    try {
      const result = await requestAdminJson("/api/v1/admin/backup", "POST", { action: "set-keep", keep: keepNumber, expectedVersion: savedKeep.version }, "Không lưu được số bản giữ lại.") as { keep: number; version: number };
      setSavedKeep({ value: result.keep, version: result.version });
      show(`Đã lưu: giữ ${result.keep} bản gần nhất.`, "success");
      router.refresh();
    } catch (error) {
      show(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
      router.refresh(); // sai version (người khác vừa đổi): tải lại giá trị mới
    } finally {
      setSavingKeep(false);
    }
  }

  async function clearHistory() {
    const confirmed = await confirm({
      title: "Xóa lịch sử sao lưu?",
      message: `Xóa ${rows.length} dòng lịch sử ở màn này. Không xóa bản sao lưu nào, và tình trạng "lần sao lưu gần nhất" ở thẻ Tình trạng giữ nguyên. Việc xóa được ghi vào Nhật ký hoạt động.`,
      confirmLabel: "Xóa lịch sử",
      tone: "danger",
    });
    if (!confirmed) return;
    setClearing(true);
    try {
      await requestAdminJson("/api/v1/admin/backup", "POST", { action: "clear-history" }, "Không xóa được lịch sử lúc này.");
      show("Đã xóa lịch sử sao lưu.", "success");
      router.refresh();
    } catch (error) {
      show(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      setClearing(false);
    }
  }

  const columns: AdminDataTableColumn<Row>[] = [
    { id: "ranAt", label: "Thời điểm", defaultWidth: 120, minWidth: 110, cell: (row) => <span className="whitespace-nowrap">{backupDateTime.format(row.ranAt)}</span> },
    { id: "result", label: "Kết quả", defaultWidth: 120, minWidth: 110, cell: (row) => <AdminStatusBadge tone={kindTone[row.kind]}>{kindLabel[row.kind]}</AdminStatusBadge> },
    { id: "source", label: "Máy", defaultWidth: 120, minWidth: 110, cell: (row) => row.source === "windows" ? "Máy Windows" : "Máy chủ" },
    { id: "size", label: "Dung lượng", defaultWidth: 116, minWidth: 110, cell: (row) => row.kind === "success" ? formatBackupSize(row.databaseBytes) : "—" },
    { id: "detail", label: "Chi tiết", defaultWidth: 240, minWidth: 160, cell: (row) => {
      if (row.kind === "success") return <span className="text-[var(--cms-muted)]">{row.verified ? `Đã khôi phục thử${row.users === null ? "" : `: ${row.users} tài khoản, ${row.mediaAssets ?? 0} media`}` : "Chưa khôi phục thử"}</span>;
      if (row.kind === "failure") return <span className="text-[var(--cms-status-error-text)]" title={row.message}>{row.message}</span>;
      return <span className="text-[var(--cms-muted)]">Từ bản lúc {formatBackupStamp(row.fromStamp)}</span>;
    } },
  ];

  return <div className="admin-backup">
    <AdminCard>
      <header><div><h2>Sao lưu</h2><p>Dump database (kèm khôi phục thử) và toàn bộ ảnh, tệp media vào máy này; giữ {keep.value} bản database gần nhất.</p></div></header>
      {canOperate ? <>
        {oneClick ? <div className="admin-backup__actions">
          <AdminButton leadingIcon={running ? <LoaderCircle aria-hidden="true" className="admin-content-actions__spinner" size={16} /> : <Save aria-hidden="true" size={16} />} disabled={running} onClick={() => void runNow()}>{running ? "Đang sao lưu…" : "Sao lưu ngay"}</AdminButton>
          <AdminButton leadingIcon={scheduling ? <LoaderCircle aria-hidden="true" className="admin-content-actions__spinner" size={16} /> : <History aria-hidden="true" size={16} />} disabled={scheduling} onClick={() => void toggleSchedule()} variant="secondary">
            {scheduled ? "Tắt tự động sao lưu mỗi đêm" : "Bật tự động sao lưu mỗi đêm 21:00"}
          </AdminButton>
          {scheduled ? <AdminStatusBadge tone="success">Đang tự động chạy mỗi đêm</AdminStatusBadge> : null}
        </div> : <AdminNotice tone="info"><strong>Sao lưu một cú bấm không dùng được ở đây.</strong> CMS đang chạy trong Docker (hoặc ở máy khác với database) nên không điều khiển được sao lưu, phục hồi và lịch tự động. Hãy sao lưu bằng lệnh trên máy: <code>pnpm backup:local</code> (Windows) hoặc <code>scripts/backup.sh</code> (VPS). Muốn tự động mỗi đêm: chạy <code>pnpm backup:schedule</code> một lần trên máy Windows (gỡ bằng <code>pnpm backup:unschedule</code>), hoặc lên lịch cron trên VPS theo hướng dẫn bên dưới. Kết quả mỗi lần chạy hiện ở Lịch sử và Tình trạng. Số bản giữ lại bên dưới vẫn áp dụng cho các lệnh này.</AdminNotice>}
        <form className="admin-backup__keep" onSubmit={(event) => void saveKeep(event)}>
          <label htmlFor="backup-keep">Số bản database giữ lại</label>
          <AdminInput aria-describedby="backup-keep-help" id="backup-keep" inputMode="numeric" max={keep.max} min={keep.min} onChange={(event) => setKeepInput(event.target.value)} step={1} type="number" value={keepInput} />
          <AdminButton disabled={savingKeep || !keepValid || keepNumber === savedKeep.value} leadingIcon={savingKeep ? <LoaderCircle aria-hidden="true" className="admin-content-actions__spinner" size={16} /> : undefined} type="submit" variant="secondary">Lưu</AdminButton>
          <span className="admin-help" id="backup-keep-help">Từ {keep.min} đến {keep.max}. Áp dụng từ lần sao lưu sau, kể cả sao lưu tự động; bản cũ hơn bị xóa. Ảnh và tệp media không bị dọn.</span>
        </form>
      </> : <p className="admin-help">Chỉ Super Admin sao lưu, phục hồi, tải về, xóa và bật lịch tự động được; bạn xem được lịch sử bên dưới.</p>}
      <p className="admin-help">Bản sao lưu đang nằm cùng máy với dữ liệu: hỏng ổ đĩa là mất cả hai. Nên thỉnh thoảng tải bản sao lưu về hoặc chép thư mục sao lưu ra ổ khác hoặc lưu trữ đám mây.</p>
    </AdminCard>

    {local ? <BackupLibrary canOperate={canOperate} keep={keep.value} library={local} /> : null}

    <AdminCard className="admin-card--flush">
      <header className="admin-backup__flush-header">
        <div><h2>Lịch sử</h2><p>30 lần gần nhất. {local ? "Phục hồi, tải về và xóa bản sao lưu ở danh sách phía trên." : ""}</p></div>
        {canOperate && rows.length ? <AdminButton disabled={clearing} leadingIcon={clearing ? <LoaderCircle aria-hidden="true" className="admin-content-actions__spinner" size={14} /> : <Trash2 aria-hidden="true" size={14} />} onClick={() => void clearHistory()} size="sm" variant="ghost">Xóa lịch sử</AdminButton> : null}
      </header>
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
  </div>;
}
