// Ngôn ngữ của website. Tiếng Việt là bản gốc (nội dung nhập trong CMS); ngôn ngữ khác là bản dịch đè lên nội dung gốc, URL và slug giữ nguyên.
// Tệp không phụ thuộc gì (website và CMS cùng import được). `translationLocales` là danh mục các ngôn ngữ có thể dùng; ngôn ngữ nào đang bật trên website do người
// vận hành chọn ở CMS › Đa ngôn ngữ (lưu ở site_settings, xem translations.locale-setting.ts). Thêm ngôn ngữ mới vào danh mục: thêm một dòng ở đây
// (cờ ở apps/website/.../language-flag.tsx là tùy chọn, chưa có cờ thì hiện quả địa cầu). Chưa hỗ trợ ngôn ngữ viết từ phải sang trái (Ả Rập, Do Thái): giao diện website chưa đảo chiều.

export const defaultLocale = "vi" as const;

// name: tên ngôn ngữ viết bằng chính ngôn ngữ đó (hiện ở nút chọn ngôn ngữ của khách); label: tên tiếng Việt (hiện trong CMS);
// html: giá trị thuộc tính lang của <html>; openGraph: mã og:locale (ngôn ngữ_QUỐC GIA).
export const translationLocales = [
  { code: "en", name: "English", label: "Tiếng Anh", html: "en", openGraph: "en_US" },
  { code: "zh", name: "中文", label: "Tiếng Trung (giản thể)", html: "zh-Hans", openGraph: "zh_CN" },
  { code: "ja", name: "日本語", label: "Tiếng Nhật", html: "ja", openGraph: "ja_JP" },
  { code: "ko", name: "한국어", label: "Tiếng Hàn", html: "ko", openGraph: "ko_KR" },
  { code: "fr", name: "Français", label: "Tiếng Pháp", html: "fr", openGraph: "fr_FR" },
  { code: "de", name: "Deutsch", label: "Tiếng Đức", html: "de", openGraph: "de_DE" },
  { code: "es", name: "Español", label: "Tiếng Tây Ban Nha", html: "es", openGraph: "es_ES" },
  { code: "pt", name: "Português", label: "Tiếng Bồ Đào Nha", html: "pt", openGraph: "pt_BR" },
  { code: "it", name: "Italiano", label: "Tiếng Ý", html: "it", openGraph: "it_IT" },
  { code: "ru", name: "Русский", label: "Tiếng Nga", html: "ru", openGraph: "ru_RU" },
  { code: "th", name: "ไทย", label: "Tiếng Thái", html: "th", openGraph: "th_TH" },
  { code: "id", name: "Bahasa Indonesia", label: "Tiếng Indonesia", html: "id", openGraph: "id_ID" },
  { code: "ms", name: "Bahasa Melayu", label: "Tiếng Mã Lai", html: "ms", openGraph: "ms_MY" },
  { code: "km", name: "ខ្មែរ", label: "Tiếng Khmer", html: "km", openGraph: "km_KH" },
  { code: "lo", name: "ລາວ", label: "Tiếng Lào", html: "lo", openGraph: "lo_LA" },
  { code: "hi", name: "हिन्दी", label: "Tiếng Hindi", html: "hi", openGraph: "hi_IN" },
  { code: "tr", name: "Türkçe", label: "Tiếng Thổ Nhĩ Kỳ", html: "tr", openGraph: "tr_TR" },
  { code: "nl", name: "Nederlands", label: "Tiếng Hà Lan", html: "nl", openGraph: "nl_NL" },
  { code: "pl", name: "Polski", label: "Tiếng Ba Lan", html: "pl", openGraph: "pl_PL" },
] as const;

export type TranslationLocale = (typeof translationLocales)[number]["code"];
export type SiteLocale = typeof defaultLocale | TranslationLocale;

export const translationLocaleCodes = translationLocales.map((locale) => locale.code) as readonly TranslationLocale[];

/** Ngôn ngữ mặc định khi người vận hành chưa chọn gì (website đã chạy với tiếng Anh từ trước khi có lựa chọn này). */
export const defaultEnabledLocales: readonly TranslationLocale[] = ["en"];

export function isTranslationLocale(value: unknown): value is TranslationLocale {
  return typeof value === "string" && (translationLocaleCodes as readonly string[]).includes(value);
}

export function isSiteLocale(value: unknown): value is SiteLocale {
  return value === defaultLocale || isTranslationLocale(value);
}

/** Sắp mã ngôn ngữ theo thứ tự danh mục, bỏ mã trùng và mã không có trong danh mục. */
export function sortLocaleCodes(codes: readonly string[]): TranslationLocale[] {
  return translationLocaleCodes.filter((code) => codes.includes(code));
}

/** Thông tin một ngôn ngữ trong danh mục; undefined nếu mã không có trong danh mục. */
export function findTranslationLocale(code: string) {
  return translationLocales.find((locale) => locale.code === code);
}

/** Tên ngôn ngữ để hiện cho khách (tiếng Việt hiện "Tiếng Việt"); mã lạ trả lại chính mã. */
export function siteLocaleName(code: string) {
  return code === defaultLocale ? "Tiếng Việt" : findTranslationLocale(code)?.name ?? code;
}

/** Mã ngôn ngữ đầy đủ dùng cho Open Graph (og:locale) và schema.org. */
export const localeTags = {
  vi: { html: "vi", openGraph: "vi_VN" },
  ...Object.fromEntries(translationLocales.map((locale) => [locale.code, { html: locale.html, openGraph: locale.openGraph }])),
} as Record<SiteLocale, { html: string; openGraph: string }>;
