import { NextResponse } from "next/server";

import { getAnalyticsOverview } from "@iorder/core/server/analytics/analytics.service";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
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
  const [analytics, readiness, auditLogs, content] = await Promise.all([
    hasCmsPermission(administrator, "dashboard.view") ? getAnalyticsOverview() : Promise.resolve({ connection: "not_connected" as const, periodDays: 7 as const }),
    getPublishingReadiness(administrator),
    hasCmsPermission(administrator, "audit.view") ? getRecentAuditLogs() : Promise.resolve([]),
    getDashboardContentSummary(administrator),
  ]);

  return NextResponse.json({ administrator, analytics, readiness, auditLogs, content });
}

export const GET = withRequestContext(handleGET);
