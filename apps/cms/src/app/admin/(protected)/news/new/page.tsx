import { requireAdminPermission } from "@/lib/admin-guard";
import { PostEditorDetail } from "@/components/admin/post-editor-detail";
import { getTaxonomy } from "@/lib/backend";

export default async function NewPostPage() {
  await requireAdminPermission("posts.create");
  return <main className="admin-editor-detail-page"><PostEditorDetail taxonomy={await getTaxonomy()} /></main>;
}
