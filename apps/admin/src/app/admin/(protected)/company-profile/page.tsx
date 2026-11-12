import { requireAdminPermission } from "@/lib/admin-guard";
import { BusinessProfileManager } from "@/components/admin/business-profile-manager";
import { getSiteProfile, getSiteProfileVersion } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function BusinessProfilePage() {
  await requireAdminPermission("settings.view");
  return <BusinessProfileManager profile={await getSiteProfile()} version={await getSiteProfileVersion()} />;
}
