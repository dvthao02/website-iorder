import { AdminPage } from "@/components/admin/ui/admin-page";
import { requireAdminPermission } from "@/lib/admin-guard";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";
import { getTaxonomy } from "@/lib/backend";
export const dynamic = "force-dynamic";
export default async function TaxonomyPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  await requireAdminPermission("taxonomy.view");
  const { kind } = await searchParams;
  const taxonomy = await getTaxonomy();
  return <AdminPage variant="flush">
    <TaxonomyManager {...taxonomy} initialKind={kind === "tags" ? "tags" : "categories"} />
  </AdminPage>;
}
