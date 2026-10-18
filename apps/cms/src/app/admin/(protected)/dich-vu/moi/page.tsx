import { requireAdminPermission } from "@/lib/admin-guard";
import { OfferingEditorDetail } from "@/components/admin/offering-editor-detail";

export default async function NewServicePage() {
  await requireAdminPermission("offerings.create");
  return <main className="admin-editor-detail-page"><OfferingEditorDetail backHref="/admin/dich-vu" offeringType="service" offeringTypeLabel="Dịch vụ" /></main>;
}
