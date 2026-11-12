// URL public là tiếng Việt không dấu (/tin-tuc, /gioi-thieu…), còn thư mục route trong mã nguồn là tiếng Anh (app/(web)/news…).
// `publicRewrites` ánh xạ URL tiếng Việt vào thư mục route; `englishPathRedirect` chuyển 301 URL tiếng Anh gõ nhầm về URL chuẩn
// để mỗi trang chỉ có một địa chỉ. Hai bảng dùng chung một danh sách để không lệch nhau.
export const routeFolders: ReadonlyArray<readonly [publicPath: string, folder: string]> = [
  ["/ho-tro/cai-dat", "/support/setup"],
  ["/ho-tro/huong-dan", "/support/guides"],
  ["/ho-tro/faq", "/support/faq"],
  ["/ho-tro/video", "/support/videos"],
  ["/ho-tro-tu-xa", "/support/remote"],
  ["/ho-tro", "/support"],
  ["/tin-tuc/chuyen-muc", "/news/category"],
  ["/tin-tuc/the", "/news/tag"],
  ["/tin-tuc", "/news"],
  ["/gioi-thieu", "/about"],
  ["/lien-he", "/contact"],
  ["/thiet-bi", "/equipment"],
  ["/chinh-sach-bao-mat", "/privacy-policy"],
  ["/dieu-khoan", "/terms"],
  ["/trang", "/pages"],
];

/** Dùng cho `rewrites()` của Next: URL tiếng Việt → thư mục route (kèm phần đường dẫn con). */
export function publicRewrites() {
  return routeFolders.flatMap(([publicPath, folder]) => [
    { source: publicPath, destination: folder },
    { source: `${publicPath}/:path*`, destination: `${folder}/:path*` },
  ]);
}

/** URL nội bộ (có thể kèm ?query hoặc #neo) đi qua bảng rewrites() ở trên — dùng để tắt tải trước của Link (xem site-link.tsx). */
export function isRewrittenPath(href: string) {
  if (!href.startsWith("/") || href.startsWith("//")) return false;
  const pathname = href.split(/[?#]/)[0];
  return routeFolders.some(([publicPath]) => pathname === publicPath || pathname.startsWith(`${publicPath}/`));
}

// URL cũ không còn trang riêng, chỉ chuyển hướng vĩnh viễn tới URL chuẩn hiện tại.
const retiredPaths: ReadonlyArray<readonly [string, string]> = [["/huong-dan", "/ho-tro/huong-dan"]];

/** URL tiếng Anh (tên thư mục) → URL tiếng Việt chuẩn; trả null nếu không phải. */
export function englishPathRedirect(pathname: string): string | null {
  for (const [from, to] of retiredPaths) {
    if (pathname === from) return to;
    if (pathname.startsWith(`${from}/`)) return `${to}${pathname.slice(from.length)}`;
  }
  for (const [publicPath, folder] of routeFolders) {
    if (pathname === folder) return publicPath;
    if (pathname.startsWith(`${folder}/`)) return `${publicPath}${pathname.slice(folder.length)}`;
  }
  // /support là gốc của các trang hỗ trợ; chỉ khi không khớp mục con nào ở trên.
  if (pathname === "/support") return "/ho-tro";
  if (pathname.startsWith("/support/")) return `/ho-tro${pathname.slice("/support".length)}`;
  return null;
}
