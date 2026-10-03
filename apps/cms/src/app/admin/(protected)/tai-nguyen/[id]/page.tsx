import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/admin/tai-nguyen?edit=${encodeURIComponent((await params).id)}`);
}
