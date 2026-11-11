import { networkInterfaces } from "node:os";
import path from "node:path";
import { config as loadEnvironment } from "dotenv";
import type { NextConfig } from "next";

const workspaceRoot = path.join(__dirname, "../..");

// Local configuration stays in the repository-root .env. Docker/VPS values
// are already present in process.env and are not overridden here.
loadEnvironment({ path: path.join(workspaceRoot, ".env") });

const allowedDevOrigins = process.env.NODE_ENV === "development"
  ? ["127.0.0.1", ...Object.values(networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .filter((address) => address.family === "IPv4" && !address.internal)
    .map((address) => address.address)]
  : undefined;

const nextConfig: NextConfig = {
  ...(allowedDevOrigins ? { allowedDevOrigins } : {}),
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
  turbopack: { root: workspaceRoot },
  async redirects() {
    return [
      // URL quản trị tiếng Việt cũ chuyển sang URL tiếng Anh (đường dẫn con `moi` → `new` xử lý ở từng trang).
      // Trang tạo mới `moi` phải khai báo trước các rule `:path*`, nếu không sẽ rơi vào route `[id]` với id "moi".
      { source: "/admin/tai-nguyen/huong-dan/moi", destination: "/admin/resources/guides/new", permanent: true },
      { source: "/admin/tai-nguyen/moi", destination: "/admin/resources/new", permanent: true },
      { source: "/admin/thiet-bi/moi", destination: "/admin/equipment/new", permanent: true },
      { source: "/admin/san-pham/moi", destination: "/admin/products/new", permanent: true },
      { source: "/admin/giai-phap/moi", destination: "/admin/solutions/new", permanent: true },
      { source: "/admin/dich-vu/moi", destination: "/admin/services/new", permanent: true },
      { source: "/admin/huong-dan/moi", destination: "/admin/guides/new", permanent: true },
      { source: "/admin/tin-tuc/moi", destination: "/admin/news/new", permanent: true },
      { source: "/admin/trang/moi", destination: "/admin/pages/new", permanent: true },
      { source: "/admin/tai-khoan-cua-toi/:path*", destination: "/admin/my-account/:path*", permanent: true },
      { source: "/admin/tai-khoan-cua-toi", destination: "/admin/my-account", permanent: true },
      { source: "/admin/tai-khoan/:path*", destination: "/admin/users/:path*", permanent: true },
      { source: "/admin/tai-khoan", destination: "/admin/users", permanent: true },
      { source: "/admin/tai-nguyen/huong-dan/:path*", destination: "/admin/resources/guides/:path*", permanent: true },
      { source: "/admin/tai-nguyen/huong-dan", destination: "/admin/resources/guides", permanent: true },
      { source: "/admin/tai-nguyen/:path*", destination: "/admin/resources/:path*", permanent: true },
      { source: "/admin/tai-nguyen", destination: "/admin/resources", permanent: true },
      { source: "/admin/thiet-bi/:path*", destination: "/admin/equipment/:path*", permanent: true },
      { source: "/admin/thiet-bi", destination: "/admin/equipment", permanent: true },
      { source: "/admin/khach-hang-tiem-nang/:path*", destination: "/admin/leads/:path*", permanent: true },
      { source: "/admin/khach-hang-tiem-nang", destination: "/admin/leads", permanent: true },
      { source: "/admin/phan-loai-bai-viet/:path*", destination: "/admin/taxonomy/:path*", permanent: true },
      { source: "/admin/phan-loai-bai-viet", destination: "/admin/taxonomy", permanent: true },
      { source: "/admin/phan-quyen/:path*", destination: "/admin/users?tab=roles", permanent: true },
      { source: "/admin/phan-quyen", destination: "/admin/users?tab=roles", permanent: true },
      { source: "/admin/lien-ket-ngoai/:path*", destination: "/admin/external-links/:path*", permanent: true },
      { source: "/admin/lien-ket-ngoai", destination: "/admin/external-links", permanent: true },
      { source: "/admin/thong-tin-doanh-nghiep/:path*", destination: "/admin/company-profile/:path*", permanent: true },
      { source: "/admin/thong-tin-doanh-nghiep", destination: "/admin/company-profile", permanent: true },
      { source: "/admin/giao-dien-cms/:path*", destination: "/admin/appearance/:path*", permanent: true },
      { source: "/admin/giao-dien-cms", destination: "/admin/appearance", permanent: true },
      { source: "/admin/khong-co-quyen/:path*", destination: "/admin/forbidden/:path*", permanent: true },
      { source: "/admin/khong-co-quyen", destination: "/admin/forbidden", permanent: true },
      { source: "/admin/chuyen-huong/:path*", destination: "/admin/redirects/:path*", permanent: true },
      { source: "/admin/chuyen-huong", destination: "/admin/redirects", permanent: true },
      { source: "/admin/doi-tac/:path*", destination: "/admin/partners/:path*", permanent: true },
      { source: "/admin/doi-tac", destination: "/admin/partners", permanent: true },
      { source: "/admin/nhat-ky/:path*", destination: "/admin/audit-log/:path*", permanent: true },
      { source: "/admin/nhat-ky", destination: "/admin/audit-log", permanent: true },
      { source: "/admin/san-pham/:path*", destination: "/admin/products/:path*", permanent: true },
      { source: "/admin/san-pham", destination: "/admin/products", permanent: true },
      { source: "/admin/giai-phap/theo-nganh/:path*", destination: "/admin/products?type=solution", permanent: true },
      { source: "/admin/giai-phap/theo-nganh", destination: "/admin/products?type=solution", permanent: true },
      { source: "/admin/giai-phap/:path*", destination: "/admin/solutions/:path*", permanent: true },
      { source: "/admin/giai-phap", destination: "/admin/solutions", permanent: true },
      { source: "/admin/dich-vu/:path*", destination: "/admin/services/:path*", permanent: true },
      { source: "/admin/dich-vu", destination: "/admin/services", permanent: true },
      { source: "/admin/huong-dan/:path*", destination: "/admin/guides/:path*", permanent: true },
      { source: "/admin/huong-dan", destination: "/admin/guides", permanent: true },
      { source: "/admin/tin-tuc/:path*", destination: "/admin/news/:path*", permanent: true },
      { source: "/admin/tin-tuc", destination: "/admin/news", permanent: true },
      { source: "/admin/trang-chu/:path*", destination: "/admin/homepage/:path*", permanent: true },
      { source: "/admin/trang-chu", destination: "/admin/homepage", permanent: true },
      { source: "/admin/trang/:path*", destination: "/admin/pages/:path*", permanent: true },
      { source: "/admin/trang", destination: "/admin/pages", permanent: true },
      { source: "/admin/thu-vien-media/:path*", destination: "/admin/media/:path*", permanent: true },
      { source: "/admin/thu-vien-media", destination: "/admin/media", permanent: true },
      { source: "/admin/thong-ke/:path*", destination: "/admin/analytics/:path*", permanent: true },
      { source: "/admin/thong-ke", destination: "/admin/analytics", permanent: true },
      { source: "/admin/dang-nhap/:path*", destination: "/admin/login/:path*", permanent: true },
      { source: "/admin/dang-nhap", destination: "/admin/login", permanent: true },
      { source: "/admin/noi-dung", destination: "/admin/products", permanent: true },
      { source: "/admin/cau-hinh", destination: "/admin/seo", permanent: true },
      { source: "/admin/cau-hinh/trang-thai-xuat-ban", destination: "/admin/seo/publish-check", permanent: true },
      { source: "/admin/tieu-de-catalog", destination: "/admin/products", permanent: true },
      { source: "/admin/tieu-de-trang", destination: "/admin/news", permanent: true },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${process.env.BACKEND_URL ?? "http://localhost:3002"}/api/:path*` },
      { source: "/media/:path*", destination: `${process.env.BACKEND_URL ?? "http://localhost:3002"}/media/:path*` },
    ];
  },
};

export default nextConfig;
