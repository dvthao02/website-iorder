import { AdminPage } from "@/components/admin/ui/admin-page";
import { requireAdminPermission } from "@/lib/admin-guard";
import { RedirectsManager } from "@/components/admin/redirects-manager";
import { getRedirects } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function RedirectsAdminPage() {
  await requireAdminPermission("redirects.view");
  return <AdminPage variant="flush">
    <RedirectsManager initialRedirects={await getRedirects()} />
  </AdminPage>;
}
