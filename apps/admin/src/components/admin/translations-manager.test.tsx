import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { TranslationOverview } from "@iorder/shared/server/translations/translations.contract";
import { TranslationsView } from "./translations-manager";
import { AdminToastProvider } from "./ui/admin-feedback";
import { AdminPermissionsProvider } from "./ui/admin-permissions";

// Một số thành phần CMS dùng JSX kiểu cũ (không tự import React) nên test cần React toàn cục.
(globalThis as { React?: typeof React }).React = React;

const overview: TranslationOverview = { total: 2754, uiTotal: 9, locales: [{ code: "en", name: "English", label: "Tiếng Anh", translated: 12, uiTranslated: 3, missing: 2742, unused: 3 }] };
const render = (permissions: string[], value: TranslationOverview | null = overview) => renderToStaticMarkup(
  <AdminToastProvider><AdminPermissionsProvider actor={{ role: "editor", permissions }}><TranslationsView onRefresh={() => undefined} overview={value} /></AdminPermissionsProvider></AdminToastProvider>,
);

test("Màn Đa ngôn ngữ: mỗi ngôn ngữ một thẻ, nói rõ đã dịch bao nhiêu (giao diện và nội dung), còn thiếu, bản dịch không còn câu gốc, và nói URL không đổi", () => {
  const html = render(["settings.view", "settings.update"]);
  assert.match(html, /English/);
  assert.match(html, /12\/2\.754 câu đã dịch \(0%; giao diện 3\/9, nội dung 9\/2\.745\)/);
  assert.match(html, /Còn 2\.742 câu hiện tiếng Việt/);
  assert.match(html, /3 bản dịch không còn câu gốc/);
  assert.match(html, /Đường dẫn và slug giữ nguyên/);
  assert.match(html, /chữ cố định trong giao diện website/);
});

test("Màn Đa ngôn ngữ: tải file mẫu là hai nút nổi bật (Excel, CSV) đúng ngôn ngữ; người có quyền sửa cài đặt thấy ô chọn file, nút kiểm tra và tùy chọn cập nhật bản đã có", () => {
  const html = render(["settings.view", "settings.update"]);
  assert.match(html, /href="\/api\/v1\/admin\/translations\/en\?format=xlsx"/);
  assert.match(html, /href="\/api\/v1\/admin\/translations\/en\?format=csv"/);
  assert.match(html, /class="admin-button admin-button--export admin-file-tone--excel"[\s\S]*?Tải file mẫu Excel/);
  assert.match(html, /class="admin-button admin-button--export admin-file-tone--csv"[\s\S]*?Tải file mẫu CSV/);
  assert.match(html, /type="file"/);
  assert.match(html, /Kiểm tra file/);
  assert.match(html, /Cập nhật cả bản dịch đã có/);
});

test("Màn Đa ngôn ngữ: chỉ có quyền xem thì tải được file nhưng không có chỗ nhập", () => {
  const html = render(["settings.view"]);
  assert.match(html, /format=xlsx/);
  assert.doesNotMatch(html, /type="file"/);
  assert.match(html, /nhập bản dịch cần quyền sửa cài đặt/);
});

test("Màn Đa ngôn ngữ: không tải được tổng quan thì báo lỗi thay vì hiện số sai", () => {
  const html = render(["settings.view"], null);
  assert.match(html, /Không tải được tổng quan bản dịch/);
  assert.doesNotMatch(html, /câu đã dịch/);
});
