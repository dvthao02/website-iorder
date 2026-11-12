import { requireAdminPermission } from "@/lib/admin-guard";
import { AnalyticsStatus } from "@/components/admin/analytics-status";
import { getAnalyticsOverview } from "@/lib/backend";

export default async function AnalyticsPage() {
  await requireAdminPermission("dashboard.view");
  return <AnalyticsStatus overview={await getAnalyticsOverview()} />;
}
