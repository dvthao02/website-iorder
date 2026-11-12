import { requireAdminPermission } from "@/lib/admin-guard";
import { redirect } from "next/navigation";
import { ListingPageShortcut } from "@/components/admin/listing-page-shortcut";
import { outOfRangeListHref, validPageSize } from "@/lib/admin-list-url";

import { PostManagerList } from "@/components/admin/post-manager-list";
import { uncategorizedGuideGroup } from "@iorder/shared/server/posts/posts.contract";
import { getAdminPostsPage, getTaxonomy } from "@/lib/backend";

export const dynamic = "force-dynamic";

type PostStatus = "draft" | "review" | "scheduled" | "published" | "archived";
const statuses = new Set<PostStatus>(["draft", "review", "scheduled", "published", "archived"]);

type GuidesSearchParams = { create?: string; edit?: string; page?: string; pageSize?: string; query?: string; status?: string; categoryId?: string; tagId?: string; sort?: string; dir?: string };

// Bài hướng dẫn sử dụng (posts type=guide), hiển thị ở /ho-tro/huong-dan; tách khỏi tệp cài đặt (/admin/resources).
export default async function GuidesPage({ searchParams }: { searchParams: Promise<GuidesSearchParams> }) {
  await requireAdminPermission("posts.view");
  const params = await searchParams;
  if (params.create === "1") redirect("/admin/guides/new");
  if (params.edit) redirect(`/admin/guides/${encodeURIComponent(params.edit)}`);
  const status = params.status && statuses.has(params.status as PostStatus) ? params.status as PostStatus : undefined;
  const filters = { query: params.query, status, categoryId: params.categoryId, tagId: params.tagId, sort: params.sort, dir: params.dir, pageSize: validPageSize(params.pageSize) };
  const [result, taxonomy] = await Promise.all([getAdminPostsPage({ type: "guide", page: params.page, ...filters }), getTaxonomy()]);
  const correctedHref = outOfRangeListHref("/admin/guides", result, filters);
  if (correctedHref) redirect(correctedHref);

  return <main className="admin-page"><ListingPageShortcut slugs={["listing-guides"]} /><section><PostManagerList baseHref="/admin/guides" createHref="/admin/guides/new" categories={taxonomy.categories} groupColumn={{ label: "Nhóm", empty: uncategorizedGuideGroup }} showTaxonomyLink initialQuery={params.query ?? ""} initialStatus={status ?? "all"} key={params.query ?? ""} result={result} singularLabel="hướng dẫn" tags={taxonomy.tags} title="Hướng dẫn sử dụng" /></section></main>;
}
