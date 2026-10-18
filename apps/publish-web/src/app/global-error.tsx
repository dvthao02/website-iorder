"use client";

import "./globals.css";
import { SiteStatusMessage } from "@/components/site/site-status-message";

// Bắt lỗi ngay ở root layout (ví dụ Backend không phản hồi khi tải cấu hình chung).
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <html lang="vi"><body><SiteStatusMessage action={<button className="rounded-lg bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700" onClick={() => retry()} type="button">Thử lại</button>} description="Website đang bảo trì hoặc gặp sự cố tạm thời. Vui lòng thử lại sau ít phút." eyebrow="Tạm thời gián đoạn" title="Website chưa sẵn sàng" /></body></html>;
}
