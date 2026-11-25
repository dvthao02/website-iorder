import { getMediaById, getNavigation, getSiteLocales, getSiteProfile } from "@/lib/backend";
import { getLocale } from "@/lib/locale";
import { isSiteLocale, translationLocales, type SiteLocale } from "@iorder/shared/server/translations/locales";
import { descendantsOf } from "@/lib/navigation-tree";
import { SiteHeaderBar, type HeaderLink } from "./site-header-bar";

// Đầu trang dùng chung: dữ liệu (menu, nút, logo) lấy từ CMS; giao diện và tương tác ở SiteHeaderBar.
export async function SiteHeader() {
  const [items, ctas, profile, siteLocales, locale] = await Promise.all([getNavigation("header"), getNavigation("header_cta"), getSiteProfile(), getSiteLocales(), getLocale()]);
  // Nút đổi ngôn ngữ chỉ có khi website đã có bản dịch (Backend báo các ngôn ngữ đang có); tiếng Việt luôn đứng đầu.
  const languages = siteLocales.filter(isSiteLocale).map((code: SiteLocale) => ({ code, short: code.toUpperCase(), name: code === "vi" ? "Tiếng Việt" : translationLocales.find((item) => item.code === code)?.name ?? code }));
  const logo = profile?.logoMediaId ? await getMediaById(profile.logoMediaId) : null;
  const enabled = (items ?? []).filter((item) => item.isEnabled);
  // Cây menu 2 cấp (website hiển thị tốt nhất với 2 cấp; cấp sâu hơn gộp vào cấp 2).
  const links: HeaderLink[] = enabled.filter((item) => item.parentKey === null).map((item) => ({
    key: item.key, label: item.label, url: item.url, target: item.target,
    children: descendantsOf(enabled, item.key).map((child) => ({ key: child.key, label: child.label, url: child.url, target: child.target, children: [] })),
  }));
  const actions = (ctas ?? []).filter((item) => item.isEnabled && item.parentKey === null).slice(0, 2).map((item) => ({ key: item.key, label: item.label, url: item.url, target: item.target, children: [] }));
  return <SiteHeaderBar actions={actions} brand={profile?.companyName ?? "iOrder"} languages={languages.length > 1 ? { current: locale, options: languages } : null} links={links} logo={logo ? { url: logo.url, alt: logo.altText ?? profile?.companyName ?? "iOrder" } : null} />;
}
