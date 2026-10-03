import { AnalyticsStatus } from "@/components/admin/analytics-status";
import { getAnalyticsOverview } from "@/lib/backend";

export default async function AnalyticsPage() {
  return <main className="mx-auto max-w-6xl p-5 md:p-8"><AnalyticsStatus overview={await getAnalyticsOverview()} /></main>;
}
