// Bảng màu CMS mà người vận hành chọn ở "Giao diện CMS". Định nghĩa danh sách id một chỗ để cả giao diện chọn (client) lẫn trang
// đăng nhập (server, đọc cookie) dùng chung, không phải import giá trị từ một file "use client".
export const cmsColorThemeIds = ["iorder", "teal-mist", "indigo-soft", "emerald-light", "warm-sand", "slate-minimal", "purple-mist", "sky-ice", "mint-blue", "dark", "christmas"] as const;
export type CmsColorThemeId = (typeof cmsColorThemeIds)[number];

/**
 * Cookie ghi lại bảng màu đã chọn để trang đăng nhập (chưa đăng nhập, dựng ở server, không đọc được localStorage) biết bạn đã chọn gì:
 * chọn "christmas" thì trang đăng nhập là cảnh Giáng sinh, chọn bảng màu khác thì là trang đăng nhập thường. Không chứa gì nhạy cảm.
 */
export const colorThemeCookie = "iorder-cms-color-theme";

export function isCmsColorThemeId(value: string | null | undefined): value is CmsColorThemeId {
  return typeof value === "string" && (cmsColorThemeIds as readonly string[]).includes(value);
}
