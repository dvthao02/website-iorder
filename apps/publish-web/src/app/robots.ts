import type { MetadataRoute } from "next";
import { getPublishingConfig } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const config = await getPublishingConfig();
  return { rules: { userAgent: "*", allow: config.allowSearchIndexing ? "/" : "", disallow: config.allowSearchIndexing ? ["/admin/", "/api/"] : "/" }, sitemap: config.siteUrl ? new URL("/sitemap.xml", config.siteUrl).toString() : undefined };
}
