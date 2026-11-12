import { requireAdminPermission } from "@/lib/admin-guard";
import { PageEditorDetail } from "@/components/admin/page-editor-detail";

export default async function NewPageEditor() {
  await requireAdminPermission("pages.create");
  return <main className="admin-editor-detail-page"><PageEditorDetail /></main>;
}
