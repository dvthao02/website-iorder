import { requireAdminPermission } from "@/lib/admin-guard";
import { OfferingEditorDetail } from "@/components/admin/offering-editor-detail";

export default async function NewSolutionPage() {
  await requireAdminPermission("offerings.create");
  return <main className="admin-editor-detail-page"><OfferingEditorDetail backHref="/admin/giai-phap" offeringType="solution" offeringTypeLabel="Giải pháp" /></main>;
}
