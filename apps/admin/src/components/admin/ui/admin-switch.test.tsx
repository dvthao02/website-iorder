import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AdminSwitch } from "./admin-switch";

// admin-feedback.tsx (huy hiệu) dùng JSX không import React: test chạy ngoài Next nên cần React toàn cục.
(globalThis as { React?: typeof React }).React = React;

test("Công tắc bật: có role switch, tên truy cập, huy hiệu Đang bật và gắn mô tả", () => {
  const html = renderToStaticMarkup(<AdminSwitch checked description="Gửi từ a@gmail.com" label="Gửi thư báo liên hệ mới" onChange={() => undefined} />);
  assert.match(html, /<input[^>]*role="switch"/);
  assert.match(html, /aria-label="Gửi thư báo liên hệ mới"/);
  assert.match(html, /checked=""/);
  assert.match(html, /data-active="true"/);
  assert.match(html, /Đang bật/);
  assert.match(html, /aria-describedby="([^"]+)"/);
  const id = /aria-describedby="([^"]+)"/.exec(html)?.[1];
  assert.match(html, new RegExp(`<span id="${id}">Gửi từ a@gmail.com</span>`));
});

test("Công tắc tắt và bị khóa: không tích, có disabled, huy hiệu Đang tắt, không gắn mô tả khi không có", () => {
  const html = renderToStaticMarkup(<AdminSwitch checked={false} disabled label="Gửi thư báo" onChange={() => undefined} />);
  assert.doesNotMatch(html, /checked=""/);
  assert.match(html, /disabled=""/);
  assert.match(html, /data-active="false"/);
  assert.match(html, /Đang tắt/);
  assert.doesNotMatch(html, /aria-describedby/);
});
