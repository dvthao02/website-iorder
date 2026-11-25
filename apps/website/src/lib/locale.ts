import { cookies } from "next/headers";

import { defaultLocale, isSiteLocale, type SiteLocale } from "@iorder/shared/server/translations/locales";

import { localeCookie } from "./locale-cookie";

/**
 * Ngôn ngữ của lượt xem này: cookie khách đã chọn, chưa chọn thì tiếng Việt (bản gốc). Công cụ tìm kiếm không gửi cookie nên luôn thấy
 * tiếng Việt; URL và slug không đổi theo ngôn ngữ.
 */
export async function getLocale(): Promise<SiteLocale> {
  const saved = (await cookies()).get(localeCookie)?.value;
  return isSiteLocale(saved) ? saved : defaultLocale;
}
