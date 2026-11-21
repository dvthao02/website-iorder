import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { assessPassword } from "../../../lib/password-strength";
import { AdminPasswordStrength } from "./admin-password-strength";

const filledSegments = (html: string) => (html.match(/data-filled=""/g) ?? []).length;

test("Chưa nhập: chỉ hiện lời nhắc yêu cầu, không có thanh, giữ id cho aria-describedby", () => {
  const html = renderToStaticMarkup(<AdminPasswordStrength assessment={assessPassword("")} id="new-password-hint" />);
  assert.match(html, /id="new-password-hint"/);
  assert.match(html, /Ít nhất 10 ký tự, khác mật khẩu đang dùng\./);
  assert.doesNotMatch(html, /admin-password-strength/);
});

test("Quá ngắn: một ô sáng, đếm theo ngưỡng tối thiểu", () => {
  const html = renderToStaticMarkup(<AdminPasswordStrength assessment={assessPassword("abcd")} id="x" />);
  assert.match(html, /data-level="too_short"/);
  assert.equal(filledSegments(html), 1);
  assert.match(html, /Quá ngắn/);
  assert.match(html, /4\/10 ký tự/);
  assert.match(html, /Cần thêm 6 ký tự nữa\./);
});

test("Mạnh: cả bốn ô sáng, nhãn là vùng thông báo, thanh ẩn khỏi trình đọc màn hình", () => {
  const html = renderToStaticMarkup(<AdminPasswordStrength assessment={assessPassword("Cam-Xoai-Dua-Hau-2026!")} />);
  assert.match(html, /data-level="strong"/);
  assert.equal(filledSegments(html), 4);
  assert.match(html, /<strong role="status">Mạnh<\/strong>/);
  assert.match(html, /aria-hidden="true" class="admin-password-strength__bar"/);
  assert.match(html, /22 ký tự/);
});

test("Mức Khá và Trung bình sáng đúng 3 và 2 ô", () => {
  assert.equal(filledSegments(renderToStaticMarkup(<AdminPasswordStrength assessment={assessPassword("kiwi-Apple-93")} />)), 3);
  assert.equal(filledSegments(renderToStaticMarkup(<AdminPasswordStrength assessment={assessPassword("kiwi-apple9")} />)), 2);
});

test("Lenient: mật khẩu ngắn hiện cảnh báo rõ (một ô đỏ, n/10 ký tự) thay vì đòi thêm ký tự", () => {
  const html = renderToStaticMarkup(<AdminPasswordStrength assessment={assessPassword("123", { lenient: true })} id="x" />);
  assert.match(html, /data-level="too_short"/);
  assert.equal(filledSegments(html), 1);
  assert.match(html, /3\/10 ký tự/);
  assert.match(html, /Rất dễ bị đoán\. Vẫn lưu được/);
  assert.doesNotMatch(html, /Cần thêm/);
  assert.match(renderToStaticMarkup(<AdminPasswordStrength assessment={assessPassword("", { lenient: true })} id="y" />), /Nên dùng từ 10 ký tự trở lên\./);
});
