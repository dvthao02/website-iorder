import { TaxonomyManager } from "@/components/admin/taxonomy-manager";
import { getTaxonomy } from "@/lib/backend";
export const dynamic = "force-dynamic";
export default async function TaxonomyPage() {
  const taxonomy = await getTaxonomy();
  return <main className="mx-auto max-w-7xl p-5 md:p-8">
    <TaxonomyManager {...taxonomy} />
  </main>;
}
