import { requireAdminPermission } from "@/lib/admin-guard";
import { RedirectsManager } from "@/components/admin/redirects-manager";
import { getRedirects } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function RedirectsAdminPage() {
  await requireAdminPermission("redirects.view");
  return <main className="admin-page">
    <RedirectsManager initialRedirects={await getRedirects()} />
  </main>;
}
