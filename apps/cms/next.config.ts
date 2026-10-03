import path from "node:path";
import { config as loadEnvironment } from "dotenv";
import type { NextConfig } from "next";

const workspaceRoot = path.join(__dirname, "../..");

// Local configuration stays in the repository-root .env. Docker/VPS values
// are already present in process.env and are not overridden here.
loadEnvironment({ path: path.join(workspaceRoot, ".env") });

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  turbopack: { root: workspaceRoot },
  async redirects() {
    return [
      { source: "/admin/trang", destination: "/admin/pages", permanent: true },
      { source: "/admin/phan-quyen", destination: "/admin/tai-khoan", permanent: true },
      { source: "/admin/cau-hinh/trang-thai-xuat-ban", destination: "/admin/seo/kiem-tra-xuat-ban", permanent: true },
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
