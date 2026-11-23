"use client";

import { Copy, FileArchive, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";

import type { LocalBackupEntry, LocalBackupLibrary } from "@iorder/shared/server/backup/backup-library";
import { requestAdminJson } from "@/lib/admin-api";
import { backupDateTime, formatBackupSize, formatBackupStamp } from "@/lib/backup-format";
import { deleteConfirmWord, restoreConfirmWord } from "@/lib/restore-confirm";
import { AdminButton } from "./ui/admin-button";
import { AdminCard } from "./ui/admin-card";
import { AdminDataTable, type AdminDataTableColumn } from "./ui/admin-data-table";
import { AdminNotice, AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";
import { AdminTypedConfirmDialog } from "./ui/admin-typed-confirm-dialog";

type Row = LocalBackupEntry & { id: string };
type Pending = { kind: "restore" | "delete"; backup: LocalBackupEntry } | null;

/** Phục hồi xong: nói rõ bản an toàn vừa tạo, và báo tệp media trên kho khác với bản sao lưu (không bị ghi đè). */
function restoreSuccessMessage(result: unknown) {
  const { preBackup, media, sessionKept } = (result ?? {}) as { preBackup?: { stamp?: unknown }; media?: { different?: unknown }; sessionKept?: unknown };
  const parts = ["Đã phục hồi xong."];
  if (typeof preBackup?.stamp === "string") parts.push(`Dữ liệu trước khi phục hồi được giữ ở bản lúc ${formatBackupStamp(preBackup.stamp)}.`);
  if (typeof media?.different === "number" && media.different > 0) parts.push(`${media.different} tệp media trên kho khác nội dung bản sao lưu nên được giữ nguyên.`);
  if (sessionKept === false) parts.push("Tài khoản của bạn không có trong bản phục hồi nên bạn cần đăng nhập lại.");
  return parts.join(" ");
}

const compactQuery = "(max-width: 640px)";

/** Điện thoại: nút trong bảng chỉ còn biểu tượng (CSS ẩn nhãn) nên cột thao tác hẹp lại, không che cột Thời điểm. */
function useCompactViewport() {
  return useSyncExternalStore(
    (notify) => { const media = window.matchMedia(compactQuery); media.addEventListener("change", notify); return () => media.removeEventListener("change", notify); },
    () => window.matchMedia(compactQuery).matches,
    () => false,
  );
}

const downloadHref = (stamp: string) => `/api/v1/admin/backup/download?stamp=${encodeURIComponent(stamp)}`;

/**
 * Các bản sao lưu đang nằm trên đĩa máy này: phục hồi, tải về, xóa tay (chỉ Super Admin), và hướng dẫn nhập bản
 * sao lưu từ nơi khác bằng cách chép thư mục vào đúng chỗ (không tải tệp lớn lên qua trình duyệt).
 */
export function BackupLibrary({ canOperate, keep, library }: { canOperate: boolean; keep: number; library: LocalBackupLibrary }) {
  const router = useRouter();
  const { show } = useAdminToast();
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [rescanning, startRescan] = useTransition();
  const compact = useCompactViewport();
  const rows = useMemo<Row[]>(() => library.backups.map((backup) => ({ ...backup, id: backup.stamp })), [library.backups]);

  async function confirmPending() {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === "restore") {
        const result = await requestAdminJson("/api/v1/admin/backup", "POST", { action: "restore", stamp: pending.backup.stamp }, "Không phục hồi được lúc này.");
        show(restoreSuccessMessage(result), "success");
      } else {
        await requestAdminJson("/api/v1/admin/backup", "POST", { action: "delete", stamp: pending.backup.stamp }, "Không xóa được bản sao lưu lúc này.");
        show("Đã xóa bản sao lưu.", "success");
      }
      setPending(null);
      router.refresh();
    } catch (error) {
      show(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function copyPath() {
    try { await navigator.clipboard.writeText(library.dbDir); show("Đã chép đường dẫn.", "success"); }
    catch { show("Trình duyệt không cho chép tự động. Hãy bôi đen đường dẫn để chép.", "error"); }
  }

  const columns: AdminDataTableColumn<Row>[] = [
    { id: "takenAt", label: "Thời điểm", defaultWidth: 130, minWidth: 110, cell: (row) => <span className="whitespace-nowrap">{backupDateTime.format(new Date(row.takenAt))}</span> },
    { id: "size", label: "Dung lượng", defaultWidth: 110, minWidth: 100, cell: (row) => formatBackupSize(row.bytes) },
    { id: "state", label: "Trạng thái", defaultWidth: 220, minWidth: 140, cell: (row) => row.problem
      ? <span title={row.problem}><AdminStatusBadge tone="warning">{row.problem}</AdminStatusBadge></span>
      : <AdminStatusBadge tone="success">Sẵn sàng phục hồi</AdminStatusBadge> },
    ...(canOperate ? [{ id: "actions", label: "", defaultWidth: compact ? 136 : 310, minWidth: compact ? 130 : 310, align: "right" as const, cell: (row: Row) => <span className="admin-backup__row-actions">
      <AdminButton disabled={Boolean(row.problem)} leadingIcon={<RotateCcw aria-hidden="true" size={14} />} onClick={() => setPending({ kind: "restore", backup: row })} size="sm" title="Phục hồi dữ liệu từ bản này" variant="secondary"><span className="admin-backup__row-label">Phục hồi</span></AdminButton>
      {row.problem
        ? <span aria-disabled="true" className="admin-button admin-button--secondary admin-button--sm admin-button--disabled admin-file-tone--zip" title={row.problem}><FileArchive aria-hidden="true" size={14} /><span className="admin-backup__row-label">Tải về</span></span>
        : <a className="admin-button admin-button--secondary admin-button--sm admin-file-tone--zip" download href={downloadHref(row.stamp)} title="Tải về gói .zip gồm tệp .dump và SHA256SUMS (không gồm ảnh, tệp media)"><FileArchive aria-hidden="true" size={14} /><span className="admin-backup__row-label">Tải về</span></a>}
      <AdminButton aria-label={`Xóa bản sao lưu lúc ${backupDateTime.format(new Date(row.takenAt))}`} leadingIcon={<Trash2 aria-hidden="true" size={14} />} onClick={() => setPending({ kind: "delete", backup: row })} size="sm" title="Xóa bản sao lưu này" variant="ghost"><span className="admin-backup__row-label">Xóa</span></AdminButton>
    </span> }] : []),
  ];

  const pendingTime = pending ? backupDateTime.format(new Date(pending.backup.takenAt)) : "";

  return <>
    <AdminCard className="admin-card--flush">
      <header className="admin-backup__flush-header"><div><h2>Bản sao lưu trên máy này</h2><p>{rows.length ? `${rows.length} bản, mới nhất trước. ` : ""}Chỉ giữ {keep} bản gần nhất; bản cũ hơn tự bị xóa ở lần sao lưu sau.</p></div></header>
      <AdminDataTable columns={columns} emptyMessage="Chưa có bản sao lưu nào trên máy này." getRowId={(row) => row.id} rows={rows} showSettingsButton={false} tableId="backup-library" />
    </AdminCard>

    {canOperate ? <AdminCard>
      <header><div><h2>Nhập bản sao lưu</h2><p>Đưa bản sao lưu từ máy khác (hoặc gói .zip đã tải về) vào đây bằng cách chép thư mục, không cần tải lên qua trình duyệt.</p></div></header>
      <ol className="admin-backup-steps">
        <li><strong>Chuẩn bị thư mục bản sao lưu</strong><p>Trong thư mục có tệp <code>.dump</code> và tệp <code>SHA256SUMS</code>. Giải nén gói .zip đã tải về là có đủ cả hai.</p></li>
        <li><strong>Đặt tên thư mục theo giờ UTC</strong><p>Dạng <code>20261122T100000Z</code> (năm, tháng, ngày, chữ T, giờ, phút, giây, chữ Z). Gói .zip tải về có sẵn mã này trong tên tệp.</p></li>
        <li><strong>Chép thư mục vào đúng chỗ</strong>
          <div className="admin-backup-steps__command"><pre><code>{library.dbDir}</code></pre><button aria-label="Chép đường dẫn thư mục" onClick={() => void copyPath()} title="Chép đường dẫn" type="button"><Copy aria-hidden="true" size={15} /></button></div>
        </li>
        <li><strong>Quét lại</strong><p>Bản vừa chép hiện ở danh sách phía trên; bấm &quot;Phục hồi&quot; như mọi bản khác. Phục hồi vẫn kiểm tra checksum và thử trên cơ sở dữ liệu tạm trước khi dùng.</p></li>
      </ol>
      <div className="admin-backup__actions">
        <AdminButton disabled={rescanning} leadingIcon={<RefreshCw aria-hidden="true" className={rescanning ? "admin-content-actions__spinner" : undefined} size={16} />} onClick={() => startRescan(() => router.refresh())} variant="secondary">{rescanning ? "Đang quét…" : "Quét lại thư mục"}</AdminButton>
      </div>
      {library.ignored.length ? <AdminNotice tone="warning">Chưa nhận ra: {library.ignored.join(", ")}. Tên thư mục bản sao lưu phải đúng dạng 20261122T100000Z.</AdminNotice> : null}
      <p className="admin-help">Bản chép vào tính vào số bản giữ lại (đang giữ {keep}), nên bản cũ nhất bị dọn ở lần sao lưu sau: phục hồi ngay hoặc tải về cất riêng. Bản tạo từ phiên bản hệ thống mới hơn bản đang chạy bị từ chối. Ảnh và tệp media nằm ở thư mục media riêng, không có trong gói .zip.</p>
    </AdminCard> : null}

    {pending?.kind === "restore" ? <AdminTypedConfirmDialog busy={busy} confirmLabel="Phục hồi dữ liệu" onClose={() => !busy && setPending(null)} onConfirm={() => void confirmPending()} title="Phục hồi dữ liệu?" word={restoreConfirmWord}>
      <p>Toàn bộ dữ liệu hiện tại (bài viết, trang, tài khoản, cấu hình…) sẽ bị thay bằng dữ liệu của bản sao lưu lúc <strong>{pendingTime}</strong>. Website và CMS có thể báo lỗi vài giây trong lúc phục hồi.</p>
    </AdminTypedConfirmDialog> : null}
    {pending?.kind === "delete" ? <AdminTypedConfirmDialog busy={busy} confirmLabel="Xóa bản sao lưu" onClose={() => !busy && setPending(null)} onConfirm={() => void confirmPending()} title="Xóa bản sao lưu?" word={deleteConfirmWord}>
      <p>Bản sao lưu lúc <strong>{pendingTime}</strong> ({formatBackupSize(pending.backup.bytes)}) sẽ bị xóa khỏi máy này và không lấy lại được. Nên tải về trước nếu còn cần.</p>
    </AdminTypedConfirmDialog> : null}
  </>;
}
