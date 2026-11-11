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

const allowedDevOrigins = process.env.NODE_ENV === "development"
  ? Object.values(networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .filter((address) => address.family === "IPv4" && !address.internal)
    .map((address) => address.address)
  : undefined;

const nextConfig: NextConfig = {
  ...(allowedDevOrigins ? { allowedDevOrigins } : {}),
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
  turbopack: { root: workspaceRoot },
  // Only proxy what the public site uses from the browser. Admin APIs stay
  // reachable through the CMS host alone; server-side reads call BACKEND_URL.
  async rewrites() {
    return {
      // URL public là tiếng Việt không dấu; thư mục route trong mã nguồn là tiếng Anh.
      beforeFiles: publicRewrites(),
      afterFiles: [
        { source: "/api/leads", destination: `${process.env.BACKEND_URL ?? "http://localhost:3002"}/api/leads` },
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
