/**
 * Cookie ghi ngôn ngữ khách đã chọn (không chứa gì nhạy cảm). Tách khỏi locale.ts (dùng next/headers, chỉ chạy được ở máy chủ)
 * để cả proxy lẫn nút đổi ngôn ngữ trong trình duyệt dùng chung một tên, thời hạn và thuộc tính.
 */
export const localeCookie = "iorder_lang";
export const localeCookieMaxAgeSeconds = 60 * 60 * 24 * 365;

/** Chuỗi gán cho `document.cookie` khi khách bấm nút đổi ngôn ngữ (cùng thuộc tính với cookie proxy ghi khi mở liên kết ?lang=…). */
export function localeCookieString(code: string, secure: boolean) {
  return `${localeCookie}=${encodeURIComponent(code)}; Path=/; Max-Age=${localeCookieMaxAgeSeconds}; SameSite=Lax${secure ? "; Secure" : ""}`;
}
