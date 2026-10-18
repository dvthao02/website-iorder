import { requireAdminPermission } from "@/lib/admin-guard";
import { SupportingManager } from "@/components/admin/supporting-manager";
import { redirect } from "next/navigation";
import { getPartnersPage, getTestimonialsPage } from "@/lib/backend";
import { partnerListQuerySchema, testimonialListQuerySchema } from "@iorder/core/server/supporting/supporting.contract";
export const dynamic = "force-dynamic";
export default async function SupportingAdmin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPermission("supporting.view");
  const params = await searchParams;
  const kind = params.kind === "testimonials" ? "testimonials" : "partners";
  const input = { page: params.page, pageSize: params.pageSize, query: params.query, visibility: params.visibility };
  const query = kind === "partners" ? partnerListQuerySchema.parse({ ...input, partnerKind: params.partnerKind }) : { ...testimonialListQuerySchema.parse(input), partnerKind: "all" as const };
  const partnerPage = kind === "partners" ? await getPartnersPage(query) : null;
  const testimonialPage = kind === "testimonials" ? await getTestimonialsPage(testimonialListQuerySchema.parse(input)) : null;
  const result = partnerPage ?? testimonialPage!;
  if (query.page > result.totalPages) {
    const target = new URLSearchParams({ kind, page: String(result.totalPages), pageSize: String(query.pageSize), query: query.query, visibility: query.visibility });
    if (kind === "partners") target.set("partnerKind", query.partnerKind);
    redirect(`/admin/doi-tac?${target}`);
  }
  return <main className="admin-page">
    <SupportingManager key={JSON.stringify({ kind, query })} initialKind={kind} initialQuery={query} pagination={result} partners={partnerPage?.items ?? []} testimonials={testimonialPage?.items ?? []} />
  </main>;
}
