import { isCmsColorThemeId } from "./cms-theme";

export type LoginTheme = "christmas" | "default";

const themes: ReadonlySet<string> = new Set(["christmas", "default"]);

/** Mùa Giáng sinh của trang đăng nhập CMS: từ 15/11 đến hết 10/01 năm sau, tính theo giờ Việt Nam (UTC+7). */
export function isChristmasSeason(now: Date): boolean {
  const vietnam = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const month = vietnam.getUTCMonth() + 1;
  const day = vietnam.getUTCDate();
  return (month === 11 && day >= 15) || month === 12 || (month === 1 && day <= 10);
}

/**
 * Chọn giao diện trang đăng nhập. Thứ tự ưu tiên:
 * 1. tham số `?theme=` (xem thử) và 2. biến môi trường `CMS_LOGIN_THEME` (ép cho cả hệ thống); giá trị lạ bị bỏ qua;
 * 3. bảng màu người dùng đã chọn ở "Giao diện CMS" (cookie): "christmas" thì bật cảnh Giáng sinh, bảng màu khác thì trang thường;
 * 4. chưa chọn gì thì tự bật trong mùa Giáng sinh.
 */
export function resolveLoginTheme({ query, env, cookie, now }: { query?: string; env?: string; cookie?: string; now: Date }): LoginTheme {
  for (const choice of [query, env]) if (choice && themes.has(choice)) return choice as LoginTheme;
  if (isCmsColorThemeId(cookie)) return cookie === "christmas" ? "christmas" : "default";
  return isChristmasSeason(now) ? "christmas" : "default";
}
