import { RedirectsManager } from "@/components/admin/redirects-manager";
import { getRedirects } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function RedirectsAdminPage() {
  return <main className="mx-auto max-w-7xl p-5 md:p-8">
    <RedirectsManager initialRedirects={await getRedirects()} />
  </main>;
}
