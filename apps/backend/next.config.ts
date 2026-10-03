import path from "node:path";
import { config as loadEnvironment } from "dotenv";
import type { NextConfig } from "next";

const workspaceRoot = path.join(__dirname, "../..");
loadEnvironment({ path: path.join(workspaceRoot, ".env") });

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  turbopack: { root: workspaceRoot },
};

export default nextConfig;
