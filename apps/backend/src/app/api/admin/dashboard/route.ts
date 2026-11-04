import { NextResponse } from "next/server";

import { getAnalyticsOverview } from "@iorder/core/server/analytics/analytics.service";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { getBackupStatus } from "@iorder/core/server/backup/backup-status";
import { hasCmsPermission } from "@iorder/core/server/auth/permissions";
import { getRecentAuditLogs } from "@iorder/core/server/audit/audit.service";
import { getPublishingReadiness } from "@iorder/core/server/publishing-readiness/publishing-readiness.service";
import { getDashboardContentSummary } from "@iorder/core/server/dashboard/dashboard-content.service";
import { withRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

async function handleGET() {
  const administrator = await getRequestAdministrator();
  if (!administrator) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." } }, { status: 401 });
  }

  // Each service filters its sections by the caller's view permissions.
  const [analytics, readiness, auditLogs, content, backup] = await Promise.all([
    hasCmsPermission(administrator, "dashboard.view") ? getAnalyticsOverview() : Promise.resolve({ connection: "not_connected" as const, periodDays: 7 as const }),
    getPublishingReadiness(administrator),
    hasCmsPermission(administrator, "audit.view") ? getRecentAuditLogs() : Promise.resolve([]),
    getDashboardContentSummary(administrator),
    // Trạng thái sao lưu là thông tin vận hành: chỉ người xem được cài đặt hệ thống.
    hasCmsPermission(administrator, "settings.view") ? getBackupStatus() : Promise.resolve(null),
  ]);

  return NextResponse.json({ administrator, analytics, readiness, auditLogs, content, backup });
}

export const GET = withRequestContext(handleGET);
