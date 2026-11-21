import { networkInterfaces } from "node:os";
import path from "node:path";
import { config as loadEnvironment } from "dotenv";
import type { NextConfig } from "next";

import { publicRewrites } from "./src/lib/legacy-paths";

const workspaceRoot = path.join(__dirname, "../..");

// Next resolves env files from an app's directory in a workspace. Local
// credentials remain at the repository root, while production Docker values
// keep precedence because dotenv does not override existing environment vars.
loadEnvironment({ path: path.join(workspaceRoot, ".env") });

// Địa chỉ khác được phép nạp tài nguyên của máy chủ dev (tên miền, IP công cộng, tunnel): khai báo trong ALLOWED_DEV_ORIGINS, cách nhau bằng dấu phẩy
// (chỉ tên máy, ví dụ "iorder.vn,*.trycloudflare.com"; dán cả URL cũng được). Không có thì trang hiện nhưng không bấm được vì trình duyệt không nạp được JavaScript.
const extraDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((entry) => entry.trim().replace(/^https?:\/\//i, "").replace(/[/:].*$/, ""))
  .filter(Boolean);

const allowedDevOrigins = process.env.NODE_ENV === "development"
  ? [...Object.values(networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .filter((address) => address.family === "IPv4" && !address.internal)
    .map((address) => address.address), ...extraDevOrigins]
  : undefined;

const nextConfig: NextConfig = {
  ...(allowedDevOrigins ? { allowedDevOrigins } : {}),
  output: "standalone",
  // Không lộ tên framework qua tiêu đề X-Powered-By.
  poweredByHeader: false,
  outputFileTracingRoot: workspaceRoot,
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
  turbopack: { root: workspaceRoot },
  // Ảnh trong thư viện media có tên theo UUID và nội dung không đổi sau khi tải lên, nên bản đã tối ưu giữ được lâu.
  // AVIF được ưu tiên cho trình duyệt hỗ trợ, WebP dự phòng. Lần đầu mỗi kích thước tốn CPU để mã hóa, các lần sau lấy từ bộ nhớ đệm.
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 31,
    qualities: [75],
  },
  // Only proxy what the public site uses from the browser. Admin APIs stay
  // reachable through the CMS host alone; server-side reads call BACKEND_URL.
  async rewrites() {
    return {
      // URL public là tiếng Việt không dấu; thư mục route trong mã nguồn là tiếng Anh.
      beforeFiles: publicRewrites(),
      afterFiles: [
        { source: "/api/v1/leads", destination: `${process.env.BACKEND_URL ?? "http://localhost:3002"}/api/v1/leads` },
        { source: "/media/:path*", destination: `${process.env.BACKEND_URL ?? "http://localhost:3002"}/media/:path*` },
        // Local: chuyển script và sự kiện thống kê sang Umami. Production để Caddy chuyển tiếp
        // (giữ đúng X-Forwarded-For), nên image không đặt UMAMI_URL.
        ...(process.env.UMAMI_URL ? [
          { source: "/stats/script.js", destination: `${process.env.UMAMI_URL}/script.js` },
          { source: "/stats/api/send", destination: `${process.env.UMAMI_URL}/api/send` },
        ] : []),
      ],
    };
  },
};

export default nextConfig;
