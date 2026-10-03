import { LeadsManager } from "@/components/admin/leads-manager";
import { getLeads } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function LeadsAdminPage() {
  const leads = await getLeads();
  return <main className="mx-auto max-w-7xl p-5 md:p-8">
    <LeadsManager initialLeads={leads} />
  </main>;
}
