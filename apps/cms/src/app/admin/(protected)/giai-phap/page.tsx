import { redirect } from "next/navigation";

import { OfferingManagerList } from "@/components/admin/offering-manager-list";
import { getAdminOfferings } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function SolutionsPage({ searchParams }: { searchParams: Promise<{ create?: string; edit?: string }> }) {
  const params = await searchParams;
  if (params.create === "1") redirect("/admin/giai-phap/moi");
  if (params.edit) redirect(`/admin/giai-phap/${encodeURIComponent(params.edit)}`);
  const offerings = await getAdminOfferings();

  return (
    <main className="min-h-screen bg-slate-100 p-6 sm:p-10">
      <section className="mx-auto max-w-7xl">
        <OfferingManagerList baseHref="/admin/giai-phap" createHref="/admin/giai-phap/moi" emptyMessage="Chưa tìm thấy giải pháp phù hợp." items={offerings.filter((offering) => offering.type === "solution")} singularLabel="Giải pháp" title="Giải pháp" />
      </section>
    </main>
  );
}
