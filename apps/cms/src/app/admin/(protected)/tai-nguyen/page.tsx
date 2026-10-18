import { requireAdminPermission } from "@/lib/admin-guard";
import { redirect } from "next/navigation";
import { ListingPageShortcut } from "@/components/admin/listing-page-shortcut";

import { PostManagerList } from "@/components/admin/post-manager-list";
import { SupportCenterTabs, type SupportCenterTab } from "@/components/admin/support-center-manager";
import { SupportDownloadManagerList } from "@/components/admin/support-download-manager-list";
import { getAdminPostsPage, getAdminSupportDownloads, getRequestAdministrator } from "@/lib/backend";
import { hasCmsPermission } from "@iorder/core/server/auth/permissions";

export const dynamic = "force-dynamic";

type PostStatus = "draft" | "review" | "scheduled" | "published" | "archived";
const statuses = new Set<PostStatus>(["draft", "review", "scheduled", "published", "archived"]);

type ResourcesSearchParams = { create?: string; edit?: string; page?: string; query?: string; status?: string; tab?: string };

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
  const result = await getAdminPostsPage({ type: "guide", page: params.page, query: params.query, status });
  if (result.page > result.totalPages) {
    const corrected = new URLSearchParams({ tab: "guides", page: String(result.totalPages) });
    if (params.query) corrected.set("query", params.query);
    if (status) corrected.set("status", status);
    redirect(`/admin/tai-nguyen?${corrected}`);
  }

  return <main className="admin-page"><ListingPageShortcut slugs={["listing-support"]} /><section><PostManagerList tabs={tabs} baseHref="/admin/tai-nguyen/huong-dan" createHref="/admin/tai-nguyen/huong-dan/moi" initialQuery={params.query ?? ""} initialStatus={status ?? "all"} key={`${params.query ?? ""}:${status ?? "all"}:${params.page ?? "1"}`} result={result} singularLabel="hướng dẫn" title="Hỗ trợ cài đặt" /></section></main>;
}
