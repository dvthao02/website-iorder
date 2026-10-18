import { requireAdminPermission } from "@/lib/admin-guard";
import { PostEditorDetail } from "@/components/admin/post-editor-detail";
import { getTaxonomy } from "@/lib/backend";

export default async function NewSupportGuidePage() {
  await requireAdminPermission("posts.create");
  return <main className="admin-editor-detail-page"><PostEditorDetail backHref="/admin/tai-nguyen?tab=guides" contentLabel="bài hướng dẫn" contentType="guide" taxonomy={await getTaxonomy()} /></main>;
}
