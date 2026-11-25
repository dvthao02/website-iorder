import assert from "node:assert/strict";
import test from "node:test";
import React, { type MouseEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { localeCookie, localeCookieString } from "../../lib/locale-cookie";
import { LanguageFlag } from "./language-flag";
import { chooseLanguage, LanguageSwitcher } from "./language-switcher";

// Thành phần dùng JSX kiểu cũ (không tự import React) nên test cần React toàn cục.
(globalThis as { React?: typeof React }).React = React;

const options = [{ code: "vi", short: "VI", name: "Tiếng Việt" }, { code: "en", short: "EN", name: "English" }] as const;

test("Chọn ngôn ngữ: nút hiện cờ và mã ngôn ngữ đang xem; danh sách thả xuống có cờ và tên từng ngôn ngữ, ngôn ngữ khác là liên kết ?lang= giữ nguyên đường dẫn", () => {
  const html = renderToStaticMarkup(<LanguageSwitcher current="vi" options={[...options]} pathname="/support/guides" />);
  // Nút: cờ + mã ngôn ngữ đang xem, có tên đầy đủ cho trình đọc màn hình.
  assert.match(html, /<details class="language-menu">/);
  assert.match(html, /<summary aria-label="Ngôn ngữ: Tiếng Việt" class="language-menu__button"><svg[^>]*class="language-flag"[\s\S]*?<span class="language-menu__code" lang="vi">VI<\/span>/);
  // Danh sách: mỗi ngôn ngữ một dòng có cờ và tên; đang xem thì đánh dấu, ngôn ngữ khác là liên kết thường.
  assert.match(html, /<ul aria-label="Ngôn ngữ" class="language-menu__list">/);
  assert.match(html, /<a aria-current="true" class="language-menu__item language-menu__item--active" href="\/support\/guides\?lang=vi"[^>]*>[\s\S]*?Tiếng Việt<\/span>/);
  assert.match(html, /<a class="language-menu__item" href="\/support\/guides\?lang=en"[^>]*>[\s\S]*?<svg[^>]*class="language-flag"[\s\S]*?English<\/span>/);
  assert.equal((html.match(/class="language-flag"/g) ?? []).length, 3, "một cờ ở nút và một cờ ở mỗi dòng của danh sách");
  // Liên kết thường, không để công cụ tìm kiếm đi theo (chúng luôn thấy tiếng Việt) và có mã ngôn ngữ cho trình đọc màn hình.
  assert.match(html, /rel="nofollow"/);
  assert.match(html, /hrefLang="en"/);
  // Cờ chỉ để trang trí: mọi cờ đều ẩn với trình đọc màn hình.
  assert.doesNotMatch(html, /<svg(?![^>]*aria-hidden)[^>]*class="language-flag"/);
});

test("Chọn ngôn ngữ: ngôn ngữ thêm sau (Nhật, Pháp, Trung, Hàn…) có cờ riêng, ngôn ngữ chưa có cờ (Hindi) hiện quả địa cầu", () => {
  const many = [options[0], { code: "ja", short: "JA", name: "日本語" }, { code: "fr", short: "FR", name: "Français" }, { code: "zh", short: "ZH", name: "中文" }, { code: "ko", short: "KO", name: "한국어" }, { code: "hi", short: "HI", name: "हिन्दी" }] as unknown as Parameters<typeof LanguageSwitcher>[0]["options"];
  const html = renderToStaticMarkup(<LanguageSwitcher current="ja" options={many} pathname="/" />);
  assert.equal((html.match(/class="language-flag"/g) ?? []).length, 1 + 5, "năm dòng có cờ riêng (Việt, Nhật, Pháp, Trung, Hàn) cộng cờ ở nút");
  assert.equal((html.match(/language-flag language-flag--globe/g) ?? []).length, 1, "chỉ Hindi hiện quả địa cầu");
  assert.match(html, /hrefLang="ja"/);
  assert.ok(html.includes('<span class="language-menu__name">日本語</span>'));
});

test("Cờ: cờ Trung Quốc có đủ năm sao (một lớn, bốn nhỏ) nên không bị nhầm với cờ Việt Nam chỉ có một sao ở giữa", () => {
  const stars = (code: string) => (renderToStaticMarkup(<LanguageFlag code={code} />).match(/<polygon/g) ?? []).length;
  assert.equal(stars("zh"), 5);
  assert.equal(stars("vi"), 1);
  assert.notEqual(renderToStaticMarkup(<LanguageFlag code="zh" />), renderToStaticMarkup(<LanguageFlag code="vi" />));
  // Sao lớn nằm góc trên bên trái (x nhỏ hơn nửa chiều rộng, y nhỏ hơn nửa chiều cao); sao Việt Nam nằm giữa lá cờ.
  const first = (code: string) => (renderToStaticMarkup(<LanguageFlag code={code} />).match(/<polygon[^>]*points="([^"]+)"/)?.[1] ?? "").split(" ").map((point) => point.split(",").map(Number));
  const center = (points: number[][]) => [points.reduce((sum, point) => sum + point[0], 0) / points.length, points.reduce((sum, point) => sum + point[1], 0) / points.length];
  const [zhX, zhY] = center(first("zh"));
  assert.ok(zhX < 10 && zhY < 10, `sao lớn cờ Trung Quốc ở góc trên trái (${zhX}, ${zhY})`);
  const [viX] = center(first("vi"));
  assert.ok(Math.abs(viX - 15) < 1, "sao cờ Việt Nam ở giữa");
});

test("Chọn ngôn ngữ: đang xem tiếng Anh thì nút hiện EN và danh sách có liên kết về tiếng Việt; ngôn ngữ chưa có cờ hiện quả địa cầu; chỉ có một ngôn ngữ thì không vẽ gì", () => {
  const html = renderToStaticMarkup(<LanguageSwitcher current="en" options={[...options]} pathname="/" />);
  assert.match(html, /<span class="language-menu__code" lang="en">EN<\/span>/);
  assert.match(html, /href="\/\?lang=vi"/);
  assert.match(html, /aria-label="Ngôn ngữ: English"/);
  const unknown = [options[0], { code: "xx", short: "XX", name: "Lạ" }] as unknown as Parameters<typeof LanguageSwitcher>[0]["options"];
  assert.match(renderToStaticMarkup(<LanguageSwitcher current="vi" options={unknown} pathname="/" />), /language-flag language-flag--globe/);
  assert.equal(renderToStaticMarkup(<LanguageSwitcher current="vi" options={[options[0]]} pathname="/" />), "");
});

test("Cookie ngôn ngữ ghi từ trình duyệt: cùng tên, đường dẫn gốc, thời hạn một năm; chỉ thêm Secure khi trang chạy bằng https", () => {
  assert.equal(localeCookie, "iorder_lang");
  assert.equal(localeCookieString("en", false), "iorder_lang=en; Path=/; Max-Age=31536000; SameSite=Lax");
  assert.equal(localeCookieString("en", true), "iorder_lang=en; Path=/; Max-Age=31536000; SameSite=Lax; Secure");
});

type FakeEvent = { altKey: boolean; button: number; ctrlKey: boolean; defaultPrevented: boolean; metaKey: boolean; preventDefault: () => void; shiftKey: boolean };

/** Chạy onClick của liên kết EN trong một trình duyệt giả: ghi lại cookie được gán và số lần tải lại. */
function click(overrides: Partial<FakeEvent> = {}, cookieJar: { accepts: boolean } = { accepts: true }) {
  const written: string[] = [];
  let reloads = 0;
  let prevented = false;
  const jar = new Map<string, string>();
  const fakeWindow = { location: { protocol: "http:", reload: () => { reloads += 1; } } };
  const fakeDocument = {
    get cookie() { return [...jar].map(([name, value]) => `${name}=${value}`).join("; "); },
    set cookie(value: string) { written.push(value); if (cookieJar.accepts) { const [pair] = value.split(";"); const [name, ...rest] = pair.split("="); jar.set(name, rest.join("=")); } },
  };
  const globals = globalThis as unknown as { document?: unknown; window?: unknown };
  const saved = { document: globals.document, window: globals.window };
  globals.document = fakeDocument;
  globals.window = fakeWindow;
  try {
    chooseLanguage({ altKey: false, button: 0, ctrlKey: false, defaultPrevented: false, metaKey: false, preventDefault: () => { prevented = true; }, shiftKey: false, ...overrides } as unknown as MouseEvent<HTMLAnchorElement>, "en");
  } finally {
    globals.document = saved.document;
    globals.window = saved.window;
  }
  return { prevented, reloads, written };
}

test("Bấm EN: ghi cookie rồi tải lại đúng trang đang xem (không chuyển hướng qua máy chủ)", () => {
  const result = click();
  assert.deepEqual(result.written, ["iorder_lang=en; Path=/; Max-Age=31536000; SameSite=Lax"]);
  assert.equal(result.reloads, 1);
  assert.equal(result.prevented, true);
});

test("Bấm EN kèm Ctrl/Cmd/Shift/Alt hoặc chuột giữa thì giữ hành vi mở liên kết của trình duyệt; trình duyệt chặn cookie thì đi theo liên kết ?lang", () => {
  for (const overrides of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { defaultPrevented: true }]) {
    const result = click(overrides);
    assert.deepEqual({ prevented: result.prevented, reloads: result.reloads, written: result.written }, { prevented: false, reloads: 0, written: [] }, JSON.stringify(overrides));
  }
  const blocked = click({}, { accepts: false });
  assert.equal(blocked.prevented, false, "để trình duyệt đi theo href=?lang=en");
  assert.equal(blocked.reloads, 0);
});
