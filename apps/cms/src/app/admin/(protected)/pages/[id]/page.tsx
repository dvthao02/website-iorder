import { notFound } from "next/navigation";

import { PageEditorDetail } from "@/components/admin/page-editor-detail";
import { getAdminPages } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function PageEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = (await getAdminPages()).find(item => item.id === id);
  if (!page) notFound();
  return <main className="admin-editor-detail-page"><PageEditorDetail page={page} /></main>;
}
