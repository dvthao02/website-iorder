import { redirect } from "next/navigation";

import { OfferingManagerList } from "@/components/admin/offering-manager-list";
import { getAdminOfferings } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ create?: string; edit?: string }> }) {
  const params = await searchParams;
  if (params.create === "1") redirect("/admin/dich-vu/moi");
  if (params.edit) redirect(`/admin/dich-vu/${encodeURIComponent(params.edit)}`);
  const offerings = await getAdminOfferings();

  return (
    <main className="min-h-screen bg-slate-100 p-6 sm:p-10">
      <section className="mx-auto max-w-7xl">
        <OfferingManagerList baseHref="/admin/dich-vu" createHref="/admin/dich-vu/moi" emptyMessage="Chưa tìm thấy dịch vụ phù hợp." items={offerings.filter((offering) => offering.type === "service")} singularLabel="Dịch vụ" title="Dịch vụ" />
      </section>
    </main>
  );
}
