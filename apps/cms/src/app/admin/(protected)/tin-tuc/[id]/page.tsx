import { notFound, redirect } from "next/navigation";

import { PostEditorDetail } from "@/components/admin/post-editor-detail";
import { getAdminPostById } from "@/lib/backend";
import { getTaxonomy } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [post, taxonomy] = await Promise.all([getAdminPostById((await params).id), getTaxonomy()]);
  if (!post) notFound();
  if (post.type === "guide") redirect(`/admin/tai-nguyen/huong-dan/${post.id}`);
  return <main className="admin-editor-detail-page"><PostEditorDetail post={post} taxonomy={taxonomy} /></main>;
}
