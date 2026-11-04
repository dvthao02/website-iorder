import { redirect } from "next/navigation";
import { RolesManager } from "@/components/admin/roles-manager";
import { UsersManager } from "@/components/admin/users-manager";
import { AdminRouteTabs } from "@/components/admin/ui/admin-route-tabs";
import { getCmsRolesPayload, getCmsUsersPage, getRequestAdministrator } from "@/lib/backend";
import { cmsUserListQuerySchema } from "@iorder/core/server/users/users.contract";
import { hasCmsPermission, isSuperAdmin } from "@iorder/core/server/auth/permissions";

export const dynamic = "force-dynamic";

// Một trang, hai tab: Người dùng (/admin/users) và Vai trò & quyền (/admin/users?tab=roles). Mỗi tab theo quyền xem riêng.
export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await getRequestAdministrator();
  const canUsers = Boolean(actor && hasCmsPermission(actor, "users.view"));
  const canRoles = Boolean(actor && hasCmsPermission(actor, "roles.view"));
  if (!actor || (!canUsers && !canRoles)) redirect("/admin/forbidden");
  const params = await searchParams;
  const tab = params.tab === "roles" ? "roles" : "users";
  if (tab === "users" && !canUsers) redirect("/admin/users?tab=roles");
  if (tab === "roles" && !canRoles) redirect("/admin/users");
  const tabs = <AdminRouteTabs ariaLabel="Người dùng và vai trò" value={tab} items={[
    ...(canUsers ? [{ label: "Người dùng", value: "users" as const, href: "/admin/users" }] : []),
    ...(canRoles ? [{ label: "Vai trò & quyền", value: "roles" as const, href: "/admin/users?tab=roles" }] : []),
  ]} />;

  if (tab === "roles") {
    const { roles, modules, actionLabels } = await getCmsRolesPayload();
    return <main className="admin-page">
      <RolesManager actionLabels={actionLabels} modules={modules} roles={roles} tabs={tabs} />
    </main>;
  }

  const query = cmsUserListQuerySchema.parse({ page: params.page, pageSize: params.pageSize, query: params.query, status: params.status, role: params.role, sort: params.sort, dir: params.dir });
  const { page: result, roles } = await getCmsUsersPage(query);
  if (query.page > result.totalPages) {
    const target = new URLSearchParams(Object.entries({ ...query, page: result.totalPages }).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
    redirect(`/admin/users?${target}`);
  }
  return <main className="admin-page">
    <UsersManager canAssignSuperAdmin={isSuperAdmin(actor)} currentUserId={actor.userId} key={JSON.stringify(query)} initialPage={result} initialQuery={query} roles={roles} tabs={tabs} />
  </main>;
}
