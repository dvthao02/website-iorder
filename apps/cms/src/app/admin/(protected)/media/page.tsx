import { MediaManager } from "@/components/admin/media-manager";
import { getAdminMediaPage } from "@/lib/backend";
import { mediaListQuerySchema } from "@iorder/core/server/media/media.contract";

export const dynamic = "force-dynamic";

export default async function MediaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const parsed = mediaListQuerySchema.safeParse({ page: params.page, type: params.type, query: params.query, pageSize: 25 });
  const query = parsed.success ? parsed.data : mediaListQuerySchema.parse({});
  return <main className="mx-auto max-w-7xl p-5 md:p-8">
    <MediaManager initialPage={await getAdminMediaPage(query)} initialQuery={query} />
  </main>;
}
