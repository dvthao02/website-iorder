import { requireAdminPermission } from "@/lib/admin-guard";
import { redirect } from "next/navigation";
import { ListingPageShortcut } from "@/components/admin/listing-page-shortcut";
import { outOfRangeListHref } from "@/lib/admin-list-url";

import { PostManagerList } from "@/components/admin/post-manager-list";
import { SupportCenterTabs, type SupportCenterTab } from "@/components/admin/support-center-manager";
import { SupportDownloadManagerList } from "@/components/admin/support-download-manager-list";
import { getAdminPostsPage, getAdminSupportDownloads, getRequestAdministrator, getTaxonomy } from "@/lib/backend";
import { hasCmsPermission } from "@iorder/core/server/auth/permissions";

export const dynamic = "force-dynamic";

type PostStatus = "draft" | "review" | "scheduled" | "published" | "archived";
const statuses = new Set<PostStatus>(["draft", "review", "scheduled", "published", "archived"]);

type ResourcesSearchParams = { create?: string; edit?: string; page?: string; query?: string; status?: string; tab?: string; categoryId?: string; tagId?: string; sort?: string; dir?: string };

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<ResourcesSearchParams> }) {
  await requireAdminPermission(["support_downloads.view", "posts.view"]);
  const params = await searchParams;
  const administrator = await getRequestAdministrator();
  if (!administrator) redirect("/admin/login");
  const showDownloads = hasCmsPermission(administrator, "support_downloads.view");
  const showGuides = hasCmsPermission(administrator, "posts.view");
  const tab: SupportCenterTab = (params.tab === "guides" && showGuides) || !showDownloads ? "guides" : "downloads";
  const tabs = <SupportCenterTabs active={tab} showDownloads={showDownloads} showGuides={showGuides} />;

  if (tab === "downloads") {
    const supportDownloads = await getAdminSupportDownloads();
    return <main className="admin-page"><ListingPageShortcut slugs={["listing-support"]} /><SupportDownloadManagerList tabs={tabs} initialSelectedId={params.edit} items={supportDownloads} startCreating={params.create === "1"} /></main>;
  }

  if (params.create === "1") redirect("/admin/tai-nguyen/huong-dan/moi");
  if (params.edit) redirect(`/admin/tai-nguyen/huong-dan/${encodeURIComponent(params.edit)}`);
  const status = params.status && statuses.has(params.status as PostStatus) ? params.status as PostStatus : undefined;
  const filters = { query: params.query, status, categoryId: params.categoryId, tagId: params.tagId, sort: params.sort, dir: params.dir };
  const [result, taxonomy] = await Promise.all([getAdminPostsPage({ type: "guide", page: params.page, ...filters }), getTaxonomy()]);
  const correctedHref = outOfRangeListHref("/admin/tai-nguyen", result, { tab: "guides", ...filters });
  if (correctedHref) redirect(correctedHref);

  return <main className="admin-page"><ListingPageShortcut slugs={["listing-support"]} /><section><PostManagerList tabs={tabs} baseHref="/admin/tai-nguyen/huong-dan" createHref="/admin/tai-nguyen/huong-dan/moi" categories={taxonomy.categories} initialQuery={params.query ?? ""} initialStatus={status ?? "all"} key={params.query ?? ""} result={result} singularLabel="hướng dẫn" tags={taxonomy.tags} title="Hỗ trợ cài đặt" /></section></main>;
}
