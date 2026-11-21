import { NextResponse } from "next/server";

import { getAnalyticsOverview } from "@iorder/shared/server/analytics/analytics.service";
import { getRequestAdministrator } from "@iorder/shared/server/auth/request-administrator";
import { getBackupStatus } from "@iorder/shared/server/backup/backup-status";
import { hasCmsPermission } from "@iorder/shared/server/auth/permissions";
import { getRecentAuditLogs } from "@iorder/shared/server/audit/audit.service";
import { getPublishingReadiness } from "@iorder/shared/server/publishing-readiness/publishing-readiness.service";
import { getDashboardContentSummary } from "@iorder/shared/server/dashboard/dashboard-content.service";
import { parseDashboardRange } from "@iorder/shared/server/dashboard/dashboard-range";
import { withRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

async function handleGET(request: Request) {
  const administrator = await getRequestAdministrator();
  if (!administrator) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." } }, { status: 401 });
  }

  // `days`: khoảng thời gian của bộ lọc thống kê (7, 30 hoặc 90; mặc định 30). Mỗi service tự lọc phần theo quyền xem của người gọi.
  const days = parseDashboardRange(new URL(request.url).searchParams.get("days"));
  const [analytics, readiness, auditLogs, content, backup] = await Promise.all([
    hasCmsPermission(administrator, "dashboard.view") ? getAnalyticsOverview(days) : Promise.resolve({ connection: "not_connected" as const, periodDays: days }),
    getPublishingReadiness(administrator),
    hasCmsPermission(administrator, "audit.view") ? getRecentAuditLogs() : Promise.resolve([]),
    getDashboardContentSummary(administrator, new Date(), days),
    // Trạng thái sao lưu là thông tin hạ tầng: chỉ người xem được tình trạng hệ thống (system.view), như trang Sao lưu.
    hasCmsPermission(administrator, "system.view") ? getBackupStatus() : Promise.resolve(null),
  ]);

  return NextResponse.json({ administrator, analytics, readiness, auditLogs, content, backup });
}

export const GET = withRequestContext(handleGET);
