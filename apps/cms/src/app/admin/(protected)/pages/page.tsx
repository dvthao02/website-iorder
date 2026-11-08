import { requireAdminPermission } from "@/lib/admin-guard";
import { PagesManager, type StaticPageType } from "@/components/admin/pages-manager";
import { getAdminPagesPage } from "@/lib/backend";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Tab của màn "Trang tĩnh" → bộ lọc `kind` của Backend. "Tất cả" = mọi trang trừ Trang chủ (Trang chủ có mục riêng).
const kindOfType = { all: "static", standard: "standard", listing: "listing", custom: "custom" } as const;

export default async function PagesManagerPage({ searchParams }: { searchParams: Promise<{ page?: string; pageSize?: string; query?: string; status?: string; sort?: string; dir?: string; type?: string }> }) {
  await requireAdminPermission("pages.view");
  const params = await searchParams;
  const type: StaticPageType = params.type === "standard" || params.type === "listing" || params.type === "custom" ? params.type : "all";
  const { type: _type, ...listParams } = params;
  void _type;
  // Số trang của từng tab (không theo từ khóa/trạng thái) để người vận hành biết mỗi loại có bao nhiêu.
  const [result, ...totals] = await Promise.all([
    // Mặc định xếp theo tên (danh mục trang cố định, tìm theo tên dễ hơn theo ngày sửa).
    getAdminPagesPage({ ...listParams, sort: listParams.sort ?? "title", dir: listParams.sort ? listParams.dir : "asc", kind: kindOfType[type] }),
    ...(["all", "standard", "listing", "custom"] as const).map((entry) => getAdminPagesPage({ kind: kindOfType[entry], pageSize: 5 })),
  ]);
  if (result.page > result.totalPages) {
    const next = new URLSearchParams({ page: String(result.totalPages), pageSize: String(result.pageSize) });
    if (params.query) next.set("query", params.query);
    if (params.status) next.set("status", params.status);
    if (params.sort) next.set("sort", params.sort);
    if (params.dir) next.set("dir", params.dir);
    if (type !== "all") next.set("type", type);
    redirect(`/admin/pages?${next}`);
  }
  const status = ["draft", "review", "scheduled", "published", "archived"].includes(params.status ?? "") ? params.status as "draft" | "review" | "scheduled" | "published" | "archived" : "all";
  const counts = { all: totals[0].total, standard: totals[1].total, listing: totals[2].total, custom: totals[3].total };
  return <main className="admin-page"><PagesManager counts={counts} initialQuery={params.query ?? ""} initialStatus={status} initialType={type} key={`${type}:${params.query ?? ""}`} result={result} /></main>;
}
