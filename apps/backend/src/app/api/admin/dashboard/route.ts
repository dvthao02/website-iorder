import { NextResponse } from "next/server";

import { getAnalyticsOverview } from "@iorder/core/server/analytics/analytics.service";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { getRecentAuditLogs } from "@iorder/core/server/audit/audit.service";
import { getPublishingReadiness } from "@iorder/core/server/publishing-readiness/publishing-readiness.service";

export const runtime = "nodejs";

export async function GET() {
  const administrator = await getRequestAdministrator();
  if (!administrator) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." } }, { status: 401 });
  }

  const [analytics, readiness, auditLogs] = await Promise.all([
    getAnalyticsOverview(),
    getPublishingReadiness(),
    getRecentAuditLogs(),
  ]);

  return NextResponse.json({ administrator, analytics, readiness, auditLogs });
}
