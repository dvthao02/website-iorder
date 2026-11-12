import { networkInterfaces } from "node:os";
import path from "node:path";
import { config as loadEnvironment } from "dotenv";
import type { NextConfig } from "next";

const workspaceRoot = path.join(__dirname, "../..");
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
};

export default nextConfig;
