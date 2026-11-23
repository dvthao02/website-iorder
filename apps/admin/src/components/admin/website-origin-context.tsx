"use client";

import React, { createContext, useCallback, useContext, type ReactNode } from "react";

import { publishedPublicUrl } from "../../lib/published-public-url";
import { websiteUrl } from "../../lib/website-origin";

// Địa chỉ website do máy chủ CMS chọn theo nơi đang mở CMS (localhost, IP LAN, tên miền thật) và "Địa chỉ website" ở Cài đặt.
// Không có Provider (test, màn dựng riêng) thì quay về cách cũ: biến môi trường hoặc localhost:3000.
type WebsiteOrigins = { origin: string; publicOrigin: string };
const WebsiteOriginContext = createContext<WebsiteOrigins | null>(null);

export function WebsiteOriginProvider({ origin, publicOrigin, children }: WebsiteOrigins & { children: ReactNode }) {
  const value = { origin, publicOrigin };
  return <WebsiteOriginContext.Provider value={value}>{children}</WebsiteOriginContext.Provider>;
}

/** Hàm ghép đường dẫn công khai ("/news/bai") thành URL đầy đủ của website, dùng cho mọi liên kết "Xem trên website". */
export function useWebsiteUrl() {
  const origins = useContext(WebsiteOriginContext);
  const origin = origins?.origin;
  return useCallback((path: string) => origin ? websiteUrl(origin, path) : publishedPublicUrl(path), [origin]);
}

/** Như `useWebsiteUrl` nhưng theo địa chỉ khách thấy trên Google (Địa chỉ website ở Cài đặt): dùng cho bản xem trước Google, không dùng để mở trang. */
export function usePublicSiteUrl() {
  const origins = useContext(WebsiteOriginContext);
  const publicOrigin = origins?.publicOrigin;
  return useCallback((path: string) => publicOrigin ? websiteUrl(publicOrigin, path) : publishedPublicUrl(path), [publicOrigin]);
}
