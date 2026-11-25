"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";

import { localeCookie, localeCookieString } from "../../lib/locale-cookie";
import type { SiteLocale } from "@iorder/shared/server/translations/locales";

import { LanguageFlag } from "./language-flag";
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
 * Chọn ngôn ngữ ở đầu trang (chỉ hiện khi website có từ hai ngôn ngữ): nút hiện cờ và mã của ngôn ngữ đang xem, bấm mở danh sách thả xuống có cờ và tên
 * từng ngôn ngữ. Dùng <details> nên mở/đóng được cả khi chưa chạy JavaScript; JavaScript chỉ thêm đóng khi bấm ra ngoài hoặc nhấn Esc. Mỗi ngôn ngữ vẫn là
 * liên kết thường `?lang=…` (không dùng Link của Next để không bị tải trước rồi vô tình đổi ngôn ngữ; dùng được cả khi mở trong tab mới): proxy ghi cookie
 * rồi chuyển về đúng URL không có ?lang, nên slug và URL không đổi theo ngôn ngữ. `rel="nofollow"` để công cụ tìm kiếm không đi theo; chúng luôn thấy tiếng Việt.
 */
export function LanguageSwitcher({ current, options, pathname }: { current: SiteLocale; options: LanguageOption[]; pathname: string }) {
  const t = useT();
  const menu = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => { if (menu.current) menu.current.open = false; };
    const onPointerDown = (event: PointerEvent) => { if (menu.current && !menu.current.contains(event.target as Node)) close(); };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      menu.current?.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  if (options.length < 2) return null;
  const active = options.find((option) => option.code === current) ?? options[0];
  return <details className="language-menu" onToggle={(event) => setOpen(event.currentTarget.open)} ref={menu}>
    <summary aria-label={`${t("language.label")}: ${active.name}`} className="language-menu__button">
      <LanguageFlag code={active.code} />
      <span className="language-menu__code" lang={active.code}>{active.short}</span>
      <ChevronDown aria-hidden="true" className="language-menu__chevron" size={16} strokeWidth={2.2} />
    </summary>
    <ul aria-label={t("language.label")} className="language-menu__list">
      {options.map((option) => {
        const selected = option.code === current;
        return <li key={option.code}>
          <a
            aria-current={selected ? "true" : undefined}
            className={selected ? "language-menu__item language-menu__item--active" : "language-menu__item"}
            href={`${pathname}?lang=${option.code}`}
            hrefLang={option.code}
            lang={option.code}
            onClick={(event) => {
              // Đang xem ngôn ngữ này rồi thì chỉ đóng danh sách, không tải lại trang.
              if (selected) { event.preventDefault(); if (menu.current) menu.current.open = false; return; }
              chooseLanguage(event, option.code);
            }}
            rel="nofollow"
          >
            <LanguageFlag code={option.code} />
            <span className="language-menu__name">{option.name}</span>
            {selected ? <Check aria-hidden="true" className="language-menu__check" size={16} strokeWidth={2.4} /> : null}
          </a>
        </li>;
      })}
    </ul>
  </details>;
}
