import { OfferingEditorDetail } from "@/components/admin/offering-editor-detail";

export default function NewServicePage() {
  return <main className="admin-editor-detail-page"><OfferingEditorDetail backHref="/admin/dich-vu" offeringType="service" offeringTypeLabel="Dịch vụ" /></main>;
}
