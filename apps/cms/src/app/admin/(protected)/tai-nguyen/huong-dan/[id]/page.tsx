import { notFound } from "next/navigation";

import { PostEditorDetail } from "@/components/admin/post-editor-detail";
import { getAdminPostById } from "@/lib/backend";
import { getTaxonomy } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function SupportGuideDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [post, taxonomy] = await Promise.all([getAdminPostById((await params).id), getTaxonomy()]);
  if (!post || post.type !== "guide") notFound();

  return <main className="admin-editor-detail-page"><PostEditorDetail backHref="/admin/tai-nguyen?tab=guides" contentLabel="bài hướng dẫn" contentType="guide" post={post} taxonomy={taxonomy} /></main>;
}
