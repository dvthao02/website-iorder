import { NextResponse } from "next/server";

import { getAnalyticsOverview } from "@iorder/core/server/analytics/analytics.service";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { hasCmsPermission } from "@iorder/core/server/auth/permissions";
import { getRecentAuditLogs } from "@iorder/core/server/audit/audit.service";
import { getPublishingReadiness } from "@iorder/core/server/publishing-readiness/publishing-readiness.service";
import { getDashboardContentSummary } from "@iorder/core/server/dashboard/dashboard-content.service";

export const runtime = "nodejs";

export async function GET() {
  const administrator = await getRequestAdministrator();
  if (!administrator) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." } }, { status: 401 });
  }

  const [analytics, readiness, auditLogs, content] = await Promise.all([
    hasCmsPermission(administrator, "analytics.read") ? getAnalyticsOverview() : Promise.resolve({ connection: "not_connected" as const, periodDays: 7, visits: null }),
    hasCmsPermission(administrator, "content.read") ? getPublishingReadiness() : Promise.resolve([]),
    hasCmsPermission(administrator, "audit.read") ? getRecentAuditLogs() : Promise.resolve([]),
    hasCmsPermission(administrator, "content.read") ? getDashboardContentSummary() : Promise.resolve({ pages: { missingSeo: 0, pending: 0, published: 0, scheduled: 0, total: 0 }, posts: { missingSeo: 0, pending: 0, published: 0, scheduled: 0, total: 0 }, offerings: { products: { missingSeo: 0, pending: 0, published: 0, scheduled: 0, total: 0 }, solutions: { missingSeo: 0, pending: 0, published: 0, scheduled: 0, total: 0 }, services: { missingSeo: 0, pending: 0, published: 0, scheduled: 0, total: 0 } }, equipment: { missingSeo: 0, pending: 0, published: 0, scheduled: 0, total: 0 }, downloads: { enabled: 0, total: 0 }, leads: { new: 0, total: 0 }, recent: [] }),
  ]);

  return NextResponse.json({ administrator, analytics, readiness, auditLogs, content });
}
