import { NavigationEditor } from "@/components/admin/navigation-editor";
import { getAdminNavigation } from "@/lib/backend";

export const dynamic = "force-dynamic";
export default async function MenuPage() {
  const locations = ["header", "header_cta", "footer"] as const;
  const menus = Object.fromEntries(await Promise.all(locations.map(async (location) => [location, await getAdminNavigation(location)]))) as Record<(typeof locations)[number], Awaited<ReturnType<typeof getAdminNavigation>>>;
  return <main className="p-4 md:p-6"><NavigationEditor menus={menus} /></main>;
}
