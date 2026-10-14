"use client";

import { Check, Palette, Type } from "lucide-react";
import { createContext, useContext, useEffect, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";

import { useAdminToast } from "./ui/admin-feedback";

type CmsColorThemeId = "iorder" | "teal-mist" | "indigo-soft" | "emerald-light" | "warm-sand" | "slate-minimal" | "purple-mist" | "sky-ice" | "mint-blue" | "dark";
type CmsFontId = "inter" | "manrope" | "plus-jakarta-sans" | "dm-sans";

type CmsColorTheme = { id: CmsColorThemeId; name: string; description: string; colors: [string, string, string] };
type CmsFont = { id: CmsFontId; name: string; description: string; family: string };

const colorStorageKey = "iorder-cms-color-theme";
const fontStorageKey = "iorder-cms-font";
const legacyThemeStorageKey = "iorder-cms-theme";
const themeChangeEvent = "iorder-cms-theme-change";
const defaultColorTheme: CmsColorThemeId = "iorder";
const defaultFont: CmsFontId = "inter";

const colorThemes: CmsColorTheme[] = [
  { id: "iorder", name: "iOrder Blue", description: "Rõ ràng, quen thuộc và phù hợp nhất với iOrder.", colors: ["#F7F9FC", "#0D5FC7", "#FFFFFF"] },
  { id: "teal-mist", name: "Teal Mist", description: "Sạch sẽ và cân bằng cho công việc hằng ngày.", colors: ["#F2FAF9", "#0F766E", "#FFFFFF"] },
  { id: "indigo-soft", name: "Indigo Soft", description: "Sắc tím nhẹ, tập trung và hiện đại.", colors: ["#F5F3FF", "#4F46E5", "#FFFFFF"] },
  { id: "emerald-light", name: "Emerald Light", description: "Thân thiện, dịu mắt và dễ đọc.", colors: ["#F4FBF7", "#047857", "#FFFFFF"] },
  { id: "warm-sand", name: "Warm Sand", description: "Gam ấm, phù hợp khi cần cảm giác nhẹ nhàng.", colors: ["#FAF8F4", "#8B4A22", "#FFFFFF"] },
  { id: "slate-minimal", name: "Slate Minimal", description: "Tối giản, trung tính và chuyên nghiệp.", colors: ["#F6F7F9", "#334155", "#FFFFFF"] },
  { id: "purple-mist", name: "Purple Mist", description: "Tím hiện đại cho không gian làm việc sáng tạo.", colors: ["#FAF7FF", "#7C3AED", "#FFFFFF"] },
  { id: "sky-ice", name: "Sky Ice", description: "Xanh sáng, thoáng và gần với nhận diện iOrder.", colors: ["#F4FAFF", "#0369A1", "#FFFFFF"] },
  { id: "mint-blue", name: "Mint Blue", description: "Tươi mát, rõ ràng và có độ tương phản tốt.", colors: ["#F0FDFB", "#06758F", "#FFFFFF"] },
  { id: "dark", name: "Chế độ tối", description: "Dịu mắt khi làm việc trong môi trường thiếu sáng.", colors: ["#142033", "#67A9FF", "#1B2A3E"] },
];

const fonts: CmsFont[] = [
  { id: "inter", name: "Inter", description: "Rõ nét, trung tính, dễ đọc trong biểu mẫu và bảng dữ liệu.", family: "var(--font-inter)" },
  { id: "manrope", name: "Manrope", description: "Mềm hơn, hiện đại, phù hợp không gian làm việc nhẹ nhàng.", family: "var(--font-manrope)" },
  { id: "plus-jakarta-sans", name: "Plus Jakarta Sans", description: "Cá tính và cân đối hơn cho giao diện sáng tạo.", family: "var(--font-plus-jakarta-sans)" },
  { id: "dm-sans", name: "DM Sans", description: "Ấm áp, thân thiện mà vẫn giữ độ rõ của CMS.", family: "var(--font-dm-sans)" },
];

const legacyThemeFonts: Record<CmsColorThemeId, CmsFontId> = {
  iorder: "inter", "teal-mist": "manrope", "indigo-soft": "plus-jakarta-sans", "emerald-light": "inter", "warm-sand": "dm-sans", "slate-minimal": "manrope", "purple-mist": "plus-jakarta-sans", "sky-ice": "inter", "mint-blue": "manrope", dark: "inter",
};

type CmsThemeContextValue = {
  selectedColorTheme: CmsColorThemeId;
  selectedFont: CmsFontId;
  selectColorTheme: (themeId: CmsColorThemeId) => void;
  selectFont: (fontId: CmsFontId) => void;
};

const CmsThemeContext = createContext<CmsThemeContextValue | null>(null);

function isColorThemeId(value: string | null): value is CmsColorThemeId { return colorThemes.some((theme) => theme.id === value); }
function isFontId(value: string | null): value is CmsFontId { return fonts.some((font) => font.id === value); }

function readStoredColorTheme(): CmsColorThemeId {
  if (typeof window === "undefined") return defaultColorTheme;
  const savedTheme = window.localStorage.getItem(colorStorageKey);
  if (isColorThemeId(savedTheme)) return savedTheme;
  const legacyTheme = window.localStorage.getItem(legacyThemeStorageKey);
  return isColorThemeId(legacyTheme) ? legacyTheme : defaultColorTheme;
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

function saveColorTheme(themeId: CmsColorThemeId) {
  document.documentElement.dataset.cmsTheme = themeId;
  window.localStorage.setItem(colorStorageKey, themeId);
  window.dispatchEvent(new Event(themeChangeEvent));
}

function saveFont(fontId: CmsFontId) {
  document.documentElement.dataset.cmsFont = fontId;
  window.localStorage.setItem(fontStorageKey, fontId);
  window.dispatchEvent(new Event(themeChangeEvent));
}

export function CmsThemeProvider({ children }: { children: ReactNode }) {
  const selectedColorTheme = useSyncExternalStore(subscribeToTheme, readStoredColorTheme, () => defaultColorTheme);
  const selectedFont = useSyncExternalStore(subscribeToTheme, readStoredFont, () => defaultFont);

  useEffect(() => { document.documentElement.dataset.cmsTheme = selectedColorTheme; }, [selectedColorTheme]);
  useEffect(() => { document.documentElement.dataset.cmsFont = selectedFont; }, [selectedFont]);

  return <CmsThemeContext.Provider value={{ selectedColorTheme, selectedFont, selectColorTheme: saveColorTheme, selectFont: saveFont }}>{children}</CmsThemeContext.Provider>;
}

function useCmsTheme() {
  const value = useContext(CmsThemeContext);
  if (!value) throw new Error("Thiếu phạm vi giao diện CMS.");
  return value;
}

export function AdminThemeSettings() {
  const { selectedColorTheme, selectedFont, selectColorTheme, selectFont } = useCmsTheme();
  const { show: showToast } = useAdminToast();
  const selectedColor = colorThemes.find((theme) => theme.id === selectedColorTheme) ?? colorThemes[0];
  const selectedFontOption = fonts.find((font) => font.id === selectedFont) ?? fonts[0];

  return <section className="admin-appearance" aria-labelledby="cms-theme-settings-title">
    <header className="admin-appearance__header"><div><span className="admin-appearance__icon"><Palette aria-hidden="true" size={18} /></span><div><p>Cài đặt</p><h1 id="cms-theme-settings-title">Giao diện CMS</h1><small>Chọn riêng bảng màu và font chữ; thay đổi áp dụng ngay trên trình duyệt này.</small></div></div><span className="admin-appearance__current"><Check aria-hidden="true" size={15} />{selectedColor.name} · {selectedFontOption.name}</span></header>
    <div className="admin-appearance__groups">
      <section className="admin-appearance__group" aria-labelledby="cms-color-settings-title"><header><div><Palette aria-hidden="true" size={17} /><div><h3 id="cms-color-settings-title">Bảng màu</h3><small>Chỉ thay màu nền, màu nhấn và trạng thái.</small></div></div><strong>{selectedColor.name}</strong></header><div aria-label="Các bảng màu CMS" className="admin-appearance__list">{colorThemes.map((theme) => { const isSelected = theme.id === selectedColorTheme; return <button aria-pressed={isSelected} className={isSelected ? "admin-appearance__theme admin-appearance__theme--selected" : "admin-appearance__theme"} key={theme.id} onClick={() => { if (isSelected) return; selectColorTheme(theme.id); showToast(`Đã áp dụng bảng màu ${theme.name}.`, "success"); }} style={{ "--theme-base": theme.colors[0], "--theme-accent": theme.colors[1], "--theme-card": theme.colors[2] } as CSSProperties} type="button"><span aria-hidden="true" className="admin-appearance__swatches"><i /><i /><i /></span><span className="admin-appearance__theme-copy"><strong>{theme.name}</strong><small>{theme.description}</small></span><span className="admin-appearance__theme-action">{isSelected ? <><Check aria-hidden="true" size={15} />Đang dùng</> : "Áp dụng"}</span></button>; })}</div></section>
      <section className="admin-appearance__group" aria-labelledby="cms-font-settings-title"><header><div><Type aria-hidden="true" size={17} /><div><h3 id="cms-font-settings-title">Font chữ</h3><small>Chỉ thay kiểu chữ trên toàn bộ CMS.</small></div></div><strong>{selectedFontOption.name}</strong></header><div aria-label="Các font chữ CMS" className="admin-appearance__list admin-appearance__font-list">{fonts.map((font) => { const isSelected = font.id === selectedFont; return <button aria-pressed={isSelected} className={isSelected ? "admin-appearance__theme admin-appearance__theme--selected" : "admin-appearance__theme"} key={font.id} onClick={() => { if (isSelected) return; selectFont(font.id); showToast(`Đã áp dụng font chữ ${font.name}.`, "success"); }} style={{ "--theme-font": font.family } as CSSProperties} type="button"><span aria-hidden="true" className="admin-appearance__font-sample">Aa</span><span className="admin-appearance__theme-copy"><strong>{font.name}</strong><small>{font.description}</small></span><span className="admin-appearance__theme-action">{isSelected ? <><Check aria-hidden="true" size={15} />Đang dùng</> : "Áp dụng"}</span></button>; })}</div></section>
    </div>
  </section>;
}
