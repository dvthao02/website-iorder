// Địa chỉ màn hình CMS chứa nơi đang dùng một tệp, để thư viện media mở thẳng tới đó thay vì chỉ liệt kê tên.
// Hàm thuần, không đụng DB. Đường dẫn khớp các route ở apps/admin/src/app/admin/(protected) và `global-search.service.ts`.

export type MediaUsageTarget = {
  entityType: string;
  entityId: string;
  /** Khối trang: `entityId` là mã khối, màn hình soạn mở theo mã trang chứa khối. */
  pageId?: string | null;
  /** Loại bài viết (`guide` mở ở mục Hướng dẫn) hoặc loại catalog (`software` là Sản phẩm, `solution` là Giải pháp). */
  contentType?: string | null;
};

export function mediaUsageHref({ entityType, entityId, pageId, contentType }: MediaUsageTarget): string | undefined {
  switch (entityType) {
    case "page": return `/admin/pages/${entityId}`;
    case "page_block":
    case "page_block_content": return pageId ? `/admin/pages/${pageId}` : undefined;
    // /admin/news/<mã> tự chuyển bài hướng dẫn sang /admin/guides/<mã>, nên thiếu loại bài vẫn tới đúng chỗ.
    case "post":
    case "post_content": return contentType === "guide" ? `/admin/guides/${entityId}` : `/admin/news/${entityId}`;
    case "offering": return contentType === "software" ? `/admin/products/${entityId}` : contentType === "solution" ? `/admin/solutions/${entityId}` : undefined;
    case "equipment": return `/admin/equipment/${entityId}`;
    case "equipment_group": return "/admin/equipment?tab=groups";
    case "partner":
    case "testimonial": return "/admin/partners";
    case "site_profile": return "/admin/company-profile";
    case "support_download": return `/admin/resources/${entityId}`;
    case "site_setting": return "/admin/seo";
    case "user": return "/admin/users";
    case "author": return "/admin/authors";
    default: return undefined;
  }
}
