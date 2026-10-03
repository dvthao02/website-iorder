"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";

type CmsThemeId = "iorder" | "teal-mist" | "indigo-soft" | "emerald-light" | "warm-sand" | "slate-minimal" | "purple-mist" | "sky-ice" | "mint-blue" | "dark";

type CmsTheme = {
  id: CmsThemeId;
  name: string;
  description: string;
  font: string;
  colors: [string, string, string];
};

const storageKey = "iorder-cms-theme";
const themeChangeEvent = "iorder-cms-theme-change";
const defaultTheme: CmsThemeId = "iorder";

const themes: CmsTheme[] = [
  { id: "iorder", name: "iOrder Blue", description: "Giao diện mặc định, rõ ràng và quen thuộc.", font: "Inter", colors: ["#F7F9FC", "#0D5FC7", "#FFFFFF"] },
  { id: "teal-mist", name: "Teal Mist", description: "Sạch sẽ, hiện đại.", font: "Geist / Inter", colors: ["#F2FAF9", "#0F766E", "#FFFFFF"] },
  { id: "indigo-soft", name: "Indigo Soft", description: "Cảm giác công nghệ, cao cấp.", font: "Manrope / Inter", colors: ["#F5F3FF", "#4F46E5", "#FFFFFF"] },
  { id: "emerald-light", name: "Emerald Light", description: "Thân thiện và dễ nhìn.", font: "Inter", colors: ["#F4FBF7", "#047857", "#FFFFFF"] },
  { id: "warm-sand", name: "Warm Sand", description: "Ấm áp, premium và khác biệt.", font: "DM Sans / Manrope", colors: ["#FAF8F4", "#8B4A22", "#FFFFFF"] },
  { id: "slate-minimal", name: "Slate Minimal", description: "Tối giản, phù hợp doanh nghiệp.", font: "Geist", colors: ["#F6F7F9", "#334155", "#FFFFFF"] },
  { id: "purple-mist", name: "Purple Mist", description: "Hiện đại, hợp AI/SaaS.", font: "Plus Jakarta Sans", colors: ["#FAF7FF", "#7C3AED", "#FFFFFF"] },
  { id: "sky-ice", name: "Sky Ice", description: "Tươi sáng, phù hợp iOrder.", font: "Inter / Geist", colors: ["#F4FAFF", "#0369A1", "#FFFFFF"] },
  { id: "mint-blue", name: "Mint Blue", description: "Trẻ trung, giàu chất công nghệ.", font: "Manrope", colors: ["#F0FDFB", "#06758F", "#FFFFFF"] },
  { id: "dark", name: "Dark Mode", description: "Dịu mắt khi làm việc buổi tối.", font: "Inter", colors: ["#142033", "#67A9FF", "#1B2A3E"] },
];

type CmsThemeContextValue = {
  selectedTheme: CmsThemeId;
  selectTheme: (themeId: CmsThemeId) => void;
};

const CmsThemeContext = createContext<CmsThemeContextValue | null>(null);

function isThemeId(value: string | null): value is CmsThemeId {
  return themes.some((theme) => theme.id === value);
}

function readStoredTheme(): CmsThemeId {
  if (typeof window === "undefined") return defaultTheme;
  const savedTheme = window.localStorage.getItem(storageKey);
  return isThemeId(savedTheme) ? savedTheme : defaultTheme;
}

function subscribeToTheme(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(themeChangeEvent, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(themeChangeEvent, listener);
  };
}

function saveTheme(themeId: CmsThemeId) {
  document.documentElement.dataset.cmsTheme = themeId;
  window.localStorage.setItem(storageKey, themeId);
  window.dispatchEvent(new Event(themeChangeEvent));
}

export function CmsThemeProvider({ children }: { children: ReactNode }) {
  const selectedTheme = useSyncExternalStore(subscribeToTheme, readStoredTheme, () => defaultTheme);

  useEffect(() => {
    document.documentElement.dataset.cmsTheme = selectedTheme;
  }, [selectedTheme]);

  return <CmsThemeContext.Provider value={{ selectedTheme, selectTheme: saveTheme }}>{children}</CmsThemeContext.Provider>;
}

function useCmsTheme() {
  const value = useContext(CmsThemeContext);
  if (!value) throw new Error("Thiếu phạm vi giao diện CMS.");
  return value;
}

export function AdminThemeSettings() {
  const { selectedTheme, selectTheme } = useCmsTheme();

  return <section className="admin-theme-settings" aria-labelledby="cms-theme-settings-title">
    <header>
      <div>
        <p className="admin-theme-settings__eyebrow">Giao diện của bạn</p>
        <h3 id="cms-theme-settings-title">Chọn màu sắc phù hợp khi làm việc</h3>
        <p>Thay đổi chỉ áp dụng cho CMS trên trình duyệt này. Nội dung, dữ liệu và website public không bị ảnh hưởng.</p>
      </div>
      <span className="admin-theme-settings__current">Đang dùng: <strong>{themes.find((theme) => theme.id === selectedTheme)?.name}</strong></span>
    </header>

    <div className="admin-theme-settings__grid" aria-label="Các giao diện CMS">
      {themes.map((theme) => {
        const isSelected = theme.id === selectedTheme;
        return <button
          aria-pressed={isSelected}
          className={isSelected ? "admin-theme-option admin-theme-option--selected" : "admin-theme-option"}
          key={theme.id}
          onClick={() => selectTheme(theme.id)}
          type="button"
        >
          <span aria-hidden="true" className="admin-theme-option__preview" style={{ "--theme-base": theme.colors[0], "--theme-accent": theme.colors[1], "--theme-card": theme.colors[2] } as CSSProperties}>
            <i /><i /><i />
          </span>
          <span className="admin-theme-option__content">
            <strong>{theme.name}</strong>
            <small>{theme.description}</small>
            <em>{theme.font}</em>
          </span>
          {isSelected ? <b aria-label="Đang được chọn">✓</b> : null}
        </button>;
      })}
    </div>
  </section>;
}
