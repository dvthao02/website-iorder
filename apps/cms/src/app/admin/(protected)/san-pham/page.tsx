import { redirect } from "next/navigation";

import { OfferingManagerList } from "@/components/admin/offering-manager-list";
import { getAdminOfferings } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ create?: string; edit?: string }> }) {
  const params = await searchParams;
  if (params.create === "1") redirect("/admin/san-pham/moi");
  if (params.edit) redirect(`/admin/san-pham/${encodeURIComponent(params.edit)}`);
  const offerings = await getAdminOfferings();

  return (
    <main className="min-h-screen bg-slate-100 p-6 sm:p-10">
      <section className="mx-auto max-w-7xl">
        <OfferingManagerList baseHref="/admin/san-pham" createHref="/admin/san-pham/moi" emptyMessage="Chưa tìm thấy sản phẩm phù hợp." items={offerings.filter((offering) => offering.type === "software")} singularLabel="Sản phẩm" title="Sản phẩm" />
      </section>
    </main>
  );
}
