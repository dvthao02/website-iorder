"use client";

import { Check } from "lucide-react";
import { createContext, useContext, useEffect, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";

import { colorThemeCookie, colorThemeStorageKey, isCmsColorThemeId, isCmsColorThemePreference, legacyThemeStorageKey, resolveColorTheme, systemColorTheme, type CmsColorThemeId, type CmsColorThemePreference } from "@/lib/cms-theme";

import { useAdminToast } from "./ui/admin-feedback";
import { AdminHelpTip } from "./ui/admin-help-tip";
import { AdminPageBarHelp } from "./ui/admin-page-bar";

type CmsFontId = "inter" | "manrope" | "plus-jakarta-sans" | "dm-sans";

// colors: [nền trang, màu nhấn, nền thẻ]; nav, top: màu thanh bên và thanh trên (dùng cho ô xem trước, giữ khớp với --cms-nav-bg và --cms-topbar-bg ở tokens.css).
type CmsColorTheme = { id: CmsColorThemePreference; name: string; description: string; colors: [string, string, string]; nav: string; top: string };
type CmsFont = { id: CmsFontId; name: string; description: string; family: string };

const fontStorageKey = "iorder-cms-font";
const themeChangeEvent = "iorder-cms-theme-change";
const defaultColorTheme: CmsColorThemePreference = "iorder";
const prefersDarkQuery = "(prefers-color-scheme: dark)";
const defaultFont: CmsFontId = "inter";

const colorThemes: CmsColorTheme[] = [
  { id: "system", name: "Theo hệ thống", description: "Tự chuyển giữa iOrder Blue (sáng) và Chế độ tối theo cài đặt của thiết bị, kể cả khi thiết bị tự đổi theo giờ.", colors: ["#F7F9FC", "#67A9FF", "#142033"], nav: "#0C336D", top: "#1B2430" },
  { id: "iorder", name: "iOrder Blue", description: "Cổ điển: thanh bên trắng, xanh iOrder rõ ràng và quen thuộc.", colors: ["#F7F9FC", "#0D5FC7", "#FFFFFF"], nav: "#0C336D", top: "#E4EDF9" },
  { id: "teal-mist", name: "Teal Mist", description: "Thanh bên xanh ngọc đậm, góc bo lớn, đổ bóng mềm.", colors: ["#F2FAF9", "#0F766E", "#FFFFFF"], nav: "#0E3B38", top: "#D3EBE6" },
  { id: "indigo-soft", name: "Indigo Soft", description: "Thanh bên tím oải hương, nút chính chuyển sắc chàm - tím.", colors: ["#F5F3FF", "#4F46E5", "#FFFFFF"], nav: "#29237F", top: "#E8E5FB" },
  { id: "emerald-light", name: "Emerald Light", description: "Phẳng và vuông vức, đường xanh lá mảnh dưới thanh trên.", colors: ["#F4FBF7", "#047857", "#FFFFFF"], nav: "#093C2D", top: "#DFF0E7" },
  { id: "warm-sand", name: "Warm Sand", description: "Thanh bên màu cát, tiêu đề có chân như trang giấy.", colors: ["#FAF8F4", "#8B4A22", "#FFFFFF"], nav: "#432B1B", top: "#ECDFCD" },
  { id: "slate-minimal", name: "Slate Minimal", description: "Thanh bên than chì, vuông vức, gọn và tối giản.", colors: ["#F6F7F9", "#334155", "#FFFFFF"], nav: "#1B2330", top: "#E1E6ED" },
  { id: "purple-mist", name: "Purple Mist", description: "Thanh bên tím đậm chuyển sắc, nút tím - hồng, bo góc lớn.", colors: ["#FAF7FF", "#7C3AED", "#FFFFFF"], nav: "#361575", top: "#EBE3FB" },
  { id: "sky-ice", name: "Sky Ice", description: "Thanh bên xanh băng nhạt, thẻ nổi nhẹ, dải sáng đầu trang.", colors: ["#F4FAFF", "#0369A1", "#FFFFFF"], nav: "#073A5E", top: "#D9ECF8" },
  { id: "mint-blue", name: "Mint Blue", description: "Mục điều hướng dạng viên thuốc, nút chuyển sắc xanh biển - ngọc.", colors: ["#F0FDFB", "#06758F", "#FFFFFF"], nav: "#0A4350", top: "#D9F0EE" },
  { id: "dark", name: "Chế độ tối", description: "Dịu mắt khi làm việc trong môi trường thiếu sáng.", colors: ["#142033", "#67A9FF", "#1B2A3E"], nav: "#0B0F14", top: "#1B2430" },
  { id: "christmas", name: "Giáng sinh", description: "Xanh thông trên nền kem ấm, dây đèn nhấp nháy ở thanh đầu trang và mũ ông già Noel trên logo. Bật luôn trang đăng nhập Giáng sinh; chọn bảng màu khác để quay về trang đăng nhập thường.", colors: ["#F8F4EE", "#17724A", "#C62833"], nav: "#0F3826", top: "#F3EADB" },
];

const fonts: CmsFont[] = [
  { id: "inter", name: "Inter", description: "Rõ nét, trung tính, dễ đọc trong biểu mẫu và bảng dữ liệu.", family: "var(--font-inter)" },
  { id: "manrope", name: "Manrope", description: "Mềm hơn, hiện đại, phù hợp không gian làm việc nhẹ nhàng.", family: "var(--font-manrope)" },
  { id: "plus-jakarta-sans", name: "Plus Jakarta Sans", description: "Cá tính và cân đối hơn cho giao diện sáng tạo.", family: "var(--font-plus-jakarta-sans)" },
  { id: "dm-sans", name: "DM Sans", description: "Ấm áp, thân thiện mà vẫn giữ độ rõ của CMS.", family: "var(--font-dm-sans)" },
];

const legacyThemeFonts: Record<CmsColorThemeId, CmsFontId> = {
  iorder: "inter", "teal-mist": "manrope", "indigo-soft": "plus-jakarta-sans", "emerald-light": "inter", "warm-sand": "dm-sans", "slate-minimal": "manrope", "purple-mist": "plus-jakarta-sans", "sky-ice": "inter", "mint-blue": "manrope", dark: "inter", christmas: "inter",
};

type CmsThemeContextValue = {
  /** Điều người dùng đã chọn (có thể là "Theo hệ thống"). */
  selectedColorTheme: CmsColorThemePreference;
  /** Bảng màu thật sự đang áp dụng (với "Theo hệ thống" là sáng hoặc tối tùy thiết bị). */
  activeColorTheme: CmsColorThemeId;
  selectedFont: CmsFontId;
  selectColorTheme: (themeId: CmsColorThemePreference) => void;
  selectFont: (fontId: CmsFontId) => void;
};

const CmsThemeContext = createContext<CmsThemeContextValue | null>(null);

function isColorThemeId(value: string | null): value is CmsColorThemeId { return isCmsColorThemeId(value); }
function isFontId(value: string | null): value is CmsFontId { return fonts.some((font) => font.id === value); }

// Lựa chọn bảng màu người dùng đã chọn thật sự (null khi chưa từng chọn, lúc đó dùng mặc định).
function readExplicitColorTheme(): CmsColorThemePreference | null {
  if (typeof window === "undefined") return null;
  const savedTheme = window.localStorage.getItem(colorThemeStorageKey);
  if (isCmsColorThemePreference(savedTheme)) return savedTheme;
  const legacyTheme = window.localStorage.getItem(legacyThemeStorageKey);
  return isColorThemeId(legacyTheme) ? legacyTheme : null;
}

function readStoredColorTheme(): CmsColorThemePreference {
  return readExplicitColorTheme() ?? defaultColorTheme;
}

// Ghi cookie để trang đăng nhập (dựng ở server) biết bảng màu đã chọn; xem lib/cms-theme.ts.
function writeThemeCookie(themeId: CmsColorThemeId) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${colorThemeCookie}=${themeId}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

function readStoredFont(): CmsFontId {
  if (typeof window === "undefined") return defaultFont;
  const savedFont = window.localStorage.getItem(fontStorageKey);
  if (isFontId(savedFont)) return savedFont;
  const legacyTheme = window.localStorage.getItem(legacyThemeStorageKey);
  return isColorThemeId(legacyTheme) ? legacyThemeFonts[legacyTheme] : defaultFont;
}

function subscribeToTheme(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(themeChangeEvent, listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(themeChangeEvent, listener); };
}

// Thiết bị đang ở chế độ tối? Dùng cho lựa chọn "Theo hệ thống"; đổi ở hệ điều hành thì CMS đổi theo ngay, không cần tải lại.
function readPrefersDark() { return window.matchMedia(prefersDarkQuery).matches; }
function subscribeToPrefersDark(listener: () => void) {
  const media = window.matchMedia(prefersDarkQuery);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

function saveColorTheme(preference: CmsColorThemePreference) {
  const themeId = resolveColorTheme(preference, readPrefersDark());
  document.documentElement.dataset.cmsTheme = themeId;
  window.localStorage.setItem(colorThemeStorageKey, preference);
  writeThemeCookie(themeId);
  window.dispatchEvent(new Event(themeChangeEvent));
}

function saveFont(fontId: CmsFontId) {
  document.documentElement.dataset.cmsFont = fontId;
  window.localStorage.setItem(fontStorageKey, fontId);
  window.dispatchEvent(new Event(themeChangeEvent));
}

export function CmsThemeProvider({ children }: { children: ReactNode }) {
  const selectedColorTheme = useSyncExternalStore(subscribeToTheme, readStoredColorTheme, () => defaultColorTheme);
  const prefersDark = useSyncExternalStore(subscribeToPrefersDark, readPrefersDark, () => false);
  const activeColorTheme = resolveColorTheme(selectedColorTheme, prefersDark);
  const selectedFont = useSyncExternalStore(subscribeToTheme, readStoredFont, () => defaultFont);

  useEffect(() => { document.documentElement.dataset.cmsTheme = activeColorTheme; }, [activeColorTheme]);
  // Trình duyệt đã chọn bảng màu từ trước khi có cookie: ghi bù một lần để trang đăng nhập cũng theo lựa chọn đó.
  useEffect(() => { if (readExplicitColorTheme()) writeThemeCookie(activeColorTheme); }, [activeColorTheme]);
  useEffect(() => { document.documentElement.dataset.cmsFont = selectedFont; }, [selectedFont]);

  return <CmsThemeContext.Provider value={{ selectedColorTheme, activeColorTheme, selectedFont, selectColorTheme: saveColorTheme, selectFont: saveFont }}>{children}</CmsThemeContext.Provider>;
}

function useCmsTheme() {
  const value = useContext(CmsThemeContext);
  if (!value) throw new Error("Thiếu phạm vi giao diện CMS.");
  return value;
}

/** Bảng màu CMS đang dùng (để các phần trang trí theo theme biết có cần hiện không). Chỉ dùng bên trong CmsThemeProvider. */
export function useCmsColorTheme(): CmsColorThemeId {
  return useCmsTheme().activeColorTheme;
}

export function AdminThemeSettings() {
  const { selectedColorTheme, activeColorTheme, selectedFont, selectColorTheme, selectFont } = useCmsTheme();
  const { show: showToast } = useAdminToast();
  const selectedColor = colorThemes.find((theme) => theme.id === selectedColorTheme) ?? colorThemes[0];
  // "Theo hệ thống" nói rõ đang là sáng hay tối để người dùng thấy lựa chọn có tác dụng.
  const selectedColorName = selectedColorTheme === systemColorTheme ? `${selectedColor.name} (đang ${activeColorTheme === "dark" ? "tối" : "sáng"})` : selectedColor.name;
  const selectedFontOption = fonts.find((font) => font.id === selectedFont) ?? fonts[0];

  return <section className="admin-appearance" aria-labelledby="cms-theme-settings-title">
    <header className="admin-appearance__header"><div><h1 className="sr-only" id="cms-theme-settings-title">Giao diện CMS</h1><AdminPageBarHelp>Chọn riêng bảng màu và font chữ; thay đổi áp dụng ngay trên trình duyệt này.</AdminPageBarHelp></div><span className="admin-appearance__current"><Check aria-hidden="true" size={15} />{selectedColorName} · {selectedFontOption.name}</span></header>
    <div className="admin-appearance__groups">
      <section className="admin-appearance__group" aria-labelledby="cms-color-settings-title"><header><div className="admin-label-row"><h3 id="cms-color-settings-title">Bảng màu</h3><AdminHelpTip label="Giải thích: Bảng màu">Mỗi bảng màu có phong cách riêng: màu thanh bên, thanh trên, nút chính, độ bo góc và đổ bóng. “Theo hệ thống” tự dùng bảng màu tối khi thiết bị đang ở chế độ tối và bảng màu sáng iOrder Blue khi không. Riêng “Giáng sinh” còn thêm dây đèn, mũ ông già Noel và bật trang đăng nhập Giáng sinh trên trình duyệt này.</AdminHelpTip></div><strong>{selectedColorName}</strong></header><div aria-label="Các bảng màu CMS" className="admin-appearance__list">{colorThemes.map((theme) => { const isSelected = theme.id === selectedColorTheme; return <button aria-pressed={isSelected} className={isSelected ? "admin-appearance__theme admin-appearance__theme--selected" : "admin-appearance__theme"} key={theme.id} onClick={() => { if (isSelected) return; selectColorTheme(theme.id); showToast(`Đã áp dụng bảng màu ${theme.name}.`, "success"); }} style={{ "--theme-base": theme.colors[0], "--theme-accent": theme.colors[1], "--theme-card": theme.colors[2], "--theme-nav": theme.nav, "--theme-top": theme.top } as CSSProperties} title={theme.description} type="button"><span aria-hidden="true" className="admin-appearance__swatches"><i /><i /><i /></span><span className="admin-appearance__theme-copy"><strong>{theme.name}</strong></span><span className="admin-appearance__theme-action">{isSelected ? <><Check aria-hidden="true" size={15} />Đang dùng</> : "Áp dụng"}</span></button>; })}</div></section>
      <section className="admin-appearance__group" aria-labelledby="cms-font-settings-title"><header><div className="admin-label-row"><h3 id="cms-font-settings-title">Font chữ</h3><AdminHelpTip label="Giải thích: Font chữ">Chỉ thay kiểu chữ trên toàn bộ CMS.</AdminHelpTip></div><strong>{selectedFontOption.name}</strong></header><div aria-label="Các font chữ CMS" className="admin-appearance__list admin-appearance__font-list">{fonts.map((font) => { const isSelected = font.id === selectedFont; return <button aria-pressed={isSelected} className={isSelected ? "admin-appearance__theme admin-appearance__theme--selected" : "admin-appearance__theme"} key={font.id} onClick={() => { if (isSelected) return; selectFont(font.id); showToast(`Đã áp dụng font chữ ${font.name}.`, "success"); }} style={{ "--theme-font": font.family } as CSSProperties} title={font.description} type="button"><span aria-hidden="true" className="admin-appearance__font-sample">Aa</span><span className="admin-appearance__theme-copy"><strong>{font.name}</strong></span><span className="admin-appearance__theme-action">{isSelected ? <><Check aria-hidden="true" size={15} />Đang dùng</> : "Áp dụng"}</span></button>; })}</div></section>
    </div>
  </section>;
}
