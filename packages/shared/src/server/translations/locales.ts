// Ngôn ngữ của website. Tiếng Việt là bản gốc (nội dung nhập trong CMS); ngôn ngữ khác là bản dịch đè lên nội dung gốc, URL và slug giữ nguyên.
// Tệp không phụ thuộc gì (website và CMS cùng import được). Thêm ngôn ngữ mới: thêm một dòng vào `translationLocales`.

export const defaultLocale = "vi" as const;

export const translationLocales = [
  { code: "en", name: "English", label: "Tiếng Anh" },
] as const;

export type TranslationLocale = (typeof translationLocales)[number]["code"];
export type SiteLocale = typeof defaultLocale | TranslationLocale;

export const translationLocaleCodes = translationLocales.map((locale) => locale.code) as readonly TranslationLocale[];

export function isTranslationLocale(value: unknown): value is TranslationLocale {
  return typeof value === "string" && (translationLocaleCodes as readonly string[]).includes(value);
}

export function isSiteLocale(value: unknown): value is SiteLocale {
  return value === defaultLocale || isTranslationLocale(value);
}

/** Mã ngôn ngữ đầy đủ dùng cho Open Graph (og:locale) và schema.org. */
export const localeTags: Record<SiteLocale, { html: string; openGraph: string }> = {
  vi: { html: "vi", openGraph: "vi_VN" },
  en: { html: "en", openGraph: "en_US" },
};
