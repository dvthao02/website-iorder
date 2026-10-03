import { SupportDownloadManagerList } from "@/components/admin/support-download-manager-list";
import type { AdminSupportDownload } from "@iorder/core/server/support/support-downloads.contract";

type SupportCenterManagerProps = {
  downloads: AdminSupportDownload[];
  initialSelectedId?: string;
  startCreating?: boolean;
};

export function SupportCenterManager({ downloads, initialSelectedId, startCreating }: SupportCenterManagerProps) {
  return <SupportDownloadManagerList initialSelectedId={initialSelectedId} items={downloads} startCreating={startCreating} />;
}
