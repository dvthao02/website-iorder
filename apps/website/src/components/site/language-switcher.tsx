"use client";

import type { MouseEvent } from "react";

import { localeCookie, localeCookieString } from "../../lib/locale-cookie";
import type { SiteLocale } from "@iorder/shared/server/translations/locales";

import { useT } from "./messages-provider";

export type LanguageOption = { code: SiteLocale; short: string; name: string };

/**
 * Bấm đổi ngôn ngữ: ghi cookie ngay trong trình duyệt rồi tải lại đúng trang đang xem (như bấm F5), nên đổi liền không cần chuyển hướng qua
 * máy chủ, giữ nguyên cả tham số (?page=2…) lẫn vị trí cuộn. Chuột giữa, Ctrl/Cmd/Shift + bấm thì để trình duyệt mở liên kết ?lang như thường.
 * Trình duyệt chặn cookie thì cũng đi theo liên kết ?lang.
 */
export function chooseLanguage(event: MouseEvent<HTMLAnchorElement>, code: SiteLocale) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  document.cookie = localeCookieString(code, window.location.protocol === "https:");
  if (!document.cookie.split("; ").some((item) => item === `${localeCookie}=${code}`)) return;
  event.preventDefault();
  window.location.reload();
}

/**
 * Nút đổi ngôn ngữ ở đầu trang (chỉ hiện khi website có từ hai ngôn ngữ). Vẫn là liên kết thường `?lang=…` (không dùng Link của Next để không bị tải trước
 * rồi vô tình đổi ngôn ngữ; dùng được cả khi chưa chạy JavaScript và khi mở trong tab mới): proxy ghi cookie rồi chuyển về đúng URL không có ?lang,
 * nên slug và URL không đổi theo ngôn ngữ. `rel="nofollow"` để công cụ tìm kiếm không đi theo; chúng luôn thấy tiếng Việt.
 */
export function LanguageSwitcher({ current, options, pathname }: { current: SiteLocale; options: LanguageOption[]; pathname: string }) {
  const t = useT();
  if (options.length < 2) return null;
  return <div aria-label={t("language.label")} className="language-switcher" role="group">
    {options.map((option) => option.code === current
      ? <span aria-current="true" aria-label={option.name} className="language-switcher__item language-switcher__item--active" key={option.code} lang={option.code}>{option.short}</span>
      : <a aria-label={option.name} className="language-switcher__item" href={`${pathname}?lang=${option.code}`} hrefLang={option.code} key={option.code} lang={option.code} onClick={(event) => chooseLanguage(event, option.code)} rel="nofollow" title={option.name}>{option.short}</a>)}
  </div>;
}
