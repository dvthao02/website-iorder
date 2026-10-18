import { requireAdminPermission } from "@/lib/admin-guard";
import { OfferingEditorDetail } from "@/components/admin/offering-editor-detail";

export default async function NewProductPage() {
  await requireAdminPermission("offerings.create");
  return <main className="admin-editor-detail-page"><OfferingEditorDetail backHref="/admin/san-pham" offeringType="software" offeringTypeLabel="Sản phẩm" /></main>;
}
