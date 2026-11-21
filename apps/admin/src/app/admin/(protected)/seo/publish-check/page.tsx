import { requireAdminPermission } from "@/lib/admin-guard";
import { PublishingReadinessPage } from "@/components/admin/publishing-readiness-page";

export default async function SeoReadinessPage() {
  await requireAdminPermission("settings.view");
  return <PublishingReadinessPage />;
}
