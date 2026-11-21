"use client";

import "./globals.css";
import { SiteStatusMessage } from "@/components/site/site-status-message";

// Bắt lỗi ngay ở root layout (ví dụ Backend không phản hồi khi tải cấu hình chung).
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <html lang="vi"><body><SiteStatusMessage description="Website đang bảo trì hoặc gặp sự cố tạm thời. Vui lòng thử lại sau ít phút." eyebrow="Tạm thời gián đoạn" kind="error" onRetry={() => retry()} title="Website chưa sẵn sàng" /></body></html>;
}
