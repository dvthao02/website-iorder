import { requireAdminPermission } from "@/lib/admin-guard";
import { redirect } from "next/navigation";
import { outOfRangeListHref } from "@/lib/admin-list-url";
import { ListingPageShortcut } from "@/components/admin/listing-page-shortcut";

import { PostManagerList } from "@/components/admin/post-manager-list";
import { getAdminPostsPage } from "@/lib/backend";

export const dynamic = "force-dynamic";

type PostStatus = "draft" | "review" | "scheduled" | "published" | "archived";
const statuses = new Set<PostStatus>(["draft", "review", "scheduled", "published", "archived"]);

export default async function AdministratorPostsPage({ searchParams }: { searchParams: Promise<{ create?: string; edit?: string; page?: string; query?: string; status?: string }> }) {
  await requireAdminPermission("posts.view");
  const params = await searchParams;
  if (params.create === "1") redirect("/admin/tin-tuc/moi");
  if (params.edit) redirect(`/admin/tin-tuc/${encodeURIComponent(params.edit)}`);
  const status = params.status && statuses.has(params.status as PostStatus) ? params.status as PostStatus : undefined;
  const result = await getAdminPostsPage({ excludeType: "guide", page: params.page, query: params.query, status });
  const correctedHref = outOfRangeListHref("/admin/tin-tuc", result, { query: params.query, status });
  if (correctedHref) redirect(correctedHref);

  return <main className="admin-page"><ListingPageShortcut slugs={["listing-news"]} /><section><PostManagerList initialQuery={params.query ?? ""} initialStatus={status ?? "all"} key={`${params.query ?? ""}:${status ?? "all"}:${params.page ?? "1"}`} result={result} /></section></main>;
}
