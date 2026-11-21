"use client";

import { usePathname } from "next/navigation";

/**
 * Thanh báo đang xem bản nháp (chỉ người có liên kết từ CMS thấy). Không tự thêm thẻ robots: ở chế độ xem trước metadata của layout và trang
 * đã phát noindex/nofollow (robotsDirectives với cờ preview); thêm ở đây làm trang có hai thẻ robots trùng nhau.
 */
export function PreviewBanner() {
  const pathname = usePathname();
  return <form action="/api/preview/exit" className="preview-banner" method="post" role="status">
    <span><strong>Đang xem bản nháp.</strong> Nội dung này chưa công khai và chỉ hiện với liên kết xem trước.</span>
    <input name="path" type="hidden" value={pathname} />
    <button type="submit">Thoát xem trước</button>
  </form>;
}
