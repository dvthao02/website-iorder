import { requireAdminPermission } from "@/lib/admin-guard";
import { MediaManager } from "@/components/admin/media-manager";
import { getAdminMediaPage } from "@/lib/backend";
import { mediaListQuerySchema } from "@iorder/core/server/media/media.contract";

export const dynamic = "force-dynamic";

export default async function MediaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPermission("media.view");
  const params = await searchParams;
  const parsed = mediaListQuerySchema.safeParse({ page: params.page, type: params.type, query: params.query, pageSize: 25 });
  const query = parsed.success ? parsed.data : mediaListQuerySchema.parse({});
  return <main className="admin-page">
    <MediaManager initialPage={await getAdminMediaPage(query)} initialQuery={query} />
  </main>;
}
