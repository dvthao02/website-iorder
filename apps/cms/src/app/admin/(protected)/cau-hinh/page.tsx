import { WebsiteSettingsOverview } from "@/components/admin/website-settings-overview";

export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  return <WebsiteSettingsOverview />;
}
