"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";

import { AdminApiError, requestAdminJson } from "../../lib/admin-api";

import type { SystemCheck, SystemCheckState, SystemStatus } from "@iorder/shared/server/system/system-status.contract";

import { AdminButton } from "./ui/admin-button";
import { AdminCard } from "./ui/admin-card";
import { AdminNotice, AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";
import { useOptionalAdminPermissions } from "./ui/admin-permissions";

const stateBadge: Record<SystemCheckState, { tone: "success" | "warning" | "error" | "neutral"; label: string }> = {
  ok: { tone: "success", label: "Ổn" },
  warn: { tone: "warning", label: "Cần chú ý" },
  error: { tone: "error", label: "Có lỗi" },
  unknown: { tone: "neutral", label: "Chưa rõ" },
};

const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" });
const decimal = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

/** 1.234.567 byte → "1,2 MB" (hệ 1024, dấu phẩy thập phân kiểu Việt Nam). */
export function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${unit === 0 ? Math.round(value) : decimal.format(value)} ${units[unit]}`;
}

/** Thời gian máy chủ đã chạy liên tục: "3 ngày 2 giờ", "5 giờ 12 phút", "42 phút". */
export function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days} ngày ${hours} giờ`;
  if (hours > 0) return `${hours} giờ ${minutes} phút`;
  return `${Math.max(1, minutes)} phút`;
}

/** "vừa xong", "5 phút trước", "3 giờ trước", "2 ngày trước". */
export function relativeTime(iso: string, now: Date) {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours} giờ trước` : `${Math.floor(hours / 24)} ngày trước`;
}

/** Các mục đang có vấn đề (cần chú ý hoặc lỗi), lỗi xếp trước; dùng cho khung tóm tắt đầu màn. */
export function problemsOf(status: SystemStatus) {
  const rows: Array<{ label: string; state: SystemCheckState; summary: string }> = [
    { label: "Database", ...status.services.database },
    { label: "Migration", ...status.services.migrations },
    { label: "Kho tệp (S3)", ...status.services.storage },
    { label: "Website", ...status.services.website },
    { label: "Thống kê Umami", ...status.services.analytics },
    { label: "Google Search Console", ...status.services.searchConsole },
    { label: "Máy chủ", ...status.server },
    { label: "Sao lưu", ...status.backup },
    ...status.jobs.map((job) => ({ label: job.label, state: job.state, summary: job.summary })),
  ];
  const missing = status.config.filter((item) => item.required && !item.ok);
  if (missing.length) rows.push({ label: "Cấu hình", state: "warn", summary: `Chưa đặt: ${missing.map((item) => item.label).join("; ")}.` });
  return rows.filter((row) => row.state === "warn" || row.state === "error").sort((a, b) => (a.state === b.state ? 0 : a.state === "error" ? -1 : 1));
}

function overallText(status: SystemStatus) {
  if (status.overall === "ok") return "Mọi thứ đang ổn";
  if (status.overall === "error") return `${status.counts.error} mục lỗi${status.counts.warn ? `, ${status.counts.warn} mục cần chú ý` : ""}`;
  return `${status.counts.warn} mục cần chú ý`;
}

function Row({ label, check, children }: { label: string; check: SystemCheck; children?: React.ReactNode }) {
  const badge = stateBadge[check.state];
  return <li className="admin-status-row">
    <strong>{label}</strong>
    <span>{check.summary}{children ? <small className="admin-status-note">{children}</small> : null}</span>
    <span><AdminStatusBadge tone={badge.tone}>{badge.label}</AdminStatusBadge></span>
  </li>;
}

function Meter({ label, usedRatio, detail, state }: { label: string; usedRatio: number; detail: string; state: SystemCheckState }) {
  const width = `${Math.min(100, Math.max(0, usedRatio * 100))}%`;
  const color = state === "error" ? "var(--cms-status-error-text)" : state === "warn" ? "var(--cms-status-warning-text)" : "var(--cms-primary)";
  return <div className="admin-status-meter">
    <div className="admin-status-meter__head"><span>{label}</span><span>{detail}</span></div>
    <span aria-hidden="true" className="admin-status-meter__bar" style={{ "--meter-color": color } as React.CSSProperties}><span style={{ width }} /></span>
  </div>;
}

/** Phần hiển thị thuần của màn (tách khỏi việc tải dữ liệu để kiểm thử được). `now` truyền vào để thời gian tương đối ổn định khi kiểm thử. */
export function SystemStatusView({ status, now = new Date(), checking = false, onRefresh }: { status: SystemStatus; now?: Date; checking?: boolean; onRefresh?: () => void }) {
  const { services, server, backup, jobs, config } = status;
  // Màn này chỉ cần system.view còn các trang đích cần quyền khác: lối tắt chỉ hiện khi người xem mở được trang đó, kẻo bấm vào là "Không có quyền".
  const { canOpenPath } = useOptionalAdminPermissions();
  const problems = problemsOf(status);
  const overall = stateBadge[status.overall];
  const diskRatio = server.disk && server.disk.totalBytes > 0 ? 1 - server.disk.freeBytes / server.disk.totalBytes : null;
  const memoryRatio = server.memory.totalBytes > 0 ? 1 - server.memory.freeBytes / server.memory.totalBytes : 0;
  const database = services.database;

  return <div className="admin-status-stack admin-status-stack--wide">
    <AdminCard>
      <header>
        <div>
          <h2>Tình trạng hệ thống</h2>
          <p>Kiểm tra lúc {dateTime.format(new Date(status.checkedAt))} · {status.app.environment}{status.app.commit ? ` · bản ${status.app.commit}` : ""}</p>
        </div>
        <span className="admin-status-tags">
          <AdminStatusBadge tone={overall.tone}>{overallText(status)}</AdminStatusBadge>
          <AdminButton disabled={checking} leadingIcon={<RefreshCw aria-hidden="true" />} onClick={onRefresh} variant="secondary">{checking ? "Đang kiểm tra…" : "Kiểm tra lại"}</AdminButton>
        </span>
      </header>
      {problems.length ? <div className="admin-status-stack">
        <AdminNotice tone={status.overall === "error" ? "error" : "warning"}>{status.overall === "error" ? "Có phần đang hỏng, cần xử lý ngay:" : "Có phần cần chú ý:"}</AdminNotice>
        <ul className="admin-status-list admin-status-list--tight">{problems.map((problem) => <li key={`${problem.label}-${problem.summary}`}><AdminStatusBadge tone={stateBadge[problem.state].tone}>{stateBadge[problem.state].label}</AdminStatusBadge> <strong>{problem.label}</strong>: {problem.summary}</li>)}</ul>
      </div> : <p className="admin-dashboard__empty">Database, kho tệp, website, sao lưu và tài nguyên máy chủ đều trong ngưỡng an toàn. Trang tự làm mới mỗi phút.</p>}
    </AdminCard>

    <AdminCard>
      <header><div><h2>Dịch vụ</h2><p>Các thành phần hệ thống phụ thuộc vào nhau; hỏng một thành phần có thể làm lỗi chức năng khác.</p></div></header>
      <ul className="admin-status-list">
        <Row check={database} label="Database (PostgreSQL)">{[database.version, database.sizeBytes !== undefined ? `dung lượng ${formatBytes(database.sizeBytes)}` : null, database.connections ? `${database.connections.used}/${database.connections.max} kết nối` : null].filter(Boolean).join(" · ")}</Row>
        <Row check={services.migrations} label="Migration database">{[services.migrations.lastAppliedAt ? `lần áp dụng gần nhất ${relativeTime(services.migrations.lastAppliedAt, now)}` : null].filter(Boolean).join(" · ")}</Row>
        <Row check={services.storage} label="Kho tệp (S3)" />
        <Row check={services.website} label="Website" />
        <Row check={services.analytics} label="Thống kê Umami">{services.analytics.state !== "ok" && canOpenPath("/admin/integrations") ? <Link className="admin-link" href="/admin/integrations">Nối Umami</Link> : null}</Row>
        <Row check={services.searchConsole} label="Google Search Console">{services.searchConsole.state !== "ok" && canOpenPath("/admin/search-console") ? <Link className="admin-link" href="/admin/search-console">Mở cài đặt</Link> : null}</Row>
      </ul>
    </AdminCard>

    <AdminCard>
      <header><div><h2>Máy chủ</h2><p>Số đo của máy đang chạy Backend ({server.platform}).</p></div><AdminStatusBadge tone={stateBadge[server.state].tone}>{stateBadge[server.state].label}</AdminStatusBadge></header>
      <p className="admin-status-lead">{server.summary}</p>
      <div className="admin-status-stack">
        {diskRatio !== null && server.disk ? <Meter detail={`đã dùng ${formatBytes(server.disk.totalBytes - server.disk.freeBytes)} / ${formatBytes(server.disk.totalBytes)}`} label="Ổ đĩa" state={server.state} usedRatio={diskRatio} /> : <p className="admin-status-note">Không đọc được dung lượng ổ đĩa.</p>}
        <Meter detail={`đang dùng ${formatBytes(server.memory.totalBytes - server.memory.freeBytes)} / ${formatBytes(server.memory.totalBytes)}`} label="RAM" state={server.state === "error" ? "warn" : server.state} usedRatio={memoryRatio} />
      </div>
      <dl className="admin-description-list admin-status-dl">
        <div><dt>Thời gian chạy liên tục</dt><dd>{formatUptime(server.uptimeSeconds)}</dd></div>
        <div><dt>Tiến trình Backend dùng</dt><dd>{formatBytes(server.memory.processBytes)}</dd></div>
        <div><dt>Tải CPU (1 / 5 / 15 phút)</dt><dd>{server.loadAverage ? `${server.loadAverage.map((value) => decimal.format(value)).join(" / ")} (${server.cpuCount} lõi)` : `${server.cpuCount} lõi`}</dd></div>
        <div><dt>Node.js</dt><dd>{server.nodeVersion}</dd></div>
      </dl>
    </AdminCard>

    <AdminCard>
      <header>
        <div><h2>Sao lưu</h2><p>Chi tiết và lịch sử ở màn Sao lưu &amp; phục hồi.</p></div>
        <span className="admin-status-tags"><AdminStatusBadge tone={stateBadge[backup.state].tone}>{stateBadge[backup.state].label}</AdminStatusBadge>{canOpenPath("/admin/backup") ? <Link className="admin-link" href="/admin/backup">Mở Sao lưu &amp; phục hồi</Link> : null}</span>
      </header>
      <p className="admin-status-lead">{backup.summary}{backup.lastSuccessAt ? <small className="admin-status-note">Bản thành công gần nhất: {dateTime.format(new Date(backup.lastSuccessAt))} ({relativeTime(backup.lastSuccessAt, now)})</small> : null}</p>
    </AdminCard>

    <AdminCard>
      <header><div><h2>Tác vụ định kỳ</h2><p>Mỗi script tự ghi lần chạy gần nhất khi kết thúc.</p></div></header>
      <ul className="admin-status-list">
        {jobs.map((job) => <Row check={job} key={job.name} label={job.label}>{[job.schedule, job.lastRunAt ? `chạy lần cuối ${relativeTime(job.lastRunAt, now)}` : null].filter(Boolean).join(" · ")}</Row>)}
      </ul>
    </AdminCard>

    <AdminCard>
      <header><div><h2>Cấu hình</h2><p>Chỉ báo đã đặt hay chưa, không hiển thị giá trị.</p></div></header>
      <ul className="admin-status-list">
        {config.map((item) => <li className="admin-status-row admin-status-row--config" key={item.key}>
          <span>{item.label}{!item.ok && item.hint ? <small className="admin-status-note">{item.hint}</small> : null}</span>
          <span className="admin-status-tags">{!item.ok && item.href && canOpenPath(item.href) ? <Link className="admin-link" href={item.href}>Mở cài đặt</Link> : null}{item.required ? <small className="admin-text-muted">Bắt buộc</small> : null}<AdminStatusBadge tone={item.ok ? "success" : item.required ? "warning" : "neutral"}>{item.ok ? "Đã đặt" : "Chưa đặt"}</AdminStatusBadge></span>
        </li>)}
      </ul>
    </AdminCard>
  </div>;
}

type CheckResult = { ok: true; status: SystemStatus } | { ok: false; message: string };

/** Hỏi backend tình trạng hệ thống. Hàm thuần: không đổi state. */
async function requestStatus(): Promise<CheckResult> {
  try {
    const body = await requestAdminJson("/api/v1/admin/system-status", "GET", undefined, "Không đọc được tình trạng hệ thống lúc này. Thử lại sau.", { cache: "no-store" }) as { status?: SystemStatus } | null;
    if (!body?.status) return { ok: false, message: "Không đọc được tình trạng hệ thống lúc này. Thử lại sau." };
    return { ok: true, status: body.status };
  } catch (error) {
    return { ok: false, message: error instanceof AdminApiError ? error.message : "Không kết nối được máy chủ để kiểm tra." };
  }
}

const autoRefreshMilliseconds = 60_000;

/** Màn "Tình trạng hệ thống": kiểm tra lúc mở, mỗi phút (khi tab đang hiện) và mỗi lần bấm "Kiểm tra lại". */
export function SystemStatusPanel() {
  const [state, setState] = useState<{ status: "loading" } | { status: "error"; message: string } | { status: "ready"; value: SystemStatus }>({ status: "loading" });
  const [checking, setChecking] = useState(false);
  const { show } = useAdminToast();

  useEffect(() => {
    let cancelled = false;
    const apply = (result: CheckResult, keepOnError: boolean) => {
      if (cancelled) return;
      if (result.ok) setState({ status: "ready", value: result.status });
      // Làm mới tự động thất bại thì giữ số liệu cũ thay vì xóa trắng màn.
      else setState((current) => (keepOnError && current.status === "ready" ? current : { status: "error", message: result.message }));
    };
    void requestStatus().then((result) => apply(result, false));
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void requestStatus().then((result) => apply(result, true));
    }, autoRefreshMilliseconds);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const refresh = useCallback(async () => {
    setChecking(true);
    const result = await requestStatus();
    setState(result.ok ? { status: "ready", value: result.status } : { status: "error", message: result.message });
    if (!result.ok) show(result.message, "error");
    else if (result.status.overall === "ok") show("Hệ thống đang ổn.", "success");
    else show(result.status.overall === "error" ? "Có phần đang lỗi. Xem khung đầu trang." : "Có phần cần chú ý. Xem khung đầu trang.", result.status.overall === "error" ? "error" : "info");
    setChecking(false);
  }, [show]);

  if (state.status === "loading") return <p aria-busy="true" className="admin-dashboard__empty">Đang kiểm tra hệ thống…</p>;
  if (state.status === "error") return <div className="admin-status-stack"><AdminNotice tone="error">{state.message}</AdminNotice><div><AdminButton disabled={checking} onClick={() => void refresh()} variant="secondary">Thử lại</AdminButton></div></div>;
  return <SystemStatusView checking={checking} now={new Date()} onRefresh={() => void refresh()} status={state.value} />;
}
