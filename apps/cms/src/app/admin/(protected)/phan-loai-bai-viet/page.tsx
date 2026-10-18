import { requireAdminPermission } from "@/lib/admin-guard";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";
import { getTaxonomy } from "@/lib/backend";
export const dynamic = "force-dynamic";
export default async function TaxonomyPage() {
  await requireAdminPermission("taxonomy.view");
  const taxonomy = await getTaxonomy();
  return <main className="admin-page">
    <TaxonomyManager {...taxonomy} />
  </main>;
}
