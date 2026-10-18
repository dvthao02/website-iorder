import path from "node:path";
import { config as loadEnvironment } from "dotenv";
import type { NextConfig } from "next";

const workspaceRoot = path.join(__dirname, "../..");

// Next resolves env files from an app's directory in a workspace. Local
// credentials remain at the repository root, while production Docker values
// keep precedence because dotenv does not override existing environment vars.
loadEnvironment({ path: path.join(workspaceRoot, ".env") });

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
  turbopack: { root: workspaceRoot },
  // Only proxy what the public site uses from the browser. Admin APIs stay
  // reachable through the CMS host alone; server-side reads call BACKEND_URL.
  async rewrites() {
    return [
      { source: "/api/leads", destination: `${process.env.BACKEND_URL ?? "http://localhost:3002"}/api/leads` },
      { source: "/media/:path*", destination: `${process.env.BACKEND_URL ?? "http://localhost:3002"}/media/:path*` },
      // Local: chuyển script và sự kiện thống kê sang Umami. Production để Caddy chuyển tiếp
      // (giữ đúng X-Forwarded-For), nên image không đặt UMAMI_URL.
      ...(process.env.UMAMI_URL ? [
        { source: "/stats/script.js", destination: `${process.env.UMAMI_URL}/script.js` },
        { source: "/stats/api/send", destination: `${process.env.UMAMI_URL}/api/send` },
      ] : []),
    ];
  },
};

export default nextConfig;
