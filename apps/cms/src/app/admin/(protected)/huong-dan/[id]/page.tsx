import { redirect } from "next/navigation";

export default async function GuideDetailPage({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/admin/tai-nguyen/huong-dan/${encodeURIComponent((await params).id)}`);
}
