import type { ListingPageSlug } from "@iorder/shared/server/pages/pages.contract";

// Màn quản lý module tương ứng với từng trang danh sách: nút "Quay lại" của editor trang
// đưa người vận hành về đúng chỗ họ mở ra.
export const listingPageModuleHref: Record<ListingPageSlug, string> = {
  "listing-news": "/admin/news",
  "listing-equipment": "/admin/equipment",
  "listing-support": "/admin/resources",
  "listing-guides": "/admin/guides",
  "listing-software": "/admin/products?type=software",
  "listing-solution": "/admin/products?type=solution",
  "listing-service": "/admin/products?type=service",
};

// Tên module sở hữu trang danh sách, để giải thích "danh sách lấy từ đâu".
export const listingPageModuleLabel: Record<ListingPageSlug, string> = {
  "listing-news": "Bài viết & Tin tức",
  "listing-equipment": "Thiết bị",
  "listing-support": "Tệp cài đặt",
  "listing-guides": "Hướng dẫn sử dụng",
  "listing-software": "Sản phẩm & Dịch vụ",
  "listing-solution": "Sản phẩm & Dịch vụ",
  "listing-service": "Sản phẩm & Dịch vụ",
};

// Trang con của từng trang danh sách trên website và nơi sửa nội dung của chúng trong CMS:
// editor trang danh sách chỉ sửa phần đầu và bố cục, còn từng trang con lấy dữ liệu từ module tương ứng.
export const listingChildPages: Record<ListingPageSlug, ReadonlyArray<{ path: string; label: string; source: string; href: string }>> = {
  "listing-news": [
    { path: "/tin-tuc/<bài viết>", label: "Chi tiết bài viết", source: "Bài viết & Tin tức", href: "/admin/news" },
    { path: "/tin-tuc/chuyen-muc/<chuyên mục>", label: "Trang chuyên mục", source: "Tên và mô tả lấy từ Chuyên mục & Thẻ", href: "/admin/taxonomy" },
    { path: "/tin-tuc/the/<thẻ>", label: "Trang thẻ", source: "Tên lấy từ Chuyên mục & Thẻ", href: "/admin/taxonomy" },
  ],
  "listing-equipment": [{ path: "/thiet-bi/<thiết bị>", label: "Chi tiết thiết bị", source: "Thiết bị", href: "/admin/equipment" }],
  "listing-support": [],
  "listing-guides": [{ path: "/ho-tro/huong-dan/<hướng dẫn>", label: "Chi tiết hướng dẫn", source: "Hướng dẫn sử dụng", href: "/admin/guides" }],
  "listing-software": [{ path: "/phan-mem/<sản phẩm>", label: "Chi tiết sản phẩm", source: "Sản phẩm", href: "/admin/products?type=software" }],
  "listing-solution": [{ path: "/giai-phap/<giải pháp>", label: "Chi tiết giải pháp", source: "Giải pháp", href: "/admin/products?type=solution" }],
  "listing-service": [{ path: "/dich-vu/<dịch vụ>", label: "Chi tiết dịch vụ", source: "Dịch vụ", href: "/admin/products?type=service" }],
};
