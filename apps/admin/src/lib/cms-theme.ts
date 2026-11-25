// Bảng màu CMS mà người vận hành chọn ở "Giao diện CMS". Định nghĩa danh sách id một chỗ để cả giao diện chọn (client) lẫn trang
// đăng nhập (server, đọc cookie) dùng chung, không phải import giá trị từ một file "use client".
export const cmsColorThemeIds = ["iorder", "teal-mist", "indigo-soft", "emerald-light", "warm-sand", "slate-minimal", "purple-mist", "sky-ice", "mint-blue", "dark", "christmas"] as const;
export type CmsColorThemeId = (typeof cmsColorThemeIds)[number];

/**
 * Cookie ghi lại bảng màu đã chọn để trang đăng nhập (chưa đăng nhập, dựng ở server, không đọc được localStorage) biết bạn đã chọn gì:
 * chọn "christmas" thì trang đăng nhập là cảnh Giáng sinh, chọn bảng màu khác thì là trang đăng nhập thường. Không chứa gì nhạy cảm.
 * Giá trị luôn là một bảng màu thật (với "Theo hệ thống" là bảng màu đang được áp dụng: sáng hay tối).
 */
export const colorThemeCookie = "iorder-cms-color-theme";

/** Khóa localStorage lưu lựa chọn bảng màu của trình duyệt này, và khóa cũ (trước khi tách bảng màu khỏi font) vẫn được đọc. */
export const colorThemeStorageKey = "iorder-cms-color-theme";
export const legacyThemeStorageKey = "iorder-cms-theme";

export function isCmsColorThemeId(value: string | null | undefined): value is CmsColorThemeId {
  return typeof value === "string" && (cmsColorThemeIds as readonly string[]).includes(value);
}

/**
 * "Theo hệ thống": lựa chọn chứ không phải một bảng màu riêng (không có token màu riêng). CMS dùng bảng màu tối khi thiết bị đang ở chế độ tối
 * (prefers-color-scheme: dark), ngược lại dùng bảng màu sáng mặc định, và tự đổi theo khi thiết bị đổi (ví dụ tự tối vào buổi tối).
 */
export const systemColorTheme = "system";
export type CmsColorThemePreference = CmsColorThemeId | typeof systemColorTheme;
export const systemLightColorTheme: CmsColorThemeId = "iorder";
export const systemDarkColorTheme: CmsColorThemeId = "dark";

export function isCmsColorThemePreference(value: string | null | undefined): value is CmsColorThemePreference {
  return value === systemColorTheme || isCmsColorThemeId(value);
}

/** Bảng màu thật sự áp dụng cho một lựa chọn, tùy thiết bị đang ở chế độ tối hay không. */
export function resolveColorTheme(preference: CmsColorThemePreference, prefersDark: boolean): CmsColorThemeId {
  if (preference !== systemColorTheme) return preference;
  return prefersDark ? systemDarkColorTheme : systemLightColorTheme;
}

/**
 * Đoạn script chạy ngay khi trang CMS vừa tải, trước khi vẽ, để đặt bảng màu đúng (nhất là "Theo hệ thống" ở thiết bị tối) mà không nháy
 * giao diện sáng rồi mới đổi. Cùng quy tắc với `resolveColorTheme` và cùng danh sách id; giá trị lạ thì bỏ qua (giữ mặc định).
 */
export function cmsThemeBootScript(): string {
  return `(function(){try{var s=localStorage,v=s.getItem(${JSON.stringify(colorThemeStorageKey)})||s.getItem(${JSON.stringify(legacyThemeStorageKey)});`
    + `if(v===${JSON.stringify(systemColorTheme)})v=matchMedia("(prefers-color-scheme: dark)").matches?${JSON.stringify(systemDarkColorTheme)}:${JSON.stringify(systemLightColorTheme)};`
    + `if(${JSON.stringify(cmsColorThemeIds)}.indexOf(v)>-1)document.documentElement.dataset.cmsTheme=v}catch(e){}})();`;
}
