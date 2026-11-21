import { headers } from "next/headers";
import { cache } from "react";

import { getPublishingConfig } from "@/lib/backend";
import { resolvePublicOrigin, resolveWebsiteOrigin } from "@/lib/website-origin";

/**
 * Địa chỉ website cho yêu cầu hiện tại (quy tắc ở website-origin.ts). Chỉ dùng ở Server Component; Client Component lấy qua
 * `useWebsiteUrl()` / `usePublicSiteUrl()`. Cache theo yêu cầu để layout và các trang không hỏi Backend nhiều lần.
 * `origin`: nơi các nút "Xem website" mở tới. `publicOrigin`: địa chỉ khách thấy trên Google (bản xem trước Google).
 */
export const getWebsiteOrigins = cache(async () => {
  const [requestHeaders, config] = await Promise.all([headers(), getPublishingConfig()]);
  const origin = resolveWebsiteOrigin({
    requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    configuredSiteUrl: config.siteUrl,
    envOrigin: process.env.NEXT_PUBLIC_PUBLISH_WEB_URL,
  });
  return { origin, publicOrigin: resolvePublicOrigin(config.siteUrl, origin) };
});

export async function getWebsiteOrigin() {
  return (await getWebsiteOrigins()).origin;
}
