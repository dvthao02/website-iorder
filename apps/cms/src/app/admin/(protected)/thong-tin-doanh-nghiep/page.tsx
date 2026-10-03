import { BusinessProfileManager } from "@/components/admin/business-profile-manager";
import { getSiteProfile } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function BusinessProfilePage() {
  return <BusinessProfileManager profile={await getSiteProfile()} />;
}
