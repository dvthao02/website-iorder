import assert from "node:assert/strict";
import test from "node:test";
import React, { type MouseEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { localeCookie, localeCookieString } from "../../lib/locale-cookie";
import { chooseLanguage, LanguageSwitcher } from "./language-switcher";

// Thành phần dùng JSX kiểu cũ (không tự import React) nên test cần React toàn cục.
(globalThis as { React?: typeof React }).React = React;

const options = [{ code: "vi", short: "VI", name: "Tiếng Việt" }, { code: "en", short: "EN", name: "English" }] as const;

test("Nút đổi ngôn ngữ: ngôn ngữ đang xem là chữ đánh dấu, ngôn ngữ khác là liên kết ?lang= giữ nguyên đường dẫn hiện tại", () => {
  const html = renderToStaticMarkup(<LanguageSwitcher current="vi" options={[...options]} pathname="/support/guides" />);
  assert.match(html, /<span aria-current="true"[^>]*>VI<\/span>/);
  assert.match(html, /<a [^>]*href="\/support\/guides\?lang=en"[^>]*>EN<\/a>/);
  assert.doesNotMatch(html, /href="\/support\/guides\?lang=vi"/, "không có liên kết sang chính ngôn ngữ đang xem");
  // Liên kết thường, không để công cụ tìm kiếm đi theo (chúng luôn thấy tiếng Việt) và có mã ngôn ngữ cho trình đọc màn hình.
  assert.match(html, /rel="nofollow"/);
  assert.match(html, /hrefLang="en"/);
});

test("Nút đổi ngôn ngữ: đang xem tiếng Anh thì liên kết quay về tiếng Việt; chỉ có một ngôn ngữ thì không vẽ gì", () => {
  assert.match(renderToStaticMarkup(<LanguageSwitcher current="en" options={[...options]} pathname="/" />), /href="\/\?lang=vi"/);
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
