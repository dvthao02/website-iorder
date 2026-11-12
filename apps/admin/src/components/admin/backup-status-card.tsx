import Link from "next/link";

import type { BackupState, BackupStatus } from "@iorder/shared/server/backup/backup-status";

import { AdminCard } from "./ui/admin-card";
import { AdminStatusBadge } from "./ui/admin-feedback";

const badges: Record<BackupState, { label: string; tone: "success" | "warning" | "error" | "neutral" }> = {
  ok: { label: "Đang ổn", tone: "success" },
  stale: { label: "Quá hạn", tone: "warning" },
  failed: { label: "Bị lỗi", tone: "error" },
  never: { label: "Chưa có", tone: "neutral" },
};
const sources = { vps: "Máy chủ", windows: "Máy Windows" } as const;
const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });

function ago(date: Date, now: Date) {
  const hours = Math.floor((now.getTime() - date.getTime()) / 3_600_000);
  if (hours < 1) return "vừa xong";
  return hours < 48 ? `${hours} giờ trước` : `${Math.floor(hours / 24)} ngày trước`;
}

function size(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`;
}

/** Thẻ Tổng quan: lần sao lưu gần nhất (script backup.sh/backup.ps1 ghi vào site_settings), báo quá hạn hoặc lỗi. */
export function BackupStatusCard({ status, now = new Date(), detailsHref, title = "Sao lưu" }: { status: BackupStatus; now?: Date; detailsHref?: string; title?: string }) {
  const badge = badges[status.state];
  const { lastSuccess, lastFailure } = status;
  return <AdminCard className="admin-dashboard__backup">
    <header><h2>{title}</h2><span className="admin-dashboard__backup-actions"><AdminStatusBadge tone={badge.tone}>{badge.label}</AdminStatusBadge>{detailsHref ? <Link href={detailsHref}>Chi tiết</Link> : null}</span></header>
    {lastSuccess ? <dl>
      <div><dt>Bản gần nhất</dt><dd>{dateTime.format(lastSuccess.finishedAt)}<small>{ago(lastSuccess.finishedAt, now)} · {sources[lastSuccess.source]}</small></dd></div>
      <div><dt>Database</dt><dd>{size(lastSuccess.databaseBytes)}<small>{lastSuccess.verified ? `Đã khôi phục thử${lastSuccess.users === null ? "" : `: ${lastSuccess.users} tài khoản, ${lastSuccess.mediaAssets ?? 0} media`}` : "Chưa khôi phục thử"}</small></dd></div>
    </dl> : <p className="admin-dashboard__empty">Chưa có bản sao lưu nào được ghi nhận.</p>}
    {status.state === "failed" && lastFailure ? <p className="admin-dashboard__backup-error">Lỗi lúc {dateTime.format(lastFailure.failedAt)}: {lastFailure.message}</p> : null}
    {status.state === "stale" ? <p className="admin-dashboard__backup-error">Hơn 36 giờ chưa có bản mới: kiểm tra lịch chạy sao lưu.</p> : null}
    {status.state === "never" ? <p className="admin-help">Máy chủ: lên lịch <code>scripts/backup.sh</code>. Máy Windows: chạy <code>pnpm backup:local</code>.</p> : null}
  </AdminCard>;
}
