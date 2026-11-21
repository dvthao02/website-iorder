"use client";

import { SiteStatusMessage } from "@/components/site/site-status-message";

export default function PublicError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <SiteStatusMessage description="Website đang gặp sự cố tạm thời khi tải nội dung. Vui lòng thử lại sau ít phút." eyebrow="Tạm thời gián đoạn" kind="error" onRetry={() => retry()} title="Chưa tải được nội dung" />;
}
