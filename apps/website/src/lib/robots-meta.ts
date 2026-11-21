import type { Metadata } from "next";

// Thẻ robots của mọi trang. Trang cho lập chỉ mục còn khai báo cho Googlebot được hiện ảnh lớn, đoạn trích dài và
// video xem trước không giới hạn: ảnh lớn ở Google Discover/Tìm kiếm tăng tỷ lệ nhấp; mặc định Google tự hạn chế khi thiếu khai báo này.
// Trang không cho lập chỉ mục (nháp, xem trước, tắt trong CMS) chỉ giữ index/follow, không thêm gì.
export function robotsDirectives(index: boolean, follow: boolean): NonNullable<Metadata["robots"]> {
  if (!index) return { index, follow };
  return { index, follow, googleBot: { index, follow, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } };
}
