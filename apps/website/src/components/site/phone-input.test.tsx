import assert from "node:assert/strict";
import { test } from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PhoneInput } from "./phone-input";

test("Ô số điện thoại: bàn phím số, bắt buộc, giới hạn độ dài và nêu rõ quy tắc 10–11 số", () => {
  const html = renderToStaticMarkup(<PhoneInput className="x" enterKeyHint="next" />);
  assert.match(html, /name="phone"/);
  assert.match(html, /type="tel"/);
  assert.match(html, /inputMode="tel"/);
  assert.match(html, /maxLength="20"/);
  assert.match(html, /required/);
  assert.match(html, /enterKeyHint="next"/);
  assert.match(html, /title="[^"]*10–11 chữ số[^"]*\+84/);
});
