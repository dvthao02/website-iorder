import { requireAdminPermission } from "@/lib/admin-guard";
import { redirect } from "next/navigation";
import { outOfRangeListHref } from "@/lib/admin-list-url";
import { ListingPageShortcut } from "@/components/admin/listing-page-shortcut";

import { PostManagerList } from "@/components/admin/post-manager-list";
import { getAdminPostsPage, getTaxonomy } from "@/lib/backend";

export const dynamic = "force-dynamic";

type PostStatus = "draft" | "review" | "scheduled" | "published" | "archived";
const statuses = new Set<PostStatus>(["draft", "review", "scheduled", "published", "archived"]);
const newsTypes = ["news", "announcement", "promotion", "case_study"] as const;

type Params = { create?: string; edit?: string; page?: string; query?: string; status?: string; type?: string; categoryId?: string; tagId?: string; sort?: string; dir?: string };

export default async function AdministratorPostsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdminPermission("posts.view");
  const params = await searchParams;
  if (params.create === "1") redirect("/admin/tin-tuc/moi");
  if (params.edit) redirect(`/admin/tin-tuc/${encodeURIComponent(params.edit)}`);
  const status = params.status && statuses.has(params.status as PostStatus) ? params.status as PostStatus : undefined;
  const type = newsTypes.find((value) => value === params.type);
  const filters = { query: params.query, status, type, categoryId: params.categoryId, tagId: params.tagId, sort: params.sort, dir: params.dir };
  const [result, taxonomy] = await Promise.all([getAdminPostsPage({ excludeType: "guide", page: params.page, ...filters }), getTaxonomy()]);
  const correctedHref = outOfRangeListHref("/admin/tin-tuc", result, filters);
  if (correctedHref) redirect(correctedHref);

  return <main className="admin-page"><ListingPageShortcut slugs={["listing-news"]} /><section><PostManagerList categories={taxonomy.categories} initialQuery={params.query ?? ""} initialStatus={status ?? "all"} key={params.query ?? ""} result={result} tags={taxonomy.tags} typeOptions={[...newsTypes]} /></section></main>;
}
