import { redirect } from "next/navigation";
import { UsersManager } from "@/components/admin/users-manager";
import { getRequestAdministrator } from "@/lib/backend";
import { getCmsUsersPage } from "@/lib/backend";
import { cmsUserListQuerySchema } from "@iorder/core/server/users/users.contract";
export const dynamic = "force-dynamic";
export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await getRequestAdministrator();
  if (actor?.role !== "admin") redirect("/admin");
  const params = await searchParams;
  const query = cmsUserListQuerySchema.parse({ page: params.page, pageSize: params.pageSize, query: params.query, status: params.status, role: params.role });
  const result = await getCmsUsersPage(query);
  if (query.page > result.totalPages) {
    const target = new URLSearchParams(Object.entries({ ...query, page: result.totalPages }).map(([key, value]) => [key, String(value)]));
    redirect(`/admin/tai-khoan?${target}`);
  }
  return <main className="mx-auto max-w-7xl p-5 md:p-8">
    <UsersManager key={JSON.stringify(query)} initialPage={result} initialQuery={query} />
  </main>;
}
