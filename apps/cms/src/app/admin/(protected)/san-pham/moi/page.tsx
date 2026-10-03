import { OfferingEditorDetail } from "@/components/admin/offering-editor-detail";

export default function NewProductPage() {
  return <main className="admin-editor-detail-page"><OfferingEditorDetail backHref="/admin/san-pham" offeringType="software" offeringTypeLabel="Sản phẩm" /></main>;
}
