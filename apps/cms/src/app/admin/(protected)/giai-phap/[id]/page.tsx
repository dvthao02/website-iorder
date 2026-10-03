import { notFound } from "next/navigation";

import { OfferingEditorDetail } from "@/components/admin/offering-editor-detail";
import { getAdminOfferingById } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function SolutionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const offering = await getAdminOfferingById((await params).id);
  if (!offering || offering.type !== "solution") notFound();

  return <main className="admin-editor-detail-page"><OfferingEditorDetail backHref="/admin/giai-phap" offering={offering} offeringType="solution" offeringTypeLabel="Giải pháp" /></main>;
}
