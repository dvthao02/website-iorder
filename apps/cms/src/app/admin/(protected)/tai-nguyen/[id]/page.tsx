import { requireAdminPermission } from "@/lib/admin-guard";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPermission("support_downloads.view");
  redirect(`/admin/tai-nguyen?edit=${encodeURIComponent((await params).id)}`);
}
