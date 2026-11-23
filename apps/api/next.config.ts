import { networkInterfaces } from "node:os";
import path from "node:path";
import { config as loadEnvironment } from "dotenv";
import type { NextConfig } from "next";

const workspaceRoot = path.join(__dirname, "../..");
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
  // Cho phép build kiểm tra riêng khi phiên dev đang dùng .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  outputFileTracingRoot: workspaceRoot,
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
  turbopack: { root: workspaceRoot },
};

export default nextConfig;
