import { networkInterfaces } from "node:os";
import path from "node:path";
import { config as loadEnvironment } from "dotenv";
import type { NextConfig } from "next";

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

// Tiêu đề bảo mật của website. Khi chạy sau Caddy, các tiêu đề này do Caddyfile gửi; khi website được publish qua Cloudflare Tunnel (không có Caddy)
// thì chính ứng dụng phải gửi. Giá trị giữ y hệt Caddyfile để hai cách publish cho cùng kết quả.
// - HSTS 1 năm, cố ý không có includeSubDomains/preload: tên miền con khác của công ty có thể chưa chạy HTTPS và preload không thu hồi được.
// - Permissions-Policy tắt các API thiết bị mà website không dùng.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "X-Content-Type-Options", value: "nosniff" },
];

// Trang thường không được nhúng vào khung; referrer chỉ lộ origin khi sang tên miền khác. CSP nền chặn <object>/<embed> và đổi <base>; chưa có script-src
// vì CSP theo nonce buộc mọi trang render động (mất cache). Khung xem trước của CMS (/cms-preview) bị loại khỏi nhóm này: nó phải nhúng được vào CMS,
// còn frame-ancestors và Referrer-Policy của nó do src/proxy.ts đặt riêng.
const pageHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Content-Security-Policy", value: "base-uri 'self'; object-src 'none'" },
];

const nextConfig: NextConfig = {
  ...(allowedDevOrigins ? { allowedDevOrigins } : {}),
  output: "standalone",
  // Không lộ tên framework qua tiêu đề X-Powered-By.
  poweredByHeader: false,
  // Mặc định .next. NEXT_DIST_DIR cho phép chạy bản kiểm tra riêng (E2E với Backend mô phỏng) khi `next dev` đang chạy (cả hai dùng chung .next sẽ làm hỏng nhau).
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
    // Mặc định Next còn có mốc 3840 px (màn 4K): mã hóa AVIF 3840 px tốn CPU và bộ nhớ (container website giới hạn 768 MB) mà khách hiếm khi cần,
    // và mỗi mốc là một mục trong srcset của từng ảnh. Bỏ mốc 3840; 2048 vẫn đủ nét cho màn retina của laptop.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
  },
  // Nhóm `pageHeaders` loại /cms-preview bằng regex phủ định; Next so khớp theo đường dẫn khách gọi, trước khi proxy.ts rewrite.
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/:path((?!cms-preview$).*)", headers: pageHeaders },
    ];
  },
  // Only proxy what the public site uses from the browser. Admin APIs stay
  // reachable through the CMS host alone; server-side reads call BACKEND_URL.
  async rewrites() {
    return {
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
