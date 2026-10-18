import { redirect } from "next/navigation";

import { hasCmsPermission } from "@iorder/core/server/auth/permissions";
import { RolesManager } from "@/components/admin/roles-manager";
import { getCmsRolesPayload, getRequestAdministrator } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function RolesAndPermissionsPage() {
  const actor = await getRequestAdministrator();
  if (!actor || !hasCmsPermission(actor, "roles.view")) redirect("/admin/khong-co-quyen");
  const { roles, modules, actionLabels } = await getCmsRolesPayload();
  return <main className="admin-page">
    <RolesManager actionLabels={actionLabels} modules={modules} roles={roles} />
  </main>;
}
