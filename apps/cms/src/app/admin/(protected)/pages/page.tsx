import { PagesManager } from "@/components/admin/pages-manager";
import { getAdminPages } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function PagesManagerPage() {
  return <main className="p-5 md:p-8"><PagesManager initialPages={await getAdminPages()} /></main>;
}
