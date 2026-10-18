"use client";

import { SiteStatusMessage } from "@/components/site/site-status-message";

export default function PublicError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <SiteStatusMessage action={<button className="rounded-lg bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700" onClick={() => retry()} type="button">Thử lại</button>} description="Website đang gặp sự cố tạm thời khi tải nội dung. Vui lòng thử lại sau ít phút." eyebrow="Tạm thời gián đoạn" title="Chưa tải được nội dung" />;
}
