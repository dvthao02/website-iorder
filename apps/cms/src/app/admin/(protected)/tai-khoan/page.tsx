import { redirect } from "next/navigation";
import { UsersManager } from "@/components/admin/users-manager";
import { getRequestAdministrator } from "@/lib/backend";
import { getCmsUsers } from "@/lib/backend";
export const dynamic = "force-dynamic";
export default async function UsersPage() {
  const actor = await getRequestAdministrator();
  if (actor?.role !== "admin") redirect("/admin");
  return <main className="mx-auto max-w-7xl p-5 md:p-8">
    <UsersManager initialUsers={await getCmsUsers()} />
  </main>;
}
