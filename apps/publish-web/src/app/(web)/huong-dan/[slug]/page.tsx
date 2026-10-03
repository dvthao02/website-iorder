import { redirect } from "next/navigation";

export default async function GuideDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  redirect(`/ho-tro/cai-dat/${encodeURIComponent((await params).slug)}`);
}
