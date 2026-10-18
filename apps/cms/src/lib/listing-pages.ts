import type { ListingPageSlug } from "@iorder/core/server/pages/pages.contract";

// Màn quản lý module tương ứng với từng trang danh sách: nút "Quay lại" của editor trang
// đưa người vận hành về đúng chỗ họ mở ra.
export const listingPageModuleHref: Record<ListingPageSlug, string> = {
  "listing-news": "/admin/tin-tuc",
  "listing-equipment": "/admin/thiet-bi",
  "listing-support": "/admin/tai-nguyen",
  "listing-software": "/admin/san-pham",
  "listing-solution": "/admin/giai-phap",
  "listing-service": "/admin/dich-vu",
};

// Trang con của từng trang danh sách trên website và nơi sửa nội dung của chúng trong CMS:
// editor trang danh sách chỉ sửa phần đầu và bố cục, còn từng trang con lấy dữ liệu từ module tương ứng.
export const listingChildPages: Record<ListingPageSlug, ReadonlyArray<{ path: string; label: string; source: string; href: string }>> = {
  "listing-news": [
    { path: "/tin-tuc/<bài viết>", label: "Chi tiết bài viết", source: "Bài viết & Tin tức", href: "/admin/tin-tuc" },
    { path: "/tin-tuc/chuyen-muc/<chuyên mục>", label: "Trang chuyên mục", source: "Tên và mô tả lấy từ Chuyên mục & Thẻ", href: "/admin/phan-loai-bai-viet" },
    { path: "/tin-tuc/the/<thẻ>", label: "Trang thẻ", source: "Tên lấy từ Chuyên mục & Thẻ", href: "/admin/phan-loai-bai-viet" },
  ],
  "listing-equipment": [{ path: "/thiet-bi/<thiết bị>", label: "Chi tiết thiết bị", source: "Thiết bị", href: "/admin/thiet-bi" }],
  "listing-support": [{ path: "/ho-tro/cai-dat/<hướng dẫn>", label: "Chi tiết hướng dẫn", source: "Hỗ trợ cài đặt › Hướng dẫn", href: "/admin/tai-nguyen?tab=guides" }],
  "listing-software": [{ path: "/phan-mem/<sản phẩm>", label: "Chi tiết sản phẩm", source: "Sản phẩm", href: "/admin/san-pham" }],
  "listing-solution": [{ path: "/giai-phap/<giải pháp>", label: "Chi tiết giải pháp", source: "Giải pháp hạ tầng", href: "/admin/giai-phap" }],
  "listing-service": [{ path: "/dich-vu/<dịch vụ>", label: "Chi tiết dịch vụ", source: "Dịch vụ", href: "/admin/dich-vu" }],
};
