import { requireAdminPermission } from "@/lib/admin-guard";
import { redirect } from "next/navigation";
import { ListingPageShortcut } from "@/components/admin/listing-page-shortcut";

import { SupportDownloadManagerList } from "@/components/admin/support-download-manager-list";
import { getAdminSupportDownloads } from "@/lib/backend";

export const dynamic = "force-dynamic";

type ResourcesSearchParams = { create?: string; edit?: string; tab?: string } & Record<string, string | undefined>;

// Tệp cài đặt (driver, tài liệu) hiển thị ở /ho-tro/cai-dat. Bài hướng dẫn nằm ở /admin/guides.
export default async function ResourcesPage({ searchParams }: { searchParams: Promise<ResourcesSearchParams> }) {
  const { tab, ...params } = await searchParams;
  // Liên kết cũ "?tab=guides" (thông báo, đánh dấu trang) chuyển sang màn Hướng dẫn, giữ bộ lọc.
  if (tab === "guides") {
    const query = new URLSearchParams(Object.entries(params).flatMap(([key, value]) => value ? [[key, value]] : [])).toString();
    redirect(query ? `/admin/guides?${query}` : "/admin/guides");
  }
  await requireAdminPermission("support_downloads.view");
  const supportDownloads = await getAdminSupportDownloads();
  return <main className="admin-page"><ListingPageShortcut slugs={["listing-support"]} /><SupportDownloadManagerList initialSelectedId={params.edit} items={supportDownloads} startCreating={params.create === "1"} /></main>;
}
