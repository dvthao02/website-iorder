"use client";

import { usePathname } from "next/navigation";

/** Thanh báo đang xem bản nháp (chỉ người có liên kết từ CMS thấy); kèm noindex để không bị lập chỉ mục. */
export function PreviewBanner() {
  const pathname = usePathname();
  return <>
    <meta content="noindex, nofollow" name="robots" />
    <form action="/api/preview/exit" className="preview-banner" method="post" role="status">
      <span><strong>Đang xem bản nháp.</strong> Nội dung này chưa công khai và chỉ hiện với liên kết xem trước.</span>
      <input name="path" type="hidden" value={pathname} />
      <button type="submit">Thoát xem trước</button>
    </form>
  </>;
}
