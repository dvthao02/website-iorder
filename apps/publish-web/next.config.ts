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
  turbopack: { root: workspaceRoot },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${process.env.BACKEND_URL ?? "http://localhost:3002"}/api/:path*` },
      { source: "/media/:path*", destination: `${process.env.BACKEND_URL ?? "http://localhost:3002"}/media/:path*` },
    ];
  },
};

export default nextConfig;
