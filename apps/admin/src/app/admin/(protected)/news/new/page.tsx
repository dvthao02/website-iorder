import { requireAdminPermission } from "@/lib/admin-guard";
import { PostEditorDetail } from "@/components/admin/post-editor-detail";
import { getPostEditorChoices } from "@/lib/backend";

export default async function NewPostPage() {
  await requireAdminPermission("posts.create");
  return <main className="admin-editor-detail-page"><PostEditorDetail taxonomy={await getPostEditorChoices()} /></main>;
}
