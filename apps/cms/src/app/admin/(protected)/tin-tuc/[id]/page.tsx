import { requireAdminPermission } from "@/lib/admin-guard";
import { notFound, redirect } from "next/navigation";

import { PostEditorDetail } from "@/components/admin/post-editor-detail";
import { getAdminPostById, getTaxonomy } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPermission("posts.view");
  const { id } = await params;
  const [post, taxonomy] = await Promise.all([getAdminPostById(id), getTaxonomy()]);
  if (!post) notFound();
  if (post.type === "guide") redirect(`/admin/tai-nguyen/huong-dan/${post.id}`);
  return <main className="admin-editor-detail-page"><PostEditorDetail post={post} taxonomy={taxonomy} /></main>;
}
