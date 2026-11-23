// URL public là tiếng Anh và trùng tên thư mục route (app/(web)/news → /news, app/(web)/privacy-policy → /privacy-policy), nên website không cần rewrites().
// Địa chỉ tiếng Việt từng là địa chỉ chuẩn (/tin-tuc, /gioi-thieu…) có thể đã được Google lập chỉ mục hoặc nằm trong liên kết bên ngoài,
// nên được chuyển 301 về địa chỉ tiếng Anh: `legacyPathRedirect`. Thêm route public mới thì chỉ cần thêm thư mục; thêm một dòng ở `legacyPaths`
// khi một địa chỉ cũ cần chuyển hướng.
// File nằm ở packages/shared để CMS cũng biết các chuyển hướng "có sẵn trong mã" này: một chuyển hướng tự tạo trong CMS
// không được tạo vòng lặp với chúng (xem redirect-cycle.ts). Website (proxy.ts) dùng trực tiếp.
// Mục cụ thể phải đứng trước mục chung (/ho-tro/faq trước /ho-tro), vì chỉ mục khớp đầu tiên được áp dụng.
export const legacyPaths: ReadonlyArray<readonly [legacy: string, current: string]> = [
  ["/ho-tro/cai-dat", "/support/setup"],
  ["/ho-tro/huong-dan", "/support/guides"],
  ["/ho-tro/faq", "/support/faq"],
  ["/ho-tro/video", "/support/videos"],
  ["/ho-tro-tu-xa", "/support/remote"],
  ["/ho-tro", "/support"],
  ["/tin-tuc/chuyen-muc", "/news/category"],
  ["/tin-tuc/the", "/news/tag"],
  ["/tin-tuc", "/news"],
  ["/tac-gia", "/author"],
  ["/gioi-thieu", "/about"],
  ["/lien-he", "/contact"],
  ["/thiet-bi", "/equipment"],
  ["/chinh-sach-bao-mat", "/privacy-policy"],
  ["/dieu-khoan", "/terms-of-use"],
  ["/terms", "/terms-of-use"],
  ["/trang", "/pages"],
  ["/phan-mem", "/software"],
  ["/giai-phap", "/solutions"],
  ["/dich-vu", "/services"],
  // Trang riêng đã gộp vào mục Hướng dẫn.
  ["/huong-dan", "/support/guides"],
];

/** URL cũ (tiếng Việt, hoặc tên cũ như /terms) → URL tiếng Anh chuẩn, giữ phần đường dẫn con; trả null nếu không phải. */
export function legacyPathRedirect(pathname: string): string | null {
  for (const [legacy, current] of legacyPaths) {
    if (pathname === legacy) return current;
    if (pathname.startsWith(`${legacy}/`)) return `${current}${pathname.slice(legacy.length)}`;
  }
  return null;
}

/**
 * Đường dẫn viết thường: Next khớp route không phân biệt hoa thường nên /NEWS phục vụ cùng nội dung với /news (hai địa chỉ cho một trang).
 * Chỉ đổi chữ cái, giữ nguyên chuỗi mã hóa phần trăm (%C3%A1) để không chuyển hướng thừa.
 */
export function lowercasePathname(pathname: string): string {
  return pathname.replace(/%[0-9a-f]{2}|[A-Z]/gi, (part) => (part.startsWith("%") ? part : part.toLowerCase()));
}

/**
 * Chuyển hướng 301 mà website tự áp dụng sau bảng chuyển hướng của CMS (xem apps/website/src/proxy.ts):
 * URL tiếng Việt cũ → URL tiếng Anh chuẩn, URL viết hoa → chữ thường. Trả null nếu đường dẫn đã chuẩn.
 * Viết hoa rồi mới áp bảng nên /TIN-TUC chỉ cần một bước chuyển hướng.
 */
export function builtInRedirect(pathname: string): string | null {
  const lowered = lowercasePathname(pathname);
  return legacyPathRedirect(lowered) ?? (lowered !== pathname ? lowered : null);
}

/** Pathname (không query/fragment) của một đường dẫn nội bộ; null nếu không phân tích được. */
export function pathnameOf(path: string): string | null {
  try { return new URL(path, "https://redirect.invalid").pathname; } catch { return null; }
}

/**
 * Chuyển hướng của CMS từ `pathname` sang `destinationPath` có quay về chính `pathname` qua chuyển hướng có sẵn không?
 * Ví dụ /privacy-policy → /chinh-sach-bao-mat, mà /chinh-sach-bao-mat lại được website chuyển về /privacy-policy: trình duyệt lặp vô hạn.
 * Website dùng hàm này để bỏ qua dòng chuyển hướng hỏng (dữ liệu cũ đã lưu trước khi CMS kiểm tra) thay vì làm hỏng cả trang.
 */
export function redirectLoopsBack(pathname: string, destinationPath: string): boolean {
  const destination = pathnameOf(destinationPath);
  return destination !== null && builtInRedirect(destination) === pathname;
}
