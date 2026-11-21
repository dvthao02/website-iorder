import { requireAdminPermission } from "@/lib/admin-guard";
import { PostEditorDetail } from "@/components/admin/post-editor-detail";
import { getPostEditorChoices } from "@/lib/backend";

export default async function NewGuidePage() {
  await requireAdminPermission("posts.create");
  return <main className="admin-editor-detail-page"><PostEditorDetail backHref="/admin/guides" contentLabel="bài hướng dẫn" contentType="guide" taxonomy={await getPostEditorChoices()} /></main>;
}
