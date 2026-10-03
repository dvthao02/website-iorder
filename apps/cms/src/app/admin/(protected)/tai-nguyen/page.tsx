import { SupportCenterManager } from "@/components/admin/support-center-manager";
import { getAdminSupportDownloads } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<{ create?: string; edit?: string }> }) {
  const params = await searchParams;
  const supportDownloads = await getAdminSupportDownloads();

  return <main className="p-4 md:p-6"><SupportCenterManager downloads={supportDownloads} initialSelectedId={params.edit} startCreating={params.create === "1"} /></main>;
}
