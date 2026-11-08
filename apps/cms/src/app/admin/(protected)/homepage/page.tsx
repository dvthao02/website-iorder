import { requireAdminPermission } from "@/lib/admin-guard";
import { notFound } from "next/navigation";

import { PageEditorDetail } from "@/components/admin/page-editor-detail";
import { getAdminSystemPageBySlug } from "@/lib/backend";

export const dynamic = "force-dynamic";

// Trang chủ có mục riêng trên sidebar (sửa thường xuyên nhất); các trang có sẵn khác mở từ Menu hoặc "Trang tĩnh".
export default async function HomePageEditor() {
  await requireAdminPermission("pages.view");
  const page = await getAdminSystemPageBySlug("home");
  if (!page) notFound();
  return <main className="admin-editor-detail-page"><PageEditorDetail key={`${page.id}:${page.draftVersion}`} page={page} /></main>;
}
