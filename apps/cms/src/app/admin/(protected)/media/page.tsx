import { MediaManager } from "@/components/admin/media-manager";
import { getAdminMedia } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  return <main className="mx-auto max-w-7xl p-5 md:p-8">
    <MediaManager initialAssets={await getAdminMedia()} />
  </main>;
}
