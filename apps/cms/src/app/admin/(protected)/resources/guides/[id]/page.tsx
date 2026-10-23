import { redirect } from "next/navigation";

// Đường dẫn cũ khi hướng dẫn còn là một tab của "Hỗ trợ cài đặt".
export default async function LegacyGuideDetailPage({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/admin/guides/${encodeURIComponent((await params).id)}`);
}
