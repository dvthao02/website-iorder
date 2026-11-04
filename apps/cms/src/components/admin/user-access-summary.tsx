"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { z } from "zod";

import { summarizeUserAgent } from "@iorder/core/server/shared/user-agent";
import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { auditActionLabel } from "./ui/audit-labels";
import { useAdminPermissions } from "./ui/admin-permissions";

export type UserAccess = {
  id: string;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  lastLoginUserAgent: string | null;
  lastAction: string | null;
  lastActionAt: Date | null;
  activeSessions: number;
};

const recentSchema = z.object({ result: z.object({ items: z.array(z.object({
  id: z.string(), action: z.string(), createdAt: z.coerce.date(), ipAddress: z.string().nullable(), userAgent: z.string().nullable(),
})) }) });
type RecentEntry = z.infer<typeof recentSchema>["result"]["items"][number];

const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" });
export const formatAccessTime = (value: Date | null) => value ? dateTime.format(new Date(value)) : null;
/** "IP · Chrome 156 · Windows · Máy tính" cho một lần truy cập; thiếu thông tin thì bỏ phần đó. */
export const accessSource = (ip: string | null, userAgent: string | null) => [ip ? ipLabel(ip) : null, userAgent ? summarizeUserAgent(userAgent).label : null].filter(Boolean).join(" · ");
// IP của chính máy chạy CMS (khi dùng trên máy cá nhân) đọc khó hiểu: hiện thành chữ.
const ipLabel = (ip: string) => ip === "::1" || ip === "127.0.0.1" || ip === "::ffff:127.0.0.1" ? "Máy cục bộ" : `IP ${ip}`;

/** Khung sửa tài khoản: lần đăng nhập gần nhất (IP, thiết bị), phiên đang mở và 5 thao tác gần nhất từ nhật ký. */
export function UserAccessSummary({ user }: { user: UserAccess }) {
  const { can } = useAdminPermissions();
  const canReadAudit = can("audit.view");
  const [recent, setRecent] = useState<{ userId: string; items?: RecentEntry[]; error?: string } | null>(null);
  useEffect(() => {
    if (!canReadAudit) return;
    const controller = new AbortController();
    fetch(`/api/admin/audit?userId=${encodeURIComponent(user.id)}&pageSize=5`, { signal: controller.signal }).then(async (response) => {
      const payload = await readAdminJson(response);
      if (!response.ok) throw adminApiError(payload, "Không tải được hoạt động gần đây.");
      const parsed = recentSchema.safeParse(payload);
      if (!parsed.success) throw new Error("Dữ liệu nhật ký không hợp lệ.");
      setRecent({ userId: user.id, items: parsed.data.result.items });
    }).catch((error) => {
      if (!controller.signal.aborted) setRecent({ userId: user.id, error: error instanceof Error ? error.message : "Không tải được hoạt động gần đây." });
    });
    return () => controller.abort();
  }, [canReadAudit, user.id]);
  const current = recent?.userId === user.id ? recent : null;

  return <section aria-labelledby="user-access-title" className="admin-user-access">
    <h3 id="user-access-title">Truy cập</h3>
    <dl>
      <div><dt>Đăng nhập gần nhất</dt><dd>{formatAccessTime(user.lastLoginAt) ?? "Chưa đăng nhập"}{user.lastLoginAt && accessSource(user.lastLoginIp, user.lastLoginUserAgent) ? <small>{accessSource(user.lastLoginIp, user.lastLoginUserAgent)}</small> : null}</dd></div>
      <div><dt>Phiên đang mở</dt><dd>{user.activeSessions ? `${user.activeSessions} thiết bị` : "Không có"}</dd></div>
      <div><dt>Thao tác gần nhất</dt><dd>{user.lastAction ? auditActionLabel(user.lastAction) : "Chưa có"}{user.lastActionAt ? <small>{formatAccessTime(user.lastActionAt)}</small> : null}</dd></div>
    </dl>
    {canReadAudit ? <>
      <h3>Hoạt động gần đây</h3>
      {current?.error ? <p className="admin-help">{current.error}</p> : !current ? <p className="admin-help">Đang tải…</p> : current.items?.length ? <ul>
        {current.items.map((entry) => <li key={entry.id}><span>{auditActionLabel(entry.action)}</span><small>{[formatAccessTime(entry.createdAt), accessSource(entry.ipAddress, entry.userAgent)].filter(Boolean).join(" · ")}</small></li>)}
      </ul> : <p className="admin-help">Chưa có thao tác nào.</p>}
      <Link className="admin-link" href={`/admin/audit-log?userId=${encodeURIComponent(user.id)}`}>Xem toàn bộ trong Nhật ký hoạt động</Link>
    </> : null}
  </section>;
}
