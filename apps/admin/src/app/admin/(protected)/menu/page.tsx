import { requireAdminPermission } from "@/lib/admin-guard";
import { NavigationEditor } from "@/components/admin/navigation-editor";
import { getAdminNavigation, getPublishedNavigationTargets } from "@/lib/backend";

export const dynamic = "force-dynamic";
export default async function MenuPage() {
  await requireAdminPermission("navigation.view");
  const locations = ["header", "header_cta", "footer"] as const;
  const [menuEntries, targets] = await Promise.all([
    Promise.all(locations.map(async (location) => [location, await getAdminNavigation(location)] as const)),
    getPublishedNavigationTargets(),
  ]);
  const menus = Object.fromEntries(menuEntries) as Record<(typeof locations)[number], Awaited<ReturnType<typeof getAdminNavigation>>>;
  return <main className="admin-page"><NavigationEditor menus={menus} targets={targets} /></main>;
}
